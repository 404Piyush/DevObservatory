"""Public, read-only views that don't require auth.

Used for share-tokenized dashboards and for seeding demo data without
requiring the user to send events through the real ingest pipeline.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_api_key
from app.db import get_db
from app.deps import get_current_user, require_project_role
from app.models import ApiKey, Event, Membership, OrgRole, Project, ShareToken, User
from app.schemas import AnalyticsResponse, ProjectOut, TimeBucket, TopEvent


router = APIRouter(tags=["public"])


# -- Share tokens -----------------------------------------------------------


@router.post("/projects/{project_id}/share-tokens")
def create_share_token(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_project_role(OrgRole.admin)),
):
    """Mint a tokenized read-only URL for the project's dashboard."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    raw = secrets.token_urlsafe(24)
    token = ShareToken(
        project_id=project_id,
        token=raw,
        expires_at=datetime.now(UTC) + timedelta(days=30),
    )
    db.add(token)
    db.commit()
    return {"token": raw, "expires_at": token.expires_at.isoformat()}


@router.delete("/projects/{project_id}/share-tokens/{token}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_share_token(
    project_id: uuid.UUID,
    token: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_project_role(OrgRole.admin)),
):
    row = db.scalar(select(ShareToken).where(ShareToken.token == token, ShareToken.project_id == project_id))
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share token not found")
    row.revoked_at = datetime.now(UTC)
    db.add(row)
    db.commit()
    return None


@router.get("/share/{token}/project", response_model=ProjectOut)
def share_resolve_project(token: str, db: Session = Depends(get_db)):
    row = db.scalar(select(ShareToken).where(ShareToken.token == token))
    _validate_share(row)
    return db.get(Project, row.project_id)


@router.get("/share/{token}/analytics", response_model=AnalyticsResponse)
def share_analytics(token: str, db: Session = Depends(get_db)):
    row = db.scalar(select(ShareToken).where(ShareToken.token == token))
    _validate_share(row)
    project_id = row.project_id
    now = datetime.now(UTC)
    since = now - timedelta(hours=24)
    from sqlalchemy import func  # local import keeps module surface narrow

    bucket_expr = func.date_trunc("minute", Event.received_at).label("bucket")
    rows = db.execute(
        select(bucket_expr, func.count().label("count"))
        .where(Event.project_id == project_id, Event.received_at >= since)
        .group_by(bucket_expr)
        .order_by(bucket_expr)
    ).all()
    timeseries = [TimeBucket(bucket=r.bucket.isoformat(), count=int(r.count)) for r in rows]
    top_rows = db.execute(
        select(Event.event_name, func.count().label("count"))
        .where(Event.project_id == project_id, Event.received_at >= since)
        .group_by(Event.event_name)
        .order_by(func.count().desc())
        .limit(10)
    ).all()
    top_events = [TopEvent(event_name=r.event_name, count=int(r.count)) for r in top_rows]
    return AnalyticsResponse(timeseries=timeseries, top_events=top_events)


def _validate_share(row: ShareToken | None) -> None:
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid share token")
    now = datetime.now(UTC)
    if row.revoked_at is not None or (row.expires_at is not None and row.expires_at <= now):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Share token expired")


# -- Demo seed --------------------------------------------------------------


_DEMO_ORG_NAME = "DevObservatory Demo"
_DEMO_PROJECT_NAME = "demo-app"
_DEMO_KEY_NAME = "demo-ingest"


@router.post("/demo/seed")
def seed_demo(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create or refresh a demo org + project + API key + 30 days of synthetic events.

    Idempotent: re-running refreshes events without creating duplicates.
    """
    # Org
    from app.models import Organization  # local to avoid polluting top-level imports

    org = db.scalar(select(Organization).where(Organization.name == _DEMO_ORG_NAME))
    if org is None:
        org = Organization(name=_DEMO_ORG_NAME)
        db.add(org)
        db.flush()
        db.add(Membership(organization_id=org.id, user_id=user.id, role=OrgRole.admin))
    else:
        # Ensure caller is a member (admin)
        existing = db.scalar(
            select(Membership).where(Membership.organization_id == org.id, Membership.user_id == user.id)
        )
        if not existing:
            db.add(Membership(organization_id=org.id, user_id=user.id, role=OrgRole.admin))

    # Project
    project = db.scalar(
        select(Project).where(Project.organization_id == org.id, Project.name == _DEMO_PROJECT_NAME)
    )
    if project is None:
        project = Project(organization_id=org.id, name=_DEMO_PROJECT_NAME)
        db.add(project)
        db.flush()

    # API key
    api_key = db.scalar(select(ApiKey).where(ApiKey.project_id == project.id, ApiKey.name == _DEMO_KEY_NAME))
    created_key_plain: str | None = None
    if api_key is None:
        plain = f"do_{secrets.token_urlsafe(40)}"
        api_key = ApiKey(project_id=project.id, name=_DEMO_KEY_NAME, key_hash=hash_api_key(plain))
        db.add(api_key)
        db.flush()
        created_key_plain = plain

    db.commit()

    # Seed events (best-effort, sync SQLAlchemy bulk insert).
    _seed_events(db, project.id)

    return {
        "org_id": str(org.id),
        "project_id": str(project.id),
        "api_key": created_key_plain,  # only present on first creation
        "already_had_key": created_key_plain is None,
    }


_DEMO_EVENT_NAMES = [
    ("page_view", 0.55),
    ("button_click", 0.20),
    ("signup_started", 0.10),
    ("signup_completed", 0.07),
    ("email_verified", 0.05),
    ("first_purchase", 0.03),
]


def _seed_events(db: Session, project_id: uuid.UUID) -> None:
    """Insert ~3,000 synthetic events spread over the last 30 days."""
    import random

    from sqlalchemy import insert

    events_table = Event.__table__
    now = datetime.now(UTC)
    rows: list[dict] = []
    rng = random.Random(42)
    for _ in range(3000):
        # weighted choice
        r = rng.random()
        acc = 0.0
        event_name = _DEMO_EVENT_NAMES[-1][0]
        for name, weight in _DEMO_EVENT_NAMES:
            acc += weight
            if r <= acc:
                event_name = name
                break
        age_minutes = rng.randint(0, 30 * 24 * 60)
        ts = now - timedelta(minutes=age_minutes)
        user_id = f"u_{rng.randint(1, 400)}"
        rows.append(
            {
                "project_id": project_id,
                "event_name": event_name,
                "user_id": user_id,
                "timestamp": ts,
                "properties": {},
                "received_at": ts,
            }
        )
    if rows:
        db.execute(insert(events_table), rows)
        db.commit()