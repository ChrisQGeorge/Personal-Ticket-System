from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import asc, desc
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Priority, Profile, Ticket, TicketStatus, User
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
        profile_id=ticket.profile_id,
    )


def _verify_profile_ownership(db: Session, profile_id: int, user: User):
    """Verify that the given profile belongs to the current user."""
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile or profile.user_id != user.id:
        raise HTTPException(status_code=403, detail="Profile does not belong to you")
    return profile


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


@router.get("", response_model=list[TicketResponse])
def list_tickets(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    profile_id: Optional[int] = Query(None),
    sort_by: Optional[str] = Query("date_created"),
    sort_order: Optional[str] = Query("desc"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Ticket).join(Profile).filter(Profile.user_id == user.id)

    if status:
        query = query.filter(Ticket.status == status)
    if priority:
        query = query.filter(Ticket.priority == priority)
    if profile_id is not None:
        _verify_profile_ownership(db, profile_id, user)
        query = query.filter(Ticket.profile_id == profile_id)

    # Sorting — whitelist allowed fields
    ALLOWED_SORT_FIELDS = {"id", "title", "status", "priority", "due_date", "est_hours", "date_created", "skip_count"}
    if sort_by not in ALLOWED_SORT_FIELDS:
        sort_by = "date_created"
    sort_column = getattr(Ticket, sort_by)
    if sort_order == "asc":
        query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(desc(sort_column))

    tickets = query.all()
    return [_ticket_to_response(t) for t in tickets]


@router.post("", response_model=TicketResponse, status_code=201)
def create_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.profile_id is not None:
        _verify_profile_ownership(db, payload.profile_id, user)

    ticket = Ticket(
        title=payload.title,
        description=payload.description,
        due_date=payload.due_date,
        priority=payload.priority,
        est_hours=payload.est_hours,
        profile_id=payload.profile_id,
    )
    db.add(ticket)
    db.flush()

    # Handle related tickets (verify ownership)
    if payload.related_ticket_ids:
        related = db.query(Ticket).join(Profile).filter(
            Ticket.id.in_(payload.related_ticket_ids),
            Profile.user_id == user.id,
        ).all()
        ticket.related_tickets = related

    db.commit()
    db.refresh(ticket)
    return _ticket_to_response(ticket)


@router.get("/{ticket_id}", response_model=TicketResponse)
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ticket = _verify_ticket_ownership(db, ticket_id, user)
    return _ticket_to_response(ticket)


@router.put("/{ticket_id}", response_model=TicketResponse)
def update_ticket(
    ticket_id: int,
    payload: TicketUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ticket = _verify_ticket_ownership(db, ticket_id, user)

    update_data = payload.model_dump(exclude_unset=True)

    # Handle related tickets separately (verify ownership)
    related_ids = update_data.pop("related_ticket_ids", None)
    if related_ids is not None:
        related = db.query(Ticket).join(Profile).filter(
            Ticket.id.in_(related_ids),
            Profile.user_id == user.id,
        ).all()
        ticket.related_tickets = related

    for field, value in update_data.items():
        setattr(ticket, field, value)

    db.commit()
    db.refresh(ticket)
    return _ticket_to_response(ticket)


@router.delete("/{ticket_id}", status_code=204)
def delete_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ticket = _verify_ticket_ownership(db, ticket_id, user)
    db.delete(ticket)
    db.commit()
    return None
