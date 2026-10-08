"""Add merchant-scoped dashboard notifications."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "3e7a9c1b5d20"
down_revision: Union[str, Sequence[str], None] = "c8e2f1a4b7d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("merchant_id", sa.Uuid(), nullable=False),
        sa.Column("environment", sa.String(length=10), nullable=False),
        sa.Column("notification_type", sa.String(length=80), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("resource_type", sa.String(length=80), nullable=True),
        sa.Column("resource_id", sa.String(length=255), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notifications_merchant_id", "notifications", ["merchant_id"], unique=False)
    op.create_index("ix_notifications_environment", "notifications", ["environment"], unique=False)
    op.create_index("ix_notifications_notification_type", "notifications", ["notification_type"], unique=False)
    op.create_index("ix_notifications_read_at", "notifications", ["read_at"], unique=False)
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"], unique=False)
    op.create_index("ix_notifications_merchant_environment_created_at", "notifications", ["merchant_id", "environment", "created_at"], unique=False)
    op.create_index("ix_notifications_merchant_environment_read_at", "notifications", ["merchant_id", "environment", "read_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_notifications_merchant_environment_read_at", table_name="notifications")
    op.drop_index("ix_notifications_merchant_environment_created_at", table_name="notifications")
    op.drop_index("ix_notifications_created_at", table_name="notifications")
    op.drop_index("ix_notifications_read_at", table_name="notifications")
    op.drop_index("ix_notifications_notification_type", table_name="notifications")
    op.drop_index("ix_notifications_environment", table_name="notifications")
    op.drop_index("ix_notifications_merchant_id", table_name="notifications")
    op.drop_table("notifications")
