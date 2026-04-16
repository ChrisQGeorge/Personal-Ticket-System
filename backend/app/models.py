import enum
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.orm import relationship

from .database import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class TicketStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in-progress"
    COMPLETED = "completed"
    SKIPPED = "skipped"


class Priority(str, enum.Enum):
    VERY_LOW = "very low"
    LOW = "low"
    DEFAULT = "default"
    HIGH = "high"
    VERY_HIGH = "very high"


class Frequency(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"


# ---------------------------------------------------------------------------
# User model
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), nullable=False, unique=True)
    password_hash = Column(String(512), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.USER)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    token_version = Column(Integer, nullable=False, default=0)

    profiles = relationship("Profile", back_populates="user")


# ---------------------------------------------------------------------------
# Profile model
# ---------------------------------------------------------------------------

class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    color = Column(String(7), nullable=False, default="#6366f1")  # hex color for UI
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    # IMAP email config (optional)
    imap_host = Column(String(255), nullable=True)
    imap_port = Column(Integer, nullable=True, default=993)
    imap_user = Column(String(255), nullable=True)
    imap_password = Column(String(512), nullable=True)
    imap_use_ssl = Column(Boolean, nullable=False, default=True)
    email_enabled = Column(Boolean, nullable=False, default=False)

    user = relationship("User", back_populates="profiles")
    tickets = relationship("Ticket", back_populates="profile")
    recurring_templates = relationship("RecurringTemplate", back_populates="profile")


# ---------------------------------------------------------------------------
# Association table for self-referential many-to-many ticket relationships
# ---------------------------------------------------------------------------

ticket_relationships = Table(
    "ticket_relationships",
    Base.metadata,
    Column(
        "source_ticket_id",
        Integer,
        ForeignKey("tickets.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "related_ticket_id",
        Integer,
        ForeignKey("tickets.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


# ---------------------------------------------------------------------------
# Ticket model
# ---------------------------------------------------------------------------

class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    status = Column(
        Enum(TicketStatus),
        nullable=False,
        default=TicketStatus.OPEN,
    )
    date_created = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    description = Column(Text, nullable=True)
    due_date = Column(Date, nullable=True)
    priority = Column(
        Enum(Priority),
        nullable=False,
        default=Priority.DEFAULT,
    )
    est_hours = Column(Float, nullable=True)
    skip_count = Column(Integer, nullable=False, default=0)
    last_skipped_at = Column(DateTime, nullable=True)  # Reset effective age on skip
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=True)

    profile = relationship("Profile", back_populates="tickets")

    # Self-referential many-to-many
    related_tickets = relationship(
        "Ticket",
        secondary=ticket_relationships,
        primaryjoin=id == ticket_relationships.c.source_ticket_id,
        secondaryjoin=id == ticket_relationships.c.related_ticket_id,
        backref="related_to",
        lazy="selectin",
    )


# ---------------------------------------------------------------------------
# RecurringTemplate model
# ---------------------------------------------------------------------------

class QueueConfig(Base):
    __tablename__ = "queue_config"

    id = Column(Integer, primary_key=True, default=1)
    # Convention: positive = moves ticket toward front, negative = pushes toward back
    age_weight = Column(Float, nullable=False, default=10.0)
    skip_weight = Column(Float, nullable=False, default=-15.0)
    effort_weight = Column(Float, nullable=False, default=-5.0)
    due_date_weight = Column(Float, nullable=False, default=3.0)
    overdue_penalty = Column(Float, nullable=False, default=100.0)
    priority_very_high = Column(Float, nullable=False, default=40.0)
    priority_high = Column(Float, nullable=False, default=20.0)
    priority_default = Column(Float, nullable=False, default=0.0)
    priority_low = Column(Float, nullable=False, default=-20.0)
    priority_very_low = Column(Float, nullable=False, default=-40.0)


# ---------------------------------------------------------------------------
# RecurringTemplate model
# ---------------------------------------------------------------------------

class RecurringTemplate(Base):
    __tablename__ = "recurring_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(
        Enum(Priority),
        nullable=False,
        default=Priority.DEFAULT,
    )
    est_hours = Column(Float, nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    frequency = Column(Enum(Frequency), nullable=False)
    interval_count = Column(Integer, nullable=False, default=1)
    start_date = Column(Date, nullable=False)
    last_fired = Column(DateTime, nullable=True)
    next_fire = Column(DateTime, nullable=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=True)
    # Relative due date: when a ticket is created from this template,
    # set its due date to creation_date + due_in_days
    due_in_days = Column(Integer, nullable=True)  # e.g., 7 means due 1 week after creation

    profile = relationship("Profile", back_populates="recurring_templates")


# ---------------------------------------------------------------------------
# UserGameStats model (Task Quest gamification)
# ---------------------------------------------------------------------------

class UserGameStats(Base):
    __tablename__ = "user_game_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    gamification_enabled = Column(Boolean, nullable=False, default=False)

    # XP & Level
    total_xp = Column(Integer, nullable=False, default=0)
    current_level = Column(Integer, nullable=False, default=1)

    # Streak
    current_streak = Column(Integer, nullable=False, default=0)
    longest_streak = Column(Integer, nullable=False, default=0)
    last_completion_date = Column(Date, nullable=True)
    streak_shield_available = Column(Boolean, nullable=False, default=False)
    streak_shield_used = Column(Boolean, nullable=False, default=False)

    # Combo
    combo_count = Column(Integer, nullable=False, default=0)
    combo_last_date = Column(Date, nullable=True)

    # Counters
    total_completed = Column(Integer, nullable=False, default=0)
    total_skipped = Column(Integer, nullable=False, default=0)
    total_created = Column(Integer, nullable=False, default=0)
    weekly_skips = Column(Integer, nullable=False, default=0)
    weekly_skips_reset = Column(Date, nullable=True)
    tickets_completed_today = Column(Integer, nullable=False, default=0)
    today_date = Column(Date, nullable=True)

    # Achievement tracking (JSON string of unlocked achievement IDs)
    unlocked_achievements = Column(Text, nullable=False, default="[]")

    # Daily/Weekly challenge tracking (JSON)
    daily_challenges = Column(Text, nullable=False, default="[]")
    daily_challenge_date = Column(Date, nullable=True)
    weekly_challenge = Column(Text, nullable=True)
    weekly_challenge_date = Column(Date, nullable=True)

    user = relationship("User", backref="game_stats")
