"""add funnels table

Revision ID: 0004_funnels
Revises: 0003_event_notify_trigger
Create Date: 2026-08-22
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0004_funnels"
down_revision = "0003_event_notify_trigger"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "funnels",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column(
            "steps",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_funnels_project_id", "funnels", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_funnels_project_id", table_name="funnels")
    op.drop_table("funnels")