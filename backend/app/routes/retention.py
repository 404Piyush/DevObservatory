"""Retention cohort heatmap endpoint."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_project_role
from app.models import Event, Membership, OrgRole, User
from app.retention import compute_retention
from app.schemas import RetentionCell, RetentionResponse


router = APIRouter(prefix="/retention", tags=["retention"])


@router.get("/projects/{project_id}/retention", response_model=RetentionResponse)
def project_retention(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_project_role(OrgRole.viewer)),
    event_name: str = Query(min_length=1, max_length=200),
    days: int = Query(default=14, ge=1, le=90),
    max_window: int = Query(default=14, ge=1, le=30),
):
    """Cohort retention: for the last `days` days, the share of users whose
    first `<event_name>` was on that day who remained active on day+0..N.
    """
    days = min(days, 90)
    max_window = min(max_window, 30)

    events = db.query(Event).filter(
        Event.project_id == project_id,
        Event.user_id.is_not(None),
    ).all()

    today = datetime.now(UTC).date()
    raw = compute_retention(
        events,
        event_name=event_name,
        today=today,
        days=days,
        max_window=max_window,
    )
    return RetentionResponse(
        event_name=raw["event_name"],
        days=raw["days"],
        max_window=raw["max_window"],
        cohorts=[RetentionCell(**c) for c in raw["cohorts"]],
    )