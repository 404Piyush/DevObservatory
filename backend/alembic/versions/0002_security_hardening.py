"""add invite expiration/revocation + session refresh family + last_used_at

Revision ID: 0002_security_hardening
Revises: 0001_initial
Create Date: 2026-08-22

"""
import sqlalchemy as sa
from alembic import op


revision = "0002_security_hardening"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Invite: expiration (7d from creation) and revocation.
    op.add_column(
        "invites",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now() + interval '7 days'")),
    )
    op.add_column("invites", sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True))

    # Session: refresh-token family for reuse detection + last_used_at tracking.
    op.add_column(
        "sessions",
        sa.Column("refresh_family_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column("sessions", sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True))

    # Backfill: existing sessions each get their own family id.
    op.execute("UPDATE sessions SET refresh_family_id = gen_random_uuid() WHERE refresh_family_id IS NULL")

    op.alter_column("sessions", "refresh_family_id", nullable=False)
    op.create_index("ix_sessions_refresh_family_id", "sessions", ["refresh_family_id"])


def downgrade() -> None:
    op.drop_index("ix_sessions_refresh_family_id", table_name="sessions")
    op.drop_column("sessions", "last_used_at")
    op.drop_column("sessions", "refresh_family_id")

    op.drop_column("invites", "revoked_at")
    op.drop_column("invites", "expires_at")