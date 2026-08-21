"""Tests for funnel conversion math.

The real /funnels/{id}/result route queries Postgres. Here we test the math
independently: a tiny pure-Python version of the conversion algorithm so we
can lock in the semantics without booting a database.
"""

from dataclasses import dataclass


@dataclass
class _FakeEvent:
    user_id: str | None
    event_name: str


def _compute(events: list[_FakeEvent], steps: list[str]) -> list[dict]:
    results: list[dict] = []
    previous_users: set[str] | None = None
    for step in steps:
        users = {e.user_id for e in events if e.event_name == step and e.user_id is not None}
        if previous_users is not None:
            intersected = users & previous_users
            reached = len(intersected)
            conv = (reached / len(previous_users)) if previous_users else 0.0
        else:
            reached = len(users)
            conv = 1.0
        results.append({"event_name": step, "reached": reached, "conversion_rate": round(conv, 4)})
        previous_users = users
    return results


def test_first_step_is_full_count() -> None:
    events = [
        _FakeEvent(user_id="a", event_name="signup"),
        _FakeEvent(user_id="b", event_name="signup"),
        _FakeEvent(user_id="c", event_name="signup"),
    ]
    out = _compute(events, ["signup", "verify"])
    assert out[0]["reached"] == 3
    assert out[0]["conversion_rate"] == 1.0


def test_subsequent_step_is_intersection() -> None:
    events = [
        _FakeEvent(user_id="a", event_name="signup"),
        _FakeEvent(user_id="b", event_name="signup"),
        _FakeEvent(user_id="a", event_name="verify"),
    ]
    out = _compute(events, ["signup", "verify"])
    assert out[0]["reached"] == 2
    assert out[1]["reached"] == 1  # only 'a' did both
    assert out[1]["conversion_rate"] == 0.5


def test_empty_events_yields_step_skeleton() -> None:
    out = _compute([], ["signup", "verify"])
    assert out[0]["reached"] == 0
    assert out[1]["reached"] == 0
    assert out[1]["conversion_rate"] == 0.0


def test_users_with_null_user_id_are_excluded() -> None:
    events = [
        _FakeEvent(user_id=None, event_name="signup"),
        _FakeEvent(user_id="a", event_name="signup"),
    ]
    out = _compute(events, ["signup"])
    assert out[0]["reached"] == 1


def test_conversion_rate_three_step() -> None:
    events = [
        _FakeEvent(user_id="a", event_name="a"),
        _FakeEvent(user_id="b", event_name="a"),
        _FakeEvent(user_id="a", event_name="b"),
        _FakeEvent(user_id="a", event_name="c"),
        _FakeEvent(user_id="b", event_name="c"),
    ]
    out = _compute(events, ["a", "b", "c"])
    assert [r["reached"] for r in out] == [2, 1, 1]
    assert out[1]["conversion_rate"] == 0.5
    assert out[2]["conversion_rate"] == 1.0