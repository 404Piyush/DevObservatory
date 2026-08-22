"""add funnel_snapshots table

Revision ID: 0008_funnel_snapshots
Revises: 0007_events_release_environment
Create Date: 2026-08-22
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0008_funnel_snapshots"
down_revision = "0007_events_release_environment"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "funnel_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "funnel_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("funnels.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("snapshot_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("step_index", sa.Integer(), nullable=False),
        sa.Column("event_name", sa.String(length=200), nullable=False),
        sa.Column("reached", sa.Integer(), nullable=False),
        sa.Column("conversion_rate", sa.Float(), nullable=False),
        sa.UniqueConstraint(
            "funnel_id", "snapshot_date", "step_index", name="uq_funnel_snapshot_day_step"
        ),
    )
    op.create_index("ix_funnel_snapshots_funnel_id", "funnel_snapshots", ["funnel_id"])
    op.create_index(
        "ix_funnel_snapshots_snapshot_date", "funnel_snapshots", ["snapshot_date"]
    )


def downgrade() -> None:
    op.drop_index("ix_funnel_snapshots_snapshot_date", table_name="funnel_snapshots")
    op.drop_index("ix_funnel_snapshots_funnel_id", table_name="funnel_snapshots")
    op.drop_table("funnel_snapshots")