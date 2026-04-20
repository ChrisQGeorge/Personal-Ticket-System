import asyncio
import logging
from datetime import date, datetime, timedelta, timezone

from dateutil.relativedelta import relativedelta

from ..database import SessionLocal
from ..models import Frequency, RecurringTemplate, Ticket
from .email_service import check_all_email_profiles

logger = logging.getLogger(__name__)


def compute_next_fire(template: RecurringTemplate) -> datetime:
    """Compute the next fire datetime based on frequency, interval, and last_fired."""
    base = template.last_fired or datetime.combine(template.start_date, datetime.min.time())

    if template.frequency == Frequency.DAILY:
        delta = timedelta(days=template.interval_count)
    elif template.frequency == Frequency.WEEKLY:
        delta = timedelta(weeks=template.interval_count)
    elif template.frequency == Frequency.MONTHLY:
        delta = relativedelta(months=template.interval_count)
    else:
        delta = timedelta(days=template.interval_count)

    return base + delta


def fire_template(db, template: RecurringTemplate) -> None:
    """Create a ticket from a recurring template and update fire times."""
    import json

    # Copy custom attributes from template, resetting "current" values
    attrs_str = template.custom_attributes or "[]"
    try:
        attrs = json.loads(attrs_str)
        if not isinstance(attrs, list):
            attrs = []
    except (ValueError, TypeError):
        attrs = []
    # Reset current values on each fire (template provides goal structure)
    for a in attrs:
        if isinstance(a, dict):
            t = a.get("type", "text")
            if t == "number":
                a["current"] = 0
            elif t == "boolean":
                a["current"] = False
            else:
                a["current"] = None

    ticket = Ticket(
        title=template.title,
        description=template.description,
        priority=template.priority,
        est_hours=template.est_hours,
        profile_id=template.profile_id,
        custom_attributes=json.dumps(attrs),
    )
    # Set relative due date if configured
    if template.due_in_days is not None:
        ticket.due_date = date.today() + timedelta(days=template.due_in_days)
    db.add(ticket)

    template.last_fired = datetime.now(timezone.utc)
    template.next_fire = compute_next_fire(template)
    db.commit()
    logger.info("Fired recurring template %d -> created ticket '%s'", template.id, template.title)


def check_recurring_templates() -> None:
    """Check all active templates and fire those whose next_fire <= now."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        templates = (
            db.query(RecurringTemplate)
            .filter(
                RecurringTemplate.active.is_(True),
                RecurringTemplate.next_fire <= now,
            )
            .all()
        )
        for template in templates:
            fire_template(db, template)
    except Exception:
        logger.exception("Error in recurring template scheduler")
        db.rollback()
    finally:
        db.close()


async def scheduler_loop() -> None:
    """Background loop that checks recurring templates every 60 seconds."""
    logger.info("Recurring template scheduler started")
    while True:
        try:
            check_recurring_templates()
        except Exception:
            logger.exception("Scheduler loop error")
        try:
            check_all_email_profiles()
        except Exception:
            logger.exception("Email check error")
        await asyncio.sleep(60)
