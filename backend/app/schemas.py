import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models import OrgRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    name: str | None = Field(default=None, max_length=200)


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    name: str | None
    created_at: datetime


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)


class OrganizationOut(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime


class MembershipOut(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    user_id: uuid.UUID
    role: OrgRole
    created_at: datetime


class InviteCreate(BaseModel):
    email: EmailStr
    role: OrgRole = OrgRole.viewer


class InviteOut(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    email: EmailStr
    role: OrgRole
    created_at: datetime
    expires_at: datetime
    accepted_at: datetime | None
    revoked_at: datetime | None


class InviteCreated(InviteOut):
    token: str


class InviteAccept(BaseModel):
    token: str = Field(min_length=16, max_length=500)


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)


class ProjectOut(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    created_at: datetime


class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)


class ApiKeyOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    created_at: datetime
    revoked_at: datetime | None
    last_used_at: datetime | None


class ApiKeyCreated(ApiKeyOut):
    api_key: str


class EventIn(BaseModel):
    event_name: str = Field(min_length=1, max_length=200)
    user_id: str | None = Field(default=None, max_length=200)
    timestamp: datetime
    properties: dict = Field(default_factory=dict)
    release: str | None = Field(default=None, max_length=200)
    environment: str | None = Field(default=None, max_length=64)


class EventOut(BaseModel):
    id: int
    project_id: uuid.UUID
    event_name: str
    user_id: str | None
    timestamp: datetime
    properties: dict
    received_at: datetime
    release: str | None
    environment: str | None


class EventSearchResult(BaseModel):
    events: list[EventOut]
    has_more: bool
    next_cursor: str | None


class MetricsOverview(BaseModel):
    total_events: int
    events_per_minute: float
    active_projects: int


class TimeBucket(BaseModel):
    bucket: str  # ISO timestamp
    count: int


class TopEvent(BaseModel):
    event_name: str
    count: int


class AnalyticsResponse(BaseModel):
    timeseries: list[TimeBucket]
    top_events: list[TopEvent]


class FunnelCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    steps: list[str] = Field(min_length=2, max_length=10)


class FunnelOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    steps: list[str]
    created_at: datetime


class FunnelStepResult(BaseModel):
    event_name: str
    reached: int
    conversion_rate: float  # 0..1, ratio of users that hit this step vs the previous


class WebhookCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    url: str = Field(min_length=8, max_length=2048)
    event_filter: str | None = Field(default=None, max_length=200)
    active: bool = True

    @field_validator("url")
    @classmethod
    def _url_must_be_http(cls, v: str) -> str:
        """Enforce http(s) scheme and reject obvious SSRF targets.

        The route layer does an additional private-IP check; this catches
        the obvious shape mistakes (file://, javascript:, no scheme).
        """
        from urllib.parse import urlparse

        parsed = urlparse(v)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("url must start with http:// or https://")
        if not parsed.hostname:
            raise ValueError("url must include a hostname")
        return v


class WebhookCreated(WebhookCreate):
    """Returned once after creation; includes the secret so the user can
    configure the receiver to verify HMAC signatures."""

    id: uuid.UUID
    project_id: uuid.UUID
    secret: str
    last_triggered_at: datetime | None
    last_status_code: int | None
    last_error: str | None
    created_at: datetime


class WebhookOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    url: str
    event_filter: str | None
    active: bool
    last_triggered_at: datetime | None
    last_status_code: int | None
    last_error: str | None
    created_at: datetime


class FunnelResult(BaseModel):
    funnel_id: uuid.UUID
    window_hours: int
    steps: list[FunnelStepResult]


class FunnelTrendPoint(BaseModel):
    snapshot_date: str  # ISO date (YYYY-MM-DD)
    steps: list[FunnelStepResult]


class FunnelTrendResponse(BaseModel):
    funnel_id: uuid.UUID
    days: int
    points: list[FunnelTrendPoint]


class RetentionCell(BaseModel):
    """A single cohort row's retention rates per offset (0..max_window)."""

    cohort_day: str  # ISO date (YYYY-MM-DD)
    cohort_size: int
    retention: list[float]  # retention[k] = % of cohort active on day+k


class RetentionResponse(BaseModel):
    event_name: str
    days: int  # number of cohorts returned
    max_window: int  # number of retention offsets (e.g. 14)
    cohorts: list[RetentionCell]
