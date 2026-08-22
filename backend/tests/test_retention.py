"""Tests for the retention cohort computation."""

import datetime as _dt
from dataclasses import dataclass

from app.retention import compute_retention


@dataclass
class _Ev:
    event_name: str
    user_id: str
    received_at: _dt.datetime


def test_single_user_first_seen_today_retention_is_100_then_drops() -> None:
    today = _dt.date(2026, 8, 22)
    events = [
        _Ev("signup", "u1", _dt.datetime(2026, 8, 20, 10, 0)),
        _Ev("page_view", "u1", _dt.datetime(2026, 8, 20, 11, 0)),
        _Ev("page_view", "u1", _dt.datetime(2026, 8, 22, 11, 0)),
    ]
    # 3 days => cohorts [8/20, 8/21, 8/22]; 4 offsets [day+0..day+3]
    out = compute_retention(events, event_name="signup", today=today, days=3, max_window=4)
    assert out["event_name"] == "signup"
    assert out["days"] == 3
    first = out["cohorts"][0]
    assert first["cohort_day"] == "2026-08-20"
    assert first["cohort_size"] == 1
    assert first["retention"][0] == 1.0
    # retention[2] (k=2 days after) should be 1.0 (still active on 8/22)
    assert first["retention"][2] == 1.0
    # retention[3] should be 0.0 (no activity on 8/23, which is in the future)
    assert first["retention"][3] == 0.0


def test_two_user_cohort_shares_correctly() -> None:
    today = _dt.date(2026, 8, 22)
    events = [
        _Ev("signup", "u1", _dt.datetime(2026, 8, 21, 9, 0)),
        _Ev("signup", "u2", _dt.datetime(2026, 8, 21, 9, 0)),
        _Ev("page_view", "u1", _dt.datetime(2026, 8, 22, 9, 0)),  # day+1: only u1
    ]
    out = compute_retention(events, event_name="signup", today=today, days=2, max_window=3)
    first = out["cohorts"][0]
    assert first["cohort_day"] == "2026-08-21"
    assert first["cohort_size"] == 2
    assert first["retention"][0] == 1.0
    assert first["retention"][1] == 0.5  # 1 of 2


def test_first_event_wins_for_cohort_assignment() -> None:
    today = _dt.date(2026, 8, 22)
    # u1 first signups on 8/15, then again on 8/20 — should be cohort 8/15
    events = [
        _Ev("signup", "u1", _dt.datetime(2026, 8, 15, 9, 0)),
        _Ev("signup", "u1", _dt.datetime(2026, 8, 20, 9, 0)),
    ]
    out = compute_retention(events, event_name="signup", today=today, days=10, max_window=3)
    # Find the cohort row for 2026-08-15.
    cohort = next(c for c in out["cohorts"] if c["cohort_day"] == "2026-08-15")
    assert cohort["cohort_size"] == 1


def test_event_filter_excludes_non_matching_events() -> None:
    today = _dt.date(2026, 8, 22)
    events = [
        _Ev("page_view", "u1", _dt.datetime(2026, 8, 20, 9, 0)),  # ignored for cohort
        _Ev("signup", "u1", _dt.datetime(2026, 8, 21, 9, 0)),  # u1 cohort = 8/21
    ]
    out = compute_retention(events, event_name="signup", today=today, days=3, max_window=2)
    cohort_20 = next(c for c in out["cohorts"] if c["cohort_day"] == "2026-08-20")
    assert cohort_20["cohort_size"] == 0


def test_empty_events_yields_zero_size_cohorts() -> None:
    today = _dt.date(2026, 8, 22)
    out = compute_retention([], event_name="signup", today=today, days=3, max_window=3)
    assert all(c["cohort_size"] == 0 for c in out["cohorts"])
    assert all(all(r == 0.0 for r in c["retention"]) for c in out["cohorts"])