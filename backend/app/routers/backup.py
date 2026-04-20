import io
import json
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_admin
from ..database import get_db
from ..models import Profile, QueueConfig, RecurringTemplate, Ticket, User, UserRole

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
        "user_id": p.user_id,
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
        "last_skipped_at": _serialize_date(t.last_skipped_at),
        "profile_id": t.profile_id,
        "custom_attributes": t.custom_attributes or "[]",
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
        "custom_attributes": t.custom_attributes or "[]",
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


@router.post("/backup")
def download_backup(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Export user's data as a downloadable JSON file. Admins get all data."""
    if user.role == UserRole.ADMIN:
        profiles = db.query(Profile).all()
    else:
        profiles = db.query(Profile).filter(Profile.user_id == user.id).all()

    profile_ids = [p.id for p in profiles]

    tickets = db.query(Ticket).filter(Ticket.profile_id.in_(profile_ids)).all() if profile_ids else []
    templates = db.query(RecurringTemplate).filter(RecurringTemplate.profile_id.in_(profile_ids)).all() if profile_ids else []
    config = db.query(QueueConfig).filter(QueueConfig.id == 1).first()

    # Get relationships for the user's tickets
    ticket_ids = [t.id for t in tickets]
    if ticket_ids:
        from ..models import ticket_relationships as tr_table
        relationships = db.execute(
            tr_table.select().where(tr_table.c.source_ticket_id.in_(ticket_ids))
        ).fetchall()
    else:
        relationships = []

    serialized_profiles = [_serialize_profile(p) for p in profiles]

    # Strip IMAP passwords from ALL backups — credentials should never be exported
    for p in serialized_profiles:
        p.pop("imap_password", None)

    backup = {
        "version": 1,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "profiles": serialized_profiles,
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
                f"attachment; filename=pts_backup_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
            )
        },
    )


@router.post("/backup/restore")
async def restore_backup(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Restore data from a backup JSON file into the current user's account."""
    MAX_BACKUP_SIZE = 50 * 1024 * 1024  # 50MB
    contents = await file.read()
    if len(contents) > MAX_BACKUP_SIZE:
        raise HTTPException(400, "Backup file too large. Maximum size is 50MB.")
    try:
        data = json.loads(contents)
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON file")

    REQUIRED_BACKUP_KEYS = {"version", "profiles", "tickets"}

    if not isinstance(data, dict):
        raise HTTPException(400, "Invalid backup format")
    if data.get("version") != 1:
        raise HTTPException(400, "Unsupported backup version")
    if not REQUIRED_BACKUP_KEYS.issubset(data.keys()):
        raise HTTPException(400, "Invalid backup format: missing required sections")

    # Validate data types
    if not isinstance(data.get("profiles"), list):
        raise HTTPException(400, "Invalid backup format: profiles must be a list")
    if not isinstance(data.get("tickets"), list):
        raise HTTPException(400, "Invalid backup format: tickets must be a list")

    # Validate each profile has required fields
    for i, p in enumerate(data.get("profiles", [])):
        if not isinstance(p, dict) or "name" not in p:
            raise HTTPException(400, f"Invalid profile at index {i}")

    # Validate each ticket has required fields
    for i, t in enumerate(data.get("tickets", [])):
        if not isinstance(t, dict) or "title" not in t:
            raise HTTPException(400, f"Invalid ticket at index {i}")

    try:
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))

        # Get current user's profile IDs to scope deletion
        user_profile_ids = [
            p.id for p in db.query(Profile).filter(Profile.user_id == user.id).all()
        ]

        if user_profile_ids:
            # Delete relationships for user's tickets
            user_ticket_ids = [
                t.id for t in db.query(Ticket).filter(Ticket.profile_id.in_(user_profile_ids)).all()
            ]
            if user_ticket_ids:
                from ..models import ticket_relationships as tr_table
                db.execute(
                    tr_table.delete().where(
                        tr_table.c.source_ticket_id.in_(user_ticket_ids)
                        | tr_table.c.related_ticket_id.in_(user_ticket_ids)
                    )
                )
            # Delete user's tickets, templates, profiles
            db.query(Ticket).filter(Ticket.profile_id.in_(user_profile_ids)).delete(synchronize_session=False)
            db.query(RecurringTemplate).filter(RecurringTemplate.profile_id.in_(user_profile_ids)).delete(synchronize_session=False)
            db.query(Profile).filter(Profile.id.in_(user_profile_ids)).delete(synchronize_session=False)
        db.commit()

        # Restore profiles (assign to current user)
        old_to_new_profile = {}
        for p in data.get("profiles", []):
            profile = Profile(
                name=p["name"],
                color=p.get("color", "#6366f1"),
                user_id=user.id,
                imap_host=p.get("imap_host"),
                imap_port=p.get("imap_port"),
                imap_user=p.get("imap_user"),
                imap_password=p.get("imap_password"),
                imap_use_ssl=p.get("imap_use_ssl", True),
                email_enabled=p.get("email_enabled", False),
            )
            db.add(profile)
            db.flush()
            old_to_new_profile[p["id"]] = profile.id
        db.commit()

        # Restore tickets (map old profile_id to new)
        old_to_new_ticket = {}
        for t in data.get("tickets", []):
            new_profile_id = old_to_new_profile.get(t.get("profile_id"))
            ticket = Ticket(
                title=t["title"],
                status=t.get("status", "open"),
                date_created=(
                    datetime.fromisoformat(t["date_created"])
                    if t.get("date_created")
                    else datetime.now(timezone.utc)
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
                last_skipped_at=(
                    datetime.fromisoformat(t["last_skipped_at"])
                    if t.get("last_skipped_at")
                    else None
                ),
                profile_id=new_profile_id,
                custom_attributes=t.get("custom_attributes", "[]"),
            )
            db.add(ticket)
            db.flush()
            old_to_new_ticket[t["id"]] = ticket.id
        db.commit()

        # Restore recurring templates
        for t in data.get("recurring_templates", []):
            new_profile_id = old_to_new_profile.get(t.get("profile_id"))
            template = RecurringTemplate(
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
                profile_id=new_profile_id,
                due_in_days=t.get("due_in_days"),
                custom_attributes=t.get("custom_attributes", "[]"),
            )
            db.add(template)
        db.commit()

        # Restore ticket relationships (map old IDs to new)
        for r in data.get("ticket_relationships", []):
            new_source = old_to_new_ticket.get(r["source_ticket_id"])
            new_related = old_to_new_ticket.get(r["related_ticket_id"])
            if new_source and new_related:
                db.execute(
                    text(
                        "INSERT INTO ticket_relationships (source_ticket_id, related_ticket_id) "
                        "VALUES (:s, :r)"
                    ),
                    {"s": new_source, "r": new_related},
                )
        db.commit()

        # Restore queue config if admin
        if user.role == UserRole.ADMIN and data.get("queue_config"):
            cfg = data["queue_config"]
            config = db.query(QueueConfig).filter(QueueConfig.id == 1).first()
            if config:
                for key in ("age_weight", "skip_weight", "effort_weight", "due_date_weight",
                            "overdue_penalty", "priority_very_high", "priority_high",
                            "priority_default", "priority_low", "priority_very_low"):
                    if key in cfg:
                        setattr(config, key, cfg[key])
            else:
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
