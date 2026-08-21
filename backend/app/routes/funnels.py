import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_project_role
from app.models import Event, Funnel, Membership, OrgRole, Project, User
from app.schemas import FunnelCreate, FunnelOut, FunnelResult, FunnelStepResult


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