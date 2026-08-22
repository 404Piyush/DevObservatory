"""Retention cohort heatmap endpoint."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_project_role
from app.models import Event, Membership, OrgRole, User
from app.retention import compute_retention
from app.schemas import RetentionCell, RetentionResponse


router = APIRouter(prefix="/retention", tags=["retention"])

# Cap rows read to keep the Python-side aggregation bounded. A full SQL
# rewrite (group-by min(received_at), then count active days) would remove
# this cap; for a portfolio piece 200k events is plenty for any demo and
# most production data over a 14-day cohort window.
RETENTION_EVENT_CAP = 200_000


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

    count = db.query(Event).filter(
        Event.project_id == project_id,
        Event.user_id.is_not(None),
    ).count()
    if count > RETENTION_EVENT_CAP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Project has {count} events; retention query is capped at "
                f"{RETENTION_EVENT_CAP} events. Reduce the cohort span or contact "
                "an admin to raise the limit."
            ),
        )

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