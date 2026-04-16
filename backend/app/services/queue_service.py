from datetime import date, datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from ..models import Priority, Profile, QueueConfig, Ticket, TicketStatus


def _get_config(db: Session) -> QueueConfig:
    """Load the singleton QueueConfig row, creating defaults if absent."""
    config = db.query(QueueConfig).filter(QueueConfig.id == 1).first()
    if config is None:
        config = QueueConfig(id=1)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def get_priority_weight(priority: Priority, config: QueueConfig) -> float:
    mapping = {
        Priority.VERY_HIGH: config.priority_very_high,
        Priority.HIGH: config.priority_high,
        Priority.DEFAULT: config.priority_default,
        Priority.LOW: config.priority_low,
        Priority.VERY_LOW: config.priority_very_low,
    }
    return mapping.get(priority, 0)


def compute_score(ticket: Ticket, config: QueueConfig) -> float:
    """Compute the weighted FIFO score for a ticket. Lower score = served first."""
    now = datetime.now(timezone.utc)

    # Base FIFO score: older tickets get lower (better) scores
    # MySQL stores naive datetimes, so strip tzinfo for comparison
    created = ticket.date_created.replace(tzinfo=timezone.utc) if ticket.date_created.tzinfo is None else ticket.date_created
    days_since_creation = (now - created).total_seconds() / 86400.0

    # Effort weight: lower effort -> lower score
    est = ticket.est_hours if ticket.est_hours is not None else 1.0

    # Due-date urgency
    due_date_urgency = 0.0
    if ticket.due_date is not None:
        today = date.today()
        days_until_due = (ticket.due_date - today).days
        if days_until_due < 0:
            # Overdue
            due_date_urgency = config.overdue_penalty
        else:
            due_date_urgency = days_until_due * -config.due_date_weight

    score = (
        days_since_creation * config.age_weight
        - get_priority_weight(ticket.priority, config)
        - ticket.skip_count * config.skip_weight
        + est * config.effort_weight
        - due_date_urgency
    )
    return score


def get_next_ticket(
    db: Session,
    profile_id: Optional[int] = None,
    user_id: Optional[int] = None,
) -> Optional[Tuple[Ticket, float]]:
    """Return the highest-priority ticket (lowest score) from the queue."""
    config = _get_config(db)
    query = db.query(Ticket).filter(Ticket.status.notin_([TicketStatus.COMPLETED]))
    if user_id is not None:
        query = query.join(Profile).filter(Profile.user_id == user_id)
    if profile_id is not None:
        query = query.filter(Ticket.profile_id == profile_id)
    tickets = query.all()
    if not tickets:
        return None

    scored: List[Tuple[Ticket, float]] = [
        (t, compute_score(t, config)) for t in tickets
    ]
    scored.sort(key=lambda x: x[1])
    return scored[0]


def get_all_scored(
    db: Session,
    profile_id: Optional[int] = None,
    user_id: Optional[int] = None,
) -> List[Tuple[Ticket, float]]:
    """Return all non-completed tickets with their scores, sorted."""
    config = _get_config(db)
    query = db.query(Ticket).filter(Ticket.status.notin_([TicketStatus.COMPLETED]))
    if user_id is not None:
        query = query.join(Profile).filter(Profile.user_id == user_id)
    if profile_id is not None:
        query = query.filter(Ticket.profile_id == profile_id)
    tickets = query.all()
    scored = [(t, compute_score(t, config)) for t in tickets]
    scored.sort(key=lambda x: x[1])
    return scored
