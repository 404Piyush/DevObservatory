import base64
import json
import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, select, tuple_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import get_db
from app.deps import get_current_user, get_project_from_api_key, require_project_role
from app.limiter import limiter
from app.models import Event, Membership, OrgRole, Project, User
from app.queue import RabbitPublisher
from app.realtime import listen_for_project
from app.schemas import EventIn, EventOut, EventSearchResult

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
            "release": payload.release,
            "environment": payload.environment,
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



def _encode_cursor(received_at: datetime, event_id: int) -> str:
    raw = json.dumps({"t": received_at.isoformat(), "i": event_id}).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _decode_cursor(cursor: str) -> tuple[datetime, int]:
    padded = cursor + "=" * (-len(cursor) % 4)
    raw = base64.urlsafe_b64decode(padded.encode("ascii"))
    data = json.loads(raw)
    return datetime.fromisoformat(data["t"]), int(data["i"])


@router.get("/projects/{project_id}/events/search", response_model=EventSearchResult)
def search_events(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_project_role(OrgRole.viewer)),
    event_name: str | None = Query(default=None, max_length=200),
    user_id: str | None = Query(default=None, max_length=200),
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    cursor: str | None = Query(default=None),
):
    """Cursor-paginated event search with optional filters."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    conds = [Event.project_id == project_id]
    if event_name:
        conds.append(Event.event_name == event_name)
    if user_id:
        conds.append(Event.user_id == user_id)
    if from_ is not None:
        conds.append(Event.received_at >= from_)
    if to is not None:
        conds.append(Event.received_at <= to)
    if cursor:
        try:
            cur_t, cur_id = _decode_cursor(cursor)
        except (ValueError, KeyError, json.JSONDecodeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid cursor")
        # row strictly older than the cursor's (received_at, id) pair
        conds.append(
            tuple_(Event.received_at, Event.id) < tuple_(cur_t, cur_id)
        )

    # Fetch limit+1 to know if there's a next page without a second query.
    rows = db.scalars(
        select(Event)
        .where(and_(*conds))
        .order_by(Event.received_at.desc(), Event.id.desc())
        .limit(limit + 1)
    ).all()
    has_more = len(rows) > limit
    page = rows[:limit]
    next_cursor = (
        _encode_cursor(page[-1].received_at, page[-1].id) if has_more and page else None
    )
    return EventSearchResult(events=list(page), has_more=has_more, next_cursor=next_cursor)
