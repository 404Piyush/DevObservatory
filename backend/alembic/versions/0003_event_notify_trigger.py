"""add NOTIFY trigger so SSE consumers can wake on new events

Revision ID: 0003_event_notify_trigger
Revises: 0002_security_hardening
Create Date: 2026-08-22

A single-row INSERT emits a Postgres NOTIFY on the ``events_inserted``
channel. The payload is the project_id (text), so SSE consumers can
filter by project without parsing JSON. The trigger uses pg_notify()
inside the same transaction as the INSERT so there's no race.
"""
from alembic import op


revision = "0003_event_notify_trigger"
down_revision = "0002_security_hardening"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION notify_event_inserted() RETURNS trigger AS $$
        BEGIN
            PERFORM pg_notify('events_inserted', NEW.project_id::text);
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        DROP TRIGGER IF EXISTS events_inserted_notify ON events;
        CREATE TRIGGER events_inserted_notify
        AFTER INSERT ON events
        FOR EACH ROW
        EXECUTE FUNCTION notify_event_inserted();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS events_inserted_notify ON events;")
    op.execute("DROP FUNCTION IF EXISTS notify_event_inserted();")