import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

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
    accepted_at: datetime | None


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


class EventOut(BaseModel):
    id: int
    project_id: uuid.UUID
    event_name: str
    user_id: str | None
    timestamp: datetime
    properties: dict
    received_at: datetime


class MetricsOverview(BaseModel):
    total_events: int
    events_per_minute: float
    active_projects: int
