"""Async Postgres LISTEN consumer for SSE event streaming.

The worker writes to ``events`` and a trigger fires ``NOTIFY events_inserted``
with the new ``project_id`` as payload. We open a dedicated async psycopg
connection per SSE stream, LISTEN, and yield notifications.

When a notification arrives we re-query the most-recent event for the
project and yield its row. This is simpler and correct under concurrency.
"""
from __future__ import annotations

import asyncio
import contextlib
from collections.abc import AsyncIterator
from typing import Any

import psycopg


def _libpq_dsn(sqlalchemy_dsn: str) -> str:
    """Strip the SQLAlchemy ``+psycopg`` driver suffix for libpq."""
    return sqlalchemy_dsn.replace("postgresql+psycopg://", "postgresql://")


async def _latest_event(conn: psycopg.AsyncConnection, project_id: str) -> dict[str, Any] | None:
    async with conn.cursor() as cur:
        await cur.execute(
            """
            SELECT id, project_id, event_name, user_id, timestamp, properties, received_at
            FROM events
            WHERE project_id = %s
            ORDER BY received_at DESC, id DESC
            LIMIT 1
            """,
            (project_id,),
        )
        row = await cur.fetchone()
        if row is None:
            return None
        cols = ("id", "project_id", "event_name", "user_id", "timestamp", "properties", "received_at")
        record = dict(zip(cols, row, strict=False))
        if isinstance(record.get("properties"), str):
            import json

            try:
                record["properties"] = json.loads(record["properties"])
            except json.JSONDecodeError:
                pass
        return record


@contextlib.asynccontextmanager
async def listen_for_project(dsn: str, project_id: str) -> AsyncIterator[AsyncIterator[dict[str, Any]]]:
    """Yield an async iterator of new event rows for ``project_id``.

    The outer context cleans up the LISTEN connection when the SSE stream
    is closed.
    """
    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue(maxsize=1024)
    stop = asyncio.Event()

    async def _run() -> None:
        backoff = 0.5
        while not stop.is_set():
            try:
                async with await psycopg.AsyncConnection.connect(_libpq_dsn(dsn), autocommit=True) as conn:
                    await conn.execute("LISTEN events_inserted")
                    gen = conn.notifies()
                    async for notify in gen:
                        if stop.is_set():
                            return
                        if str(notify.payload) != str(project_id):
                            continue
                        event = await _latest_event(conn, project_id)
                        if event is not None:
                            await queue.put(event)
                        else:
                            await queue.put({"project_id": project_id})
                    return  # gen exited
            except asyncio.CancelledError:
                return
            except Exception:
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 5.0)

    task = asyncio.create_task(_run())

    async def _iterator() -> AsyncIterator[dict[str, Any]]:
        try:
            while not stop.is_set():
                item = await queue.get()
                if item is None:
                    return
                yield item
        finally:
            stop.set()

    try:
        yield _iterator()
    finally:
        stop.set()
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await task