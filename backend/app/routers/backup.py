import io
import json
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Profile, QueueConfig, RecurringTemplate, Ticket

router = APIRouter(tags=["backup"])


def _serialize_date(val):
    """Serialize date/datetime to ISO string."""
    if isinstance(val, (date, datetime)):
        return val.isoformat()
    return val


def _serialize_profile(p: Profile) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "color": p.color,
        "imap_host": p.imap_host,
        "imap_port": p.imap_port,
        "imap_user": p.imap_user,
        "imap_password": p.imap_password,
        "imap_use_ssl": p.imap_use_ssl,
        "email_enabled": p.email_enabled,
    }


def _serialize_ticket(t: Ticket) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "status": t.status.value if t.status else None,
        "date_created": _serialize_date(t.date_created),
        "description": t.description,
        "due_date": _serialize_date(t.due_date),
        "priority": t.priority.value if t.priority else None,
        "est_hours": t.est_hours,
        "skip_count": t.skip_count,
        "profile_id": t.profile_id,
    }


def _serialize_template(t: RecurringTemplate) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "priority": t.priority.value if t.priority else None,
        "est_hours": t.est_hours,
        "active": t.active,
        "frequency": t.frequency.value if t.frequency else None,
        "interval_count": t.interval_count,
        "start_date": _serialize_date(t.start_date),
        "last_fired": _serialize_date(t.last_fired),
        "next_fire": _serialize_date(t.next_fire),
        "profile_id": t.profile_id,
        "due_in_days": t.due_in_days,
    }


def _serialize_config(c: QueueConfig) -> dict:
    return {
        "id": c.id,
        "age_weight": c.age_weight,
        "skip_weight": c.skip_weight,
        "effort_weight": c.effort_weight,
        "due_date_weight": c.due_date_weight,
        "overdue_penalty": c.overdue_penalty,
        "priority_very_high": c.priority_very_high,
        "priority_high": c.priority_high,
        "priority_default": c.priority_default,
        "priority_low": c.priority_low,
        "priority_very_low": c.priority_very_low,
    }


@router.get("/backup")
def download_backup(db: Session = Depends(get_db)):
    """Export all data as a downloadable JSON file."""
    profiles = db.query(Profile).all()
    tickets = db.query(Ticket).all()
    templates = db.query(RecurringTemplate).all()
    config = db.query(QueueConfig).filter(QueueConfig.id == 1).first()

    relationships = db.execute(
        text("SELECT source_ticket_id, related_ticket_id FROM ticket_relationships")
    ).fetchall()

    backup = {
        "version": 1,
        "exported_at": datetime.utcnow().isoformat(),
        "profiles": [_serialize_profile(p) for p in profiles],
        "tickets": [_serialize_ticket(t) for t in tickets],
        "recurring_templates": [_serialize_template(t) for t in templates],
        "ticket_relationships": [
            {"source_ticket_id": r[0], "related_ticket_id": r[1]}
            for r in relationships
        ],
        "queue_config": _serialize_config(config) if config else None,
    }

    content = json.dumps(backup, indent=2, default=str)
    return StreamingResponse(
        io.BytesIO(content.encode("utf-8")),
        media_type="application/json",
        headers={
            "Content-Disposition": (
                f"attachment; filename=pts_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
            )
        },
    )


