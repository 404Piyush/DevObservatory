import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import get_db
from app.deps import get_current_user, get_project_from_api_key, require_project_role
from app.limiter import limiter
from app.models import Event, Membership, OrgRole, Project, User
from app.queue import RabbitPublisher
from app.realtime import listen_for_project
from app.schemas import EventIn, EventOut

router = APIRouter(tags=["events"])


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
    _membership: Membership = Depends(require_project_role(OrgRole.viewer)),
):
    events = db.scalars(
        select(Event).where(Event.project_id == project_id).order_by(Event.received_at.desc()).limit(200)
    ).all()
    return list(events)


@router.get("/projects/{project_id}/events/stream")
async def stream_events(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_project_role(OrgRole.viewer)),
):
    """Server-Sent Events feed for new rows in this project.

    The worker writes events and a Postgres trigger fires NOTIFY events_inserted;
    we LISTEN and re-query the latest row per project.
    """
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    import json as _json

    async def _gen():
        async with listen_for_project(settings.postgres_dsn, str(project_id)) as stream:
            # Initial comment so EventSource considers the connection open.
            yield ": connected\n\n"
            async for event in stream:
                yield f"data: {_json.dumps(event, default=str)}\n\n"

    return StreamingResponse(
        _gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
