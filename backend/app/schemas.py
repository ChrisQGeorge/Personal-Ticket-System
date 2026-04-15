from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Ticket schemas
# ---------------------------------------------------------------------------

class TicketBase(BaseModel):
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    due_date: Optional[date] = None
    priority: str = "default"
    est_hours: Optional[float] = None


class TicketCreate(TicketBase):
    related_ticket_ids: Optional[List[int]] = None


class TicketUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    due_date: Optional[date] = None
    priority: Optional[str] = None
    est_hours: Optional[float] = None
    status: Optional[str] = None
    related_ticket_ids: Optional[List[int]] = None


class TicketResponse(BaseModel):
    id: int
    title: str
    status: str
    date_created: datetime
    description: Optional[str] = None
    due_date: Optional[date] = None
    priority: str
    est_hours: Optional[float] = None
    skip_count: int
    related_ticket_ids: List[int] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Queue schemas
# ---------------------------------------------------------------------------

class QueueTicketResponse(TicketResponse):
    score: float


class QueueStatsResponse(BaseModel):
    total_open: int
    total_in_progress: int
    total_completed: int
    total_skipped: int
    total: int


# ---------------------------------------------------------------------------
# Recurring template schemas
# ---------------------------------------------------------------------------

class QueueConfigResponse(BaseModel):
    age_weight: float
    skip_weight: float
    effort_weight: float
    due_date_weight: float
    overdue_penalty: float
    priority_very_high: float
    priority_high: float
    priority_default: float
    priority_low: float
    priority_very_low: float

    model_config = {"from_attributes": True}


class QueueConfigUpdate(BaseModel):
    age_weight: Optional[float] = None
    skip_weight: Optional[float] = None
    effort_weight: Optional[float] = None
    due_date_weight: Optional[float] = None
    overdue_penalty: Optional[float] = None
    priority_very_high: Optional[float] = None
    priority_high: Optional[float] = None
    priority_default: Optional[float] = None
    priority_low: Optional[float] = None
    priority_very_low: Optional[float] = None


# ---------------------------------------------------------------------------
# Recurring template schemas
# ---------------------------------------------------------------------------

class RecurringTemplateBase(BaseModel):
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    priority: str = "default"
    est_hours: Optional[float] = None
    frequency: str
    interval_count: int = 1
    start_date: date


class RecurringTemplateCreate(RecurringTemplateBase):
    pass


class RecurringTemplateUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    priority: Optional[str] = None
    est_hours: Optional[float] = None
    active: Optional[bool] = None
    frequency: Optional[str] = None
    interval_count: Optional[int] = None
    start_date: Optional[date] = None


class RecurringTemplateResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    priority: str
    est_hours: Optional[float] = None
    active: bool
    frequency: str
    interval_count: int
    start_date: date
    last_fired: Optional[datetime] = None
    next_fire: Optional[datetime] = None

    model_config = {"from_attributes": True}