@router.post("/backup/restore")
async def restore_backup(
    file: UploadFile = File(...), db: Session = Depends(get_db)
):
    """Restore all data from a backup JSON file. WARNING: This clears existing data."""
    contents = await file.read()
    try:
        data = json.loads(contents)
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON file")

    if data.get("version") != 1:
        raise HTTPException(400, "Unsupported backup version")

    try:
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))

        # Clear existing data
        db.execute(text("DELETE FROM ticket_relationships"))
        db.execute(text("DELETE FROM tickets"))
        db.execute(text("DELETE FROM recurring_templates"))
        db.execute(text("DELETE FROM profiles"))
        db.execute(text("DELETE FROM queue_config"))
        db.commit()

        # Restore profiles
        for p in data.get("profiles", []):
            profile = Profile(
                id=p["id"],
                name=p["name"],
                color=p.get("color", "#6366f1"),
                imap_host=p.get("imap_host"),
                imap_port=p.get("imap_port"),
                imap_user=p.get("imap_user"),
                imap_password=p.get("imap_password"),
                imap_use_ssl=p.get("imap_use_ssl", True),
                email_enabled=p.get("email_enabled", False),
            )
            db.add(profile)
        db.commit()

        # Restore tickets
        for t in data.get("tickets", []):
            ticket = Ticket(
                id=t["id"],
                title=t["title"],
                status=t.get("status", "open"),
                date_created=(
                    datetime.fromisoformat(t["date_created"])
                    if t.get("date_created")
                    else datetime.utcnow()
                ),
                description=t.get("description"),
                due_date=(
                    date.fromisoformat(t["due_date"])
                    if t.get("due_date")
                    else None
                ),
                priority=t.get("priority", "default"),
                est_hours=t.get("est_hours"),
                skip_count=t.get("skip_count", 0),
                profile_id=t.get("profile_id"),
            )
            db.add(ticket)
        db.commit()

        # Restore recurring templates
        for t in data.get("recurring_templates", []):
            template = RecurringTemplate(
                id=t["id"],
                title=t["title"],
                description=t.get("description"),
                priority=t.get("priority", "default"),
                est_hours=t.get("est_hours"),
                active=t.get("active", True),
                frequency=t["frequency"],
                interval_count=t.get("interval_count", 1),
                start_date=(
                    date.fromisoformat(t["start_date"])
                    if t.get("start_date")
                    else date.today()
                ),
                last_fired=(
                    datetime.fromisoformat(t["last_fired"])
                    if t.get("last_fired")
                    else None
                ),
                next_fire=(
                    datetime.fromisoformat(t["next_fire"])
                    if t.get("next_fire")
                    else None
                ),
                profile_id=t.get("profile_id"),
                due_in_days=t.get("due_in_days"),
            )
            db.add(template)
        db.commit()

        # Restore ticket relationships
        for r in data.get("ticket_relationships", []):
            db.execute(
                text(
                    "INSERT INTO ticket_relationships (source_ticket_id, related_ticket_id) "
                    "VALUES (:s, :r)"
                ),
                {"s": r["source_ticket_id"], "r": r["related_ticket_id"]},
            )
        db.commit()

        # Restore queue config
        if data.get("queue_config"):
            cfg = data["queue_config"]
            config = QueueConfig(
                id=1,
                age_weight=cfg.get("age_weight", 10.0),
                skip_weight=cfg.get("skip_weight", 15.0),
                effort_weight=cfg.get("effort_weight", 5.0),
                due_date_weight=cfg.get("due_date_weight", 3.0),
                overdue_penalty=cfg.get("overdue_penalty", -100.0),
                priority_very_high=cfg.get("priority_very_high", -40.0),
                priority_high=cfg.get("priority_high", -20.0),
                priority_default=cfg.get("priority_default", 0.0),
                priority_low=cfg.get("priority_low", 20.0),
                priority_very_low=cfg.get("priority_very_low", 40.0),
            )
            db.add(config)
            db.commit()

        # Reset auto-increment counters
        max_ticket_id = max(
            (t["id"] for t in data.get("tickets", [])), default=0
        )
        max_template_id = max(
            (t["id"] for t in data.get("recurring_templates", [])), default=0
        )
        max_profile_id = max(
            (p["id"] for p in data.get("profiles", [])), default=0
        )
        db.execute(
            text(f"ALTER TABLE tickets AUTO_INCREMENT = {max_ticket_id + 1}")
        )
        db.execute(
            text(
                f"ALTER TABLE recurring_templates AUTO_INCREMENT = {max_template_id + 1}"
            )
        )
        db.execute(
            text(f"ALTER TABLE profiles AUTO_INCREMENT = {max_profile_id + 1}")
        )
        db.commit()

        db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
        db.commit()

    except Exception:
        db.rollback()
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
        db.commit()
        raise HTTPException(500, "Restore failed. Data may be in an inconsistent state.")

    return {
        "restored": True,
        "profiles": len(data.get("profiles", [])),
        "tickets": len(data.get("tickets", [])),
        "recurring_templates": len(data.get("recurring_templates", [])),
        "ticket_relationships": len(data.get("ticket_relationships", [])),
    }
