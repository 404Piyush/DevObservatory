from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import Event, Membership, Project, User
from app.schemas import MetricsOverview


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

