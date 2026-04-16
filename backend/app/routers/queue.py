from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Priority, Profile, Ticket, TicketStatus, User
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
        profile_id=ticket.profile_id,
        score=score,
    )


def _verify_ticket_ownership(db: Session, ticket_id: int, user: User) -> Ticket:
    """Verify that the given ticket belongs to a profile owned by the current user."""
    ticket = (
        db.query(Ticket)
        .join(Profile)
        .filter(Ticket.id == ticket_id, Profile.user_id == user.id)
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@router.get("/next", response_model=QueueTicketResponse)
def get_next(
    profile_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = get_next_ticket(db, profile_id=profile_id, user_id=user.id)
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
def complete_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ticket = _verify_ticket_ownership(db, ticket_id, user)

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
        profile_id=ticket.profile_id,
    )


@router.post("/skip/{ticket_id}", response_model=TicketResponse)
def skip_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ticket = _verify_ticket_ownership(db, ticket_id, user)

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
        profile_id=ticket.profile_id,
    )


@router.get("/stats", response_model=QueueStatsResponse)
def get_stats(
    profile_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    base_query = db.query(Ticket).join(Profile).filter(Profile.user_id == user.id)
    if profile_id is not None:
        base_query = base_query.filter(Ticket.profile_id == profile_id)

    total = base_query.count()
    total_open = base_query.filter(Ticket.status == TicketStatus.OPEN).count()
    total_in_progress = base_query.filter(Ticket.status == TicketStatus.IN_PROGRESS).count()
    total_completed = base_query.filter(Ticket.status == TicketStatus.COMPLETED).count()
    total_skipped = base_query.filter(Ticket.status == TicketStatus.SKIPPED).count()

    return QueueStatsResponse(
        total_open=total_open,
        total_in_progress=total_in_progress,
        total_completed=total_completed,
        total_skipped=total_skipped,
        total=total,
    )
