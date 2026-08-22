"""Tests for the funnel snapshot upsert logic.

The actual SQL upsert relies on Postgres' ON CONFLICT, which we don't
exercise here; instead we lock in the in-memory math that computes a
conversion row from a synthetic event stream.
"""

from dataclasses import dataclass
from datetime import UTC, datetime


@dataclass
class _FakeEvent:
    user_id: str | None
    event_name: str


def _compute_steps(events: list[_FakeEvent], steps: list[str]) -> list[dict]:
    previous_users: set[str] | None = None
    out: list[dict] = []
    for step in steps:
        users = {e.user_id for e in events if e.event_name == step and e.user_id is not None}
        if previous_users is not None:
            inter = users & previous_users
            reached = len(inter)
            conv = (reached / len(previous_users)) if previous_users else 0.0
        else:
            reached = len(users)
            conv = 1.0
        out.append({"step": step, "reached": reached, "conv": round(conv, 4)})
        previous_users = users
    return out


def test_snapshot_first_step_records_full_count() -> None:
    events = [_FakeEvent(user_id="a", event_name="s"), _FakeEvent(user_id="b", event_name="s")]
    out = _compute_steps(events, ["s", "t"])
    assert out[0]["reached"] == 2
    assert out[0]["conv"] == 1.0


def test_snapshot_records_intersection_for_subsequent_steps() -> None:
    events = [
        _FakeEvent(user_id="a", event_name="s"),
        _FakeEvent(user_id="b", event_name="s"),
        _FakeEvent(user_id="a", event_name="t"),
    ]
    out = _compute_steps(events, ["s", "t"])
    assert out[1]["reached"] == 1
    assert out[1]["conv"] == 0.5


def test_snapshot_with_empty_events_returns_step_skeleton() -> None:
    out = _compute_steps([], ["a", "b"])
    assert out[0]["reached"] == 0
    assert out[0]["conv"] == 1.0
    assert out[1]["reached"] == 0
    assert out[1]["conv"] == 0.0


def test_snapshot_rates_use_previous_users_count() -> None:
    events = [
        _FakeEvent(user_id="a", event_name="s"),
        _FakeEvent(user_id="b", event_name="s"),
        _FakeEvent(user_id="c", event_name="s"),
        _FakeEvent(user_id="a", event_name="t"),
    ]
    out = _compute_steps(events, ["s", "t"])
    # 3 users hit s; only 'a' hit t → 1/3 = 0.3333
    assert out[0]["reached"] == 3
    assert out[1]["reached"] == 1
    assert abs(out[1]["conv"] - 1 / 3) < 1e-4