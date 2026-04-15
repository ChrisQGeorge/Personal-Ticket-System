from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import asc, desc
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Priority, Ticket, TicketStatus
from ..schemas import TicketCreate, TicketResponse, TicketUpdate

router = APIRouter(prefix="/tickets", tags=["tickets"])


def _ticket_to_response(ticket: Ticket) -> TicketResponse:
    related_ids = [t.id for t in ticket.related_tickets]
    return TicketResponse(
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
    )


@router.get("", response_model=list[TicketResponse])
def list_tickets(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("date_created"),
    sort_order: Optional[str] = Query("desc"),
    db: Session = Depends(get_db),
):
    query = db.query(Ticket)

    if status:
        query = query.filter(Ticket.status == status)
    if priority:
        query = query.filter(Ticket.priority == priority)

    # Sorting
    sort_column = getattr(Ticket, sort_by, Ticket.date_created)
    if sort_order == "asc":
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))

    tickets = query.all()
    return [_ticket_to_response(t) for t in tickets]


@router.post("", response_model=TicketResponse, status_code=201)
def create_ticket(payload: TicketCreate, db: Session = Depends(get_db)):
    ticket = Ticket(
        title=payload.title,
        description=payload.description,
        due_date=payload.due_date,
        priority=payload.priority,
        est_hours=payload.est_hours,
    )
    db.add(ticket)
    db.flush()

    # Handle related tickets
    if payload.related_ticket_ids:
        related = db.query(Ticket).filter(Ticket.id.in_(payload.related_ticket_ids)).all()
        ticket.related_tickets = related

    db.commit()
    db.refresh(ticket)
    return _ticket_to_response(ticket)


@router.get("/{ticket_id}", response_model=TicketResponse)
def get_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return _ticket_to_response(ticket)


@router.put("/{ticket_id}", response_model=TicketResponse)
def update_ticket(ticket_id: int, payload: TicketUpdate, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    update_data = payload.model_dump(exclude_unset=True)

    # Handle related tickets separately
    related_ids = update_data.pop("related_ticket_ids", None)
    if related_ids is not None:
        related = db.query(Ticket).filter(Ticket.id.in_(related_ids)).all()
        ticket.related_tickets = related

    for field, value in update_data.items():
        setattr(ticket, field, value)

    db.commit()
    db.refresh(ticket)
    return _ticket_to_response(ticket)


@router.delete("/{ticket_id}", status_code=204)
def delete_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    db.delete(ticket)
    db.commit()
    return None
