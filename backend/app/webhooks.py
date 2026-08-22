"""Outbound webhook delivery.

The worker calls `dispatch_for_event` after persisting each event. The
function evaluates active webhooks for the project, signs the payload with
HMAC-SHA256 using each webhook's per-row secret, and POSTs asynchronously.

Delivery is fire-and-forget by design — a slow or failing receiver must
not block ingestion. Errors are recorded on the webhook row for visibility
in the UI.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
from datetime import UTC, datetime

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Webhook

logger = logging.getLogger(__name__)

SIGNATURE_HEADER = "X-DevObservatory-Signature"
DELIVERY_TIMEOUT_SECONDS = 5.0


def _sign(secret: str, body: bytes) -> str:
    return "sha256=" + hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def _matches(webhook: Webhook, event_name: str) -> bool:
    if not webhook.active:
        return False
    if webhook.event_filter is None:
        return True
    return webhook.event_filter == event_name


def _serialize_event(project_id: str, event_name: str, user_id: str | None, properties: dict, timestamp) -> dict:
    return {
        "project_id": project_id,
        "event_name": event_name,
        "user_id": user_id,
        "timestamp": timestamp.isoformat() if hasattr(timestamp, "isoformat") else str(timestamp),
        "properties": properties or {},
    }


async def _deliver(client: httpx.AsyncClient, webhook: Webhook, payload: dict) -> tuple[int | None, str | None]:
    body = json.dumps(payload, default=str).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        SIGNATURE_HEADER: _sign(webhook.secret, body),
        "User-Agent": "DevObservatory-Webhook/1.0",
    }
    try:
        resp = await client.post(webhook.url, content=body, headers=headers, timeout=DELIVERY_TIMEOUT_SECONDS)
        return resp.status_code, None if resp.is_success else resp.text[:500]
    except (httpx.HTTPError, asyncio.TimeoutError) as exc:
        return None, f"{type(exc).__name__}: {exc}"


async def dispatch_for_event_async(
    db_factory,
    project_id: str,
    event_name: str,
    user_id: str | None,
    properties: dict,
    timestamp,
) -> None:
    """Open a fresh DB session, evaluate webhooks, POST, then write results back."""
    with db_factory() as db:
        webhooks = db.scalars(
            select(Webhook).where(Webhook.project_id == project_id, Webhook.active.is_(True))
        ).all()
    if not webhooks:
        return

    matching = [w for w in webhooks if _matches(w, event_name)]
    if not matching:
        return

    payload = _serialize_event(str(project_id), event_name, user_id, properties, timestamp)
    now = datetime.now(UTC)

    async with httpx.AsyncClient() as client:
        for w in matching:
            status_code, error = await _deliver(client, w, payload)
            with db_factory() as db:
                row = db.get(Webhook, w.id)
                if row is None:
                    continue
                row.last_triggered_at = now
                row.last_status_code = status_code
                row.last_error = error
                db.add(row)
                db.commit()


def dispatch_for_event(
    db: Session,
    project_id: str,
    event_name: str,
    user_id: str | None,
    properties: dict,
    timestamp,
) -> None:
    """Sync wrapper used by the worker.

    Schedules the async dispatcher on the worker's event loop so a slow
    receiver never blocks the consume loop.
    """
    from app.db import SessionLocal

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = None

    coro = dispatch_for_event_async(SessionLocal, project_id, event_name, user_id, properties, timestamp)

    if loop is not None and loop.is_running():
        loop.create_task(coro)
    else:
        # Called from sync code without a running loop (e.g. tests).
        try:
            asyncio.run(coro)
        except Exception as exc:
            logger.warning("webhook dispatch failed: %s", exc)