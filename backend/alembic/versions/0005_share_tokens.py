"""add share_tokens table

Revision ID: 0005_share_tokens
Revises: 0004_funnels
Create Date: 2026-08-22
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0005_share_tokens"
down_revision = "0004_funnels"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "share_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("token", name="uq_share_tokens_token"),
    )
    op.create_index("ix_share_tokens_project_id", "share_tokens", ["project_id"])
    op.create_index("ix_share_tokens_token", "share_tokens", ["token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_share_tokens_token", table_name="share_tokens")
    op.drop_index("ix_share_tokens_project_id", table_name="share_tokens")
    op.drop_table("share_tokens")