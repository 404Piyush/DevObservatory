"""add release + environment to events

Revision ID: 0007_events_release_environment
Revises: 0006_webhooks
Create Date: 2026-08-22
"""
import sqlalchemy as sa
from alembic import op


revision = "0007_events_release_environment"
down_revision = "0006_webhooks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("events", sa.Column("release", sa.String(length=200), nullable=True))
    op.add_column("events", sa.Column("environment", sa.String(length=64), nullable=True))
    op.create_index("ix_events_release", "events", ["release"])
    op.create_index("ix_events_environment", "events", ["environment"])


def downgrade() -> None:
    op.drop_index("ix_events_environment", table_name="events")
    op.drop_index("ix_events_release", table_name="events")
    op.drop_column("events", "environment")
    op.drop_column("events", "release")