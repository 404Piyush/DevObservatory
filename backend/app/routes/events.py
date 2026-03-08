import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, get_project_from_api_key
from app.limiter import limiter
from app.models import Event, Membership, OrgRole, Project, User
from app.queue import RabbitPublisher
from app.schemas import EventIn, EventOut


router = APIRouter(tags=["events"])


def _require_project_view(db: Session, user_id: uuid.UUID, project: Project) -> None:
    membership = db.scalar(
        select(Membership).where(Membership.organization_id == project.organization_id, Membership.user_id == user_id)
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this organization")
    _ = membership.role in (OrgRole.viewer, OrgRole.developer, OrgRole.admin)


@router.post("/events", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("60/minute")
async def ingest_event(
    request: Request,
    payload: EventIn,
    project: Project = Depends(get_project_from_api_key),
) -> dict:
    publisher: RabbitPublisher = request.app.state.publisher
    if not publisher.ready():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Queue unavailable")
    await publisher.publish_event(
        {
            "project_id": str(project.id),
            "event_name": payload.event_name,
            "user_id": payload.user_id,
            "timestamp": payload.timestamp,
            "properties": payload.properties,
        }
    )
    return {"status": "queued"}


@router.get("/projects/{project_id}/events", response_model=list[EventOut])
def list_events(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    _require_project_view(db, user.id, project)
    events = db.scalars(
        select(Event).where(Event.project_id == project_id).order_by(Event.received_at.desc()).limit(200)
    ).all()
    return list(events)
