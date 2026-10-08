"""add merchant rate limits

Revision ID: b31e7a4c9d22
Revises: 7f4c2a9e1b6d
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "b31e7a4c9d22"
down_revision: Union[str, Sequence[str], None] = "7f4c2a9e1b6d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        "merchant_rate_limit_buckets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("merchant_id", sa.Uuid(), nullable=False),
        sa.Column("environment", sa.String(length=10), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("merchant_id", "environment", "window_start", name="uq_merchant_rate_limit_environment_window"),
    )
    op.create_index("ix_merchant_rate_limit_buckets_merchant_id", "merchant_rate_limit_buckets", ["merchant_id"])
    op.create_index("ix_merchant_rate_limit_buckets_environment", "merchant_rate_limit_buckets", ["environment"])
    op.create_index("ix_merchant_rate_limit_buckets_window_start", "merchant_rate_limit_buckets", ["window_start"])

def downgrade() -> None:
    op.drop_index("ix_merchant_rate_limit_buckets_window_start", table_name="merchant_rate_limit_buckets")
    op.drop_index("ix_merchant_rate_limit_buckets_environment", table_name="merchant_rate_limit_buckets")
    op.drop_index("ix_merchant_rate_limit_buckets_merchant_id", table_name="merchant_rate_limit_buckets")
    op.drop_table("merchant_rate_limit_buckets")
