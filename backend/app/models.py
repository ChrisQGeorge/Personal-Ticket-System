import enum
from datetime import date, datetime

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
    date_created = Column(DateTime, nullable=False, default=datetime.utcnow)
    description = Column(Text, nullable=True)
    due_date = Column(Date, nullable=True)
    priority = Column(
        Enum(Priority),
        nullable=False,
        default=Priority.DEFAULT,
    )
    est_hours = Column(Float, nullable=True)
    skip_count = Column(Integer, nullable=False, default=0)

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
    age_weight = Column(Float, nullable=False, default=10.0)
    skip_weight = Column(Float, nullable=False, default=15.0)
    effort_weight = Column(Float, nullable=False, default=5.0)
    due_date_weight = Column(Float, nullable=False, default=3.0)
    overdue_penalty = Column(Float, nullable=False, default=-100.0)
    priority_very_high = Column(Float, nullable=False, default=-40.0)
    priority_high = Column(Float, nullable=False, default=-20.0)
    priority_default = Column(Float, nullable=False, default=0.0)
    priority_low = Column(Float, nullable=False, default=20.0)
    priority_very_low = Column(Float, nullable=False, default=40.0)


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
