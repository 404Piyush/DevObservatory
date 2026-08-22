import secrets
import socket
import uuid
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, require_project_role
from app.models import Membership, OrgRole, Project, User, Webhook
from app.schemas import WebhookCreate, WebhookCreated, WebhookOut


router = APIRouter(tags=["webhooks"])


def _ip_is_public(host: str) -> bool:
    """Best-effort: reject SSRF targets (loopback, link-local, private)."""
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for family, _, _, _, sockaddr in infos:
        ip = sockaddr[0]
        if family == socket.AF_INET:
            octets = ip.split(".")
            if len(octets) != 4:
                return False
            a, b = int(octets[0]), int(octets[1])
            if a == 10:
                return False
            if a == 127:
                return False
            if a == 0:
                return False
            if a == 169 and b == 254:  # link-local incl. AWS metadata
                return False
            if a == 172 and 16 <= b <= 31:
                return False
            if a == 192 and b == 168:
                return False
            if a == 100 and 64 <= b <= 127:  # carrier-grade NAT
                return False
        elif family == socket.AF_INET6:
            # Reject loopback and link-local IPv6; allow public.
            if ip == "::1" or ip.startswith("fe80:") or ip.startswith("fc") or ip.startswith("fd"):
                return False
    return True


def _serialize(row: Webhook) -> WebhookOut:
    return WebhookOut(
        id=row.id,
        project_id=row.project_id,
        name=row.name,
        url=row.url,
        event_filter=row.event_filter,
        active=row.active,
        last_triggered_at=row.last_triggered_at,
        last_status_code=row.last_status_code,
        last_error=row.last_error,
        created_at=row.created_at,
    )


@router.get("/projects/{project_id}/webhooks", response_model=list[WebhookOut])
def list_webhooks(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_project_role(OrgRole.viewer)),
):
    rows = db.scalars(select(Webhook).where(Webhook.project_id == project_id).order_by(Webhook.created_at.desc())).all()
    return [_serialize(r) for r in rows]


@router.post(
    "/projects/{project_id}/webhooks",
    response_model=WebhookCreated,
    status_code=status.HTTP_201_CREATED,
)
def create_webhook(
    project_id: uuid.UUID,
    payload: WebhookCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_project_role(OrgRole.developer)),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # SSRF guard: resolve the URL's host and reject any IP in a private/
    # loopback/link-local range. Pydantic already validated the scheme.
    parsed = urlparse(payload.url)
    if not _ip_is_public(parsed.hostname or ""):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Webhook URL must resolve to a public IP address.",
        )

    secret = f"whsec_{secrets.token_urlsafe(24)}"
    row = Webhook(
        project_id=project_id,
        name=payload.name,
        url=payload.url,
        secret=secret,
        event_filter=payload.event_filter,
        active=payload.active,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return WebhookCreated(
        id=row.id,
        project_id=row.project_id,
        name=row.name,
        url=row.url,
        event_filter=row.event_filter,
        active=row.active,
        secret=row.secret,
        last_triggered_at=row.last_triggered_at,
        last_status_code=row.last_status_code,
        last_error=row.last_error,
        created_at=row.created_at,
    )


@router.delete(
    "/projects/{project_id}/webhooks/{webhook_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_webhook(
    project_id: uuid.UUID,
    webhook_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _membership: Membership = Depends(require_project_role(OrgRole.developer)),
):
    row = db.get(Webhook, webhook_id)
    if not row or row.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")
    db.execute(delete(Webhook).where(Webhook.id == webhook_id))
    db.commit()
    return None