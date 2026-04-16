from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=8, max_length=256)


class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class UserUpdateRole(BaseModel):
    role: str  # "admin" or "user"


class UserUpdateActive(BaseModel):
    is_active: bool


# ---------------------------------------------------------------------------
# Ticket schemas
# ---------------------------------------------------------------------------

class TicketBase(BaseModel):
    title: str = Field(..., max_length=255)
    description: Optional[str] = Field(None, max_length=50000)
    due_date: Optional[date] = None
    priority: str = "default"
    est_hours: Optional[float] = None


class TicketCreate(TicketBase):
    related_ticket_ids: Optional[List[int]] = None
    profile_id: Optional[int] = None


class TicketUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=50000)
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
    profile_id: Optional[int] = None

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
    description: Optional[str] = Field(None, max_length=50000)
    priority: str = "default"
    est_hours: Optional[float] = None
    frequency: str
    interval_count: int = 1
    start_date: date
    due_in_days: Optional[int] = None


class RecurringTemplateCreate(RecurringTemplateBase):
    profile_id: Optional[int] = None


class RecurringTemplateUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=50000)
    priority: Optional[str] = None
    est_hours: Optional[float] = None
    active: Optional[bool] = None
    frequency: Optional[str] = None
    interval_count: Optional[int] = None
    start_date: Optional[date] = None
    due_in_days: Optional[int] = None


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
    profile_id: Optional[int] = None
    due_in_days: Optional[int] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Profile schemas
# ---------------------------------------------------------------------------

class ProfileCreate(BaseModel):
    name: str = Field(..., max_length=100)
    color: Optional[str] = "#6366f1"


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    color: Optional[str] = Field(None, max_length=7)
    imap_host: Optional[str] = Field(None, max_length=255)
    imap_port: Optional[int] = None
    imap_user: Optional[str] = None
    imap_password: Optional[str] = None
    imap_use_ssl: Optional[bool] = None
    email_enabled: Optional[bool] = None


class ProfileResponse(BaseModel):
    id: int
    name: str
    color: str
    user_id: Optional[int] = None
    imap_host: Optional[str] = None
    imap_port: Optional[int] = None
    imap_user: Optional[str] = None
    imap_use_ssl: bool
    email_enabled: bool
    has_password: bool = False

    model_config = {"from_attributes": True}
