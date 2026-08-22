"""Retention cohort heatmap computation.

For each cohort day (last `days` days), find users whose FIRST event with
the matching ``event_name`` occurred on that day, then for each offset
``k`` in ``[0..max_window-1]`` compute the share of those users who had ANY
event on ``day + k``.

Returns:
    {
        "event_name": str,
        "days": int,
        "max_window": int,
        "cohorts": [
            {"cohort_day": "YYYY-MM-DD", "cohort_size": N,
             "retention": [1.0, 0.4, 0.2, ...]},
            ...
        ]
    }

The math is pure-Python so we can unit-test without a database.
"""
from __future__ import annotations

import datetime as _dt
from collections import defaultdict
from typing import Any, Iterable


def _event_dt(value: Any) -> _dt.date | None:
    """Accept datetime or ISO string; return the date or None if invalid."""
    if isinstance(value, _dt.datetime):
        return value.date()
    if isinstance(value, str):
        try:
            return _dt.datetime.fromisoformat(value.replace("Z", "+00:00")).date()
        except ValueError:
            return None
    return None


def compute_retention(
    events: Iterable[Any],
    *,
    event_name: str,
    today: _dt.date,
    days: int = 14,
    max_window: int = 14,
) -> dict[str, Any]:
    """events: iterable of objects with .event_name, .user_id, .received_at"""
    # First-event date per user, restricted to event_name.
    first_seen: dict[str, _dt.date] = {}
    for ev in events:
        if getattr(ev, "event_name", None) != event_name:
            continue
        uid = getattr(ev, "user_id", None)
        if uid is None:
            continue
        d = _event_dt(getattr(ev, "received_at", None))
        if d is None:
            continue
        existing = first_seen.get(uid)
        if existing is None or d < existing:
            first_seen[uid] = d

    # Group user_ids by their cohort day.
    cohort_users: dict[_dt.date, set[str]] = defaultdict(set)
    for uid, d in first_seen.items():
        cohort_users[d].add(uid)

    # Activity date per user (any event).
    activity: dict[str, set[_dt.date]] = defaultdict(set)
    for ev in events:
        uid = getattr(ev, "user_id", None)
        if uid is None:
            continue
        d = _event_dt(getattr(ev, "received_at", None))
        if d is None:
            continue
        activity[uid].add(d)

    # Build cohort rows for the most recent `days` days.
    rows: list[dict[str, Any]] = []
    for offset in range(days):
        cohort_day = today - _dt.timedelta(days=days - 1 - offset)
        users = cohort_users.get(cohort_day, set())
        size = len(users)
        retention: list[float] = []
        if size > 0:
            for k in range(max_window):
                # Skip k=0 (always 1.0 by definition).
                if k == 0:
                    retention.append(1.0)
                    continue
                target = cohort_day + _dt.timedelta(days=k)
                # Only count if target <= today (no future-dated retention).
                if target > today:
                    retention.append(0.0)
                    continue
                active = sum(1 for uid in users if target in activity[uid])
                retention.append(round(active / size, 4))
        else:
            retention = [0.0] * max_window
        rows.append(
            {
                "cohort_day": cohort_day.isoformat(),
                "cohort_size": size,
                "retention": retention,
            }
        )

    return {
        "event_name": event_name,
        "days": days,
        "max_window": max_window,
        "cohorts": rows,
    }