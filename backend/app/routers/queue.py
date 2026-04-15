from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Priority, Ticket, TicketStatus
from ..schemas import QueueStatsResponse, QueueTicketResponse, TicketResponse
from ..services.queue_service import get_next_ticket

router = APIRouter(prefix="/queue", tags=["queue"])


def _ticket_to_response(ticket: Ticket, score: float = 0.0) -> QueueTicketResponse:
    related_ids = [t.id for t in ticket.related_tickets]
    return QueueTicketResponse(
        id=ticket.id,
        title=ticket.title,
        status=ticket.status.value if isinstance(ticket.status, TicketStatus) else ticket.status,
        date_created=ticket.date_created,
        description=ticket.description,
        due_date=ticket.due_date,
        priority=ticket.priority.value if isinstance(ticket.priority, Priority) else ticket.priority,
        est_hours=ticket.est_hours,
        skip_count=ticket.skip_count,
        related_ticket_ids=related_ids,
        score=score,
    )


@router.get("/next", response_model=QueueTicketResponse)
def get_next(db: Session = Depends(get_db)):
    result = get_next_ticket(db)
    if result is None:
        raise HTTPException(status_code=404, detail="No tickets in queue")
    ticket, score = result

    # Mark as in-progress if it was open
    if ticket.status == TicketStatus.OPEN:
        ticket.status = TicketStatus.IN_PROGRESS
        db.commit()
        db.refresh(ticket)

    return _ticket_to_response(ticket, score)


@router.post("/complete/{ticket_id}", response_model=TicketResponse)
def complete_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket.status = TicketStatus.COMPLETED
    db.commit()
    db.refresh(ticket)

    related_ids = [t.id for t in ticket.related_tickets]
    return TicketResponse(
        id=ticket.id,
        title=ticket.title,
        status=ticket.status.value,
        date_created=ticket.date_created,
        description=ticket.description,
        due_date=ticket.due_date,
        priority=ticket.priority.value,
        est_hours=ticket.est_hours,
        skip_count=ticket.skip_count,
        related_ticket_ids=related_ids,
    )


@router.post("/skip/{ticket_id}", response_model=TicketResponse)
def skip_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket.status = TicketStatus.SKIPPED
    ticket.skip_count += 1
    db.commit()
    db.refresh(ticket)

    related_ids = [t.id for t in ticket.related_tickets]
    return TicketResponse(
        id=ticket.id,
        title=ticket.title,
        status=ticket.status.value,
        date_created=ticket.date_created,
        description=ticket.description,
        due_date=ticket.due_date,
        priority=ticket.priority.value,
        est_hours=ticket.est_hours,
        skip_count=ticket.skip_count,
        related_ticket_ids=related_ids,
    )


@router.get("/stats", response_model=QueueStatsResponse)
def get_stats(db: Session = Depends(get_db)):
    total = db.query(Ticket).count()
    total_open = db.query(Ticket).filter(Ticket.status == TicketStatus.OPEN).count()
    total_in_progress = db.query(Ticket).filter(Ticket.status == TicketStatus.IN_PROGRESS).count()
    total_completed = db.query(Ticket).filter(Ticket.status == TicketStatus.COMPLETED).count()
    total_skipped = db.query(Ticket).filter(Ticket.status == TicketStatus.SKIPPED).count()

    return QueueStatsResponse(
        total_open=total_open,
        total_in_progress=total_in_progress,
        total_completed=total_completed,
        total_skipped=total_skipped,
        total=total,
    )
