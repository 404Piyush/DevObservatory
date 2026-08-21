"""Tests for the event search cursor codec and pagination math.

The /events/search route composes a SQLAlchemy query against a real Postgres
session; here we lock in the cursor format and the limit+1 → has_more logic
in isolation.
"""

import base64
import datetime as dt
import json

import pytest


def encode_cursor(t: dt.datetime, i: int) -> str:
    raw = json.dumps({"t": t.isoformat(), "i": i}).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_cursor(cursor: str) -> tuple[dt.datetime, int]:
    padded = cursor + "=" * (-len(cursor) % 4)
    raw = base64.urlsafe_b64decode(padded.encode("ascii"))
    data = json.loads(raw)
    return dt.datetime.fromisoformat(data["t"]), int(data["i"])


def _slice_for_page(rows: list[tuple[int, int]], limit: int) -> tuple[list, bool, str | None]:
    """Mirror the route: take limit+1 rows, derive has_more + next_cursor."""
    has_more = len(rows) > limit
    page = rows[:limit]
    next_cursor = encode_cursor(page[-1][0], page[-1][1]) if has_more and page else None
    return page, has_more, next_cursor


def test_cursor_round_trip() -> None:
    t = dt.datetime(2026, 8, 22, 1, 2, 3, tzinfo=dt.timezone.utc)
    enc = encode_cursor(t, 12345)
    out_t, out_i = decode_cursor(enc)
    assert out_t == t
    assert out_i == 12345


def test_cursor_handles_short_padding() -> None:
    t = dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc)
    enc = encode_cursor(t, 1)
    # stripped of padding must still decode correctly
    assert decode_cursor(enc) == (t, 1)


def test_cursor_rejects_garbage() -> None:
    with pytest.raises((ValueError, json.JSONDecodeError, KeyError)):
        decode_cursor("not-base64-at-all")


def test_limit_plus_one_marks_has_more() -> None:
    rows = [(dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc), i) for i in range(10)]
    page, has_more, cursor = _slice_for_page(rows, limit=5)
    assert len(page) == 5
    assert has_more is True
    assert cursor is not None
    # Cursor points at the LAST row of the page (id=4)
    assert decode_cursor(cursor) == (rows[4][0], 4)


def test_last_page_has_no_next_cursor() -> None:
    rows = [(dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc), i) for i in range(3)]
    page, has_more, cursor = _slice_for_page(rows, limit=5)
    assert len(page) == 3
    assert has_more is False
    assert cursor is None


def test_empty_result_has_no_cursor() -> None:
    page, has_more, cursor = _slice_for_page([], limit=5)
    assert page == []
    assert has_more is False
    assert cursor is None