import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_project_role
from app.models import Event, Funnel, FunnelSnapshot, Membership, OrgRole, Project, User
from app.schemas import (
    FunnelCreate,
    FunnelOut,
    FunnelResult,
    FunnelStepResult,
    FunnelTrendPoint,
    FunnelTrendResponse,
)


router = APIRouter(tags=["funnels"])


def _serialize(funnel: Funnel) -> FunnelOut:
    return FunnelOut(
        id=funnel.id,
        project_id=funnel.project_id,
        name=funnel.name,
        steps=list(funnel.steps or []),
        created_at=funnel.created_at,
    )


@router.get("/projects/{project_id}/funnels", response_model=list[FunnelOut])
def list_funnels(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_project_role(OrgRole.viewer)),
):
    funnels = db.scalars(select(Funnel).where(Funnel.project_id == project_id).order_by(Funnel.created_at.desc())).all()
    return [_serialize(f) for f in funnels]


@router.post("/projects/{project_id}/funnels", response_model=FunnelOut, status_code=status.HTTP_201_CREATED)
def create_funnel(
    project_id: uuid.UUID,
    payload: FunnelCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_project_role(OrgRole.developer)),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    funnel = Funnel(project_id=project_id, name=payload.name, steps=payload.steps)
    db.add(funnel)
    db.commit()
    db.refresh(funnel)
    return _serialize(funnel)


@router.delete("/projects/{project_id}/funnels/{funnel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_funnel(
    project_id: uuid.UUID,
    funnel_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_project_role(OrgRole.developer)),
):
    funnel = db.get(Funnel, funnel_id)
    if not funnel or funnel.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Funnel not found")
    db.execute(delete(Funnel).where(Funnel.id == funnel_id))
    db.commit()
    return None


@router.get("/projects/{project_id}/funnels/{funnel_id}/result", response_model=FunnelResult)
def funnel_result(
    project_id: uuid.UUID,
    funnel_id: uuid.UUID,
    window_hours: int = 24,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_project_role(OrgRole.viewer)),
):
    """Compute per-step conversion for the funnel.

    For each step we count distinct user_ids that performed that event in the
    last ``window_hours``. Conversion rate = reached[step] / reached[step-1].
    """
    funnel = db.get(Funnel, funnel_id)
    if not funnel or funnel.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Funnel not found")

    window_hours = max(1, min(window_hours, 24 * 30))
    since = datetime.now(UTC) - timedelta(hours=window_hours)
    steps_in: list[str] = list(funnel.steps or [])
    if len(steps_in) < 2:
        return FunnelResult(funnel_id=funnel.id, window_hours=window_hours, steps=[])

    results: list[FunnelStepResult] = []
    previous_users: set[str] | None = None
    for step in steps_in:
        users = set(
            db.scalars(
                select(Event.user_id).where(
                    Event.project_id == project_id,
                    Event.event_name == step,
                    Event.received_at >= since,
                    Event.user_id.is_not(None),
                )
            ).all()
        )
        if previous_users is not None:
            intersected = users & previous_users
            reached = len(intersected)
            conv = (reached / len(previous_users)) if previous_users else 0.0
        else:
            reached = len(users)
            conv = 1.0
        results.append(FunnelStepResult(event_name=step, reached=reached, conversion_rate=round(conv, 4)))
        previous_users = users

    return FunnelResult(funnel_id=funnel.id, window_hours=window_hours, steps=results)



def _compute_funnel_rows(db: Session, funnel: Funnel, since: datetime) -> list[FunnelStepResult]:
    """Compute step-by-step conversion since ``since``."""
    steps_in: list[str] = list(funnel.steps or [])
    if len(steps_in) < 2:
        return []
    results: list[FunnelStepResult] = []
    previous_users: set[str] | None = None
    for step in steps_in:
        users = set(
            db.scalars(
                select(Event.user_id).where(
                    Event.project_id == funnel.project_id,
                    Event.event_name == step,
                    Event.received_at >= since,
                    Event.user_id.is_not(None),
                )
            ).all()
        )
        if previous_users is not None:
            intersected = users & previous_users
            reached = len(intersected)
            conv = (reached / len(previous_users)) if previous_users else 0.0
        else:
            reached = len(users)
            conv = 1.0
        results.append(FunnelStepResult(event_name=step, reached=reached, conversion_rate=round(conv, 4)))
        previous_users = users
    return results


@router.post(
    "/projects/{project_id}/funnels/{funnel_id}/snapshot",
    response_model=FunnelResult,
)
def snapshot_funnel(
    project_id: uuid.UUID,
    funnel_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_project_role(OrgRole.viewer)),
):
    """Compute today's funnel and upsert into funnel_snapshots."""
    funnel = db.get(Funnel, funnel_id)
    if not funnel or funnel.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Funnel not found")

    now = datetime.now(UTC)
    since = now - timedelta(hours=24)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    rows = _compute_funnel_rows(db, funnel, since)

    # Upsert by (funnel_id, snapshot_date, step_index).
    for idx, row in enumerate(rows):
        stmt = pg_insert(FunnelSnapshot).values(
            funnel_id=funnel_id,
            snapshot_date=today,
            step_index=idx,
            event_name=row.event_name,
            reached=row.reached,
            conversion_rate=row.conversion_rate,
        ).on_conflict_do_update(
            index_elements=["funnel_id", "snapshot_date", "step_index"],
            set_={"reached": row.reached, "conversion_rate": row.conversion_rate},
        )
        db.execute(stmt)
    db.commit()

    return FunnelResult(funnel_id=funnel.id, window_hours=24, steps=rows)


@router.get(
    "/projects/{project_id}/funnels/{funnel_id}/trend",
    response_model=FunnelTrendResponse,
)
def funnel_trend(
    project_id: uuid.UUID,
    funnel_id: uuid.UUID,
    days: int = Query(default=14, ge=1, le=90),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_project_role(OrgRole.viewer)),
):
    """Return per-day per-step counts from funnel_snapshots for trend rendering."""
    funnel = db.get(Funnel, funnel_id)
    if not funnel or funnel.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Funnel not found")

    today = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    since = today - timedelta(days=days - 1)

    rows = db.execute(
        select(FunnelSnapshot)
        .where(
            FunnelSnapshot.funnel_id == funnel_id,
            FunnelSnapshot.snapshot_date >= since,
        )
        .order_by(FunnelSnapshot.snapshot_date.asc(), FunnelSnapshot.step_index.asc())
    ).scalars().all()

    by_date: dict[str, list[FunnelStepResult]] = {}
    for row in rows:
        key = row.snapshot_date.date().isoformat()
        by_date.setdefault(key, []).append(
            FunnelStepResult(
                event_name=row.event_name,
                reached=row.reached,
                conversion_rate=row.conversion_rate,
            )
        )

    points: list[FunnelTrendPoint] = []
    for offset in range(days):
        d = (since + timedelta(days=offset)).date().isoformat()
        points.append(FunnelTrendPoint(snapshot_date=d, steps=by_date.get(d, [])))

    return FunnelTrendResponse(funnel_id=funnel_id, days=days, points=points)
