"""Regression: list_events must serialize release/environment through Pydantic.

T2-4 added the release/environment columns to Event and EventOut but only
updated the explicit model_validate call in routes/events.py (search, export).
The original `return list(events)` path silently relied on FastAPI's
response_model coercion, which broke under Pydantic v2's stricter typing.

This test catches the regression by exercising the model_validate path.
We don't boot the FastAPI app — we just exercise the conversion that
list_events now performs.
"""

from datetime import UTC, datetime
from types import SimpleNamespace

from app.schemas import EventOut


def test_event_out_from_orm_object_with_release_env() -> None:
    """The Event ORM model has release and environment; EventOut.model_validate
    must accept them via from_attributes=True."""
    fake_event = SimpleNamespace(
        id=1,
        project_id="00000000-0000-0000-0000-000000000001",
        event_name="error",
        user_id="u_001",
        timestamp=datetime(2026, 8, 22, 10, 30, tzinfo=UTC),
        properties={"stack": "..."},
        received_at=datetime(2026, 8, 22, 10, 30, 1, tzinfo=UTC),
        release="devobs@1.0.0",
        environment="production",
    )
    out = EventOut.model_validate(fake_event)
    assert out.id == 1
    assert out.event_name == "error"
    assert out.release == "devobs@1.0.0"
    assert out.environment == "production"


def test_event_out_from_orm_object_without_release_env() -> None:
    """Older events (created before T2-4's migration) have null release/environment."""
    fake_event = SimpleNamespace(
        id=2,
        project_id="00000000-0000-0000-0000-000000000001",
        event_name="page_view",
        user_id=None,
        timestamp=datetime(2026, 8, 22, 10, 30, tzinfo=UTC),
        properties={},
        received_at=datetime(2026, 8, 22, 10, 30, 1, tzinfo=UTC),
        release=None,
        environment=None,
    )
    out = EventOut.model_validate(fake_event)
    assert out.release is None
    assert out.environment is None
    assert out.user_id is None
