import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_project_role
from app.models import Event, Membership, OrgRole, Project, User
from app.schemas import AnalyticsResponse, MetricsOverview, TimeBucket, TopEvent


router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/overview", response_model=MetricsOverview)
def overview(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MetricsOverview:
    org_ids = db.scalars(select(Membership.organization_id).where(Membership.user_id == user.id)).all()
    if not org_ids:
        return MetricsOverview(total_events=0, events_per_minute=0.0, active_projects=0)

    project_ids_subq = select(Project.id).where(Project.organization_id.in_(list(org_ids))).subquery()

    total_events = db.scalar(select(func.count()).select_from(Event).where(Event.project_id.in_(project_ids_subq))) or 0

    now = datetime.now(UTC)
    since = now - timedelta(minutes=1)
    last_minute = (
        db.scalar(
            select(func.count())
            .select_from(Event)
            .where(Event.project_id.in_(project_ids_subq), Event.received_at >= since)
        )
        or 0
    )

    active_since = now - timedelta(hours=24)
    active_projects = (
        db.scalar(
            select(func.count(func.distinct(Event.project_id)))
            .select_from(Event)
            .where(Event.project_id.in_(project_ids_subq), Event.received_at >= active_since)
        )
        or 0
    )

    return MetricsOverview(
        total_events=int(total_events),
        events_per_minute=float(last_minute),
        active_projects=int(active_projects),
    )


@router.get("/projects/{project_id}/analytics", response_model=AnalyticsResponse)
def project_analytics(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_project_role(OrgRole.viewer)),
) -> AnalyticsResponse:
    """Time-series (per-minute buckets) + top events for a project (last 24h)."""
    project = db.get(Project, project_id)
    if not project:
        return AnalyticsResponse(timeseries=[], top_events=[])

    now = datetime.now(UTC)
    since = now - timedelta(hours=24)

    # Postgres date_trunc('minute', ...) for bucketing; works because we run on Postgres.
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