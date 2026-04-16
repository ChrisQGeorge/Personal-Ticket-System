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
    """Compute the weighted FIFO score for a ticket. Lower score = served first.

    All config weights follow the convention:
      positive = moves ticket closer to front (served sooner)
      negative = pushes ticket further back (served later)

    The formula SUBTRACTS each term, so a positive weight lowers the score
    (= served sooner) and a negative weight raises it (= served later).
    """
    now = datetime.now(timezone.utc)

    # Age: use last_skipped_at if available (resets effective age on skip)
    effective_date = ticket.last_skipped_at or ticket.date_created
    if effective_date.tzinfo is None:
        effective_date = effective_date.replace(tzinfo=timezone.utc)
    days_since_effective = (now - effective_date).total_seconds() / 86400.0

    # Effort
    est = ticket.est_hours if ticket.est_hours is not None else 1.0

    # Due-date urgency
    due_date_urgency = 0.0
    if ticket.due_date is not None:
        today = date.today()
        days_until_due = (ticket.due_date - today).days
        if days_until_due < 0:
            due_date_urgency = abs(days_until_due)  # days overdue (positive number)
        else:
            due_date_urgency = 0.0

    # Days until due (positive = still time left, negative = overdue)
    days_until_due = 0.0
    if ticket.due_date is not None:
        days_until_due = max((ticket.due_date - date.today()).days, 0)

    # All terms are SUBTRACTED so positive config values = lower score = served sooner.
    # Convention: positive weight = moves ticket toward front of queue.
    score = (
        0.0
        - days_since_effective * config.age_weight       # (+) older tickets served sooner
        - get_priority_weight(ticket.priority, config)    # (+) higher priority served sooner
        - ticket.skip_count * config.skip_weight          # (-) skipped tickets pushed back
        - est * config.effort_weight                      # (-) bigger tasks pushed back
        - days_until_due * config.due_date_weight         # (+) approaching deadlines served sooner
        - due_date_urgency * config.overdue_penalty       # (+) overdue tickets served sooner
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
