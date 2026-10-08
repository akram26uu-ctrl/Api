"""add webhook processing lease

Revision ID: e5b7c9d1a2f4
Revises: c4d8e2a1f7b3
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e5b7c9d1a2f4"
down_revision: Union[str, Sequence[str], None] = "c4d8e2a1f7b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "webhook_deliveries",
        sa.Column("processing_started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_webhook_deliveries_processing_started_at",
        "webhook_deliveries",
        ["processing_started_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_webhook_deliveries_processing_started_at", table_name="webhook_deliveries")
    op.drop_column("webhook_deliveries", "processing_started_at")
