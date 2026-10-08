"""Add API rate-limit buckets and environment-aware idempotency."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "1a7c9e4b2d11"
down_revision: Union[str, Sequence[str], None] = "c9f1e4b7a6d2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "idempotency_records",
        sa.Column("environment", sa.String(length=10), nullable=False, server_default="live"),
    )
    op.drop_constraint(
        "uq_idempotency_merchant_key",
        "idempotency_records",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_idempotency_merchant_environment_key",
        "idempotency_records",
        ["merchant_id", "environment", "idempotency_key"],
    )
    op.create_index(
        "ix_idempotency_records_environment",
        "idempotency_records",
        ["environment"],
        unique=False,
    )

    op.create_table(
        "api_rate_limit_buckets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("api_key_id", sa.Uuid(), nullable=False),
        sa.Column("environment", sa.String(length=10), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["api_key_id"], ["api_keys.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "api_key_id", "environment", "window_start",
            name="uq_rate_limit_api_key_environment_window",
        ),
    )
    op.create_index("ix_api_rate_limit_buckets_api_key_id", "api_rate_limit_buckets", ["api_key_id"], unique=False)
    op.create_index("ix_api_rate_limit_buckets_environment", "api_rate_limit_buckets", ["environment"], unique=False)
    op.create_index("ix_api_rate_limit_buckets_window_start", "api_rate_limit_buckets", ["window_start"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_api_rate_limit_buckets_window_start", table_name="api_rate_limit_buckets")
    op.drop_index("ix_api_rate_limit_buckets_environment", table_name="api_rate_limit_buckets")
    op.drop_index("ix_api_rate_limit_buckets_api_key_id", table_name="api_rate_limit_buckets")
    op.drop_table("api_rate_limit_buckets")
    op.drop_index("ix_idempotency_records_environment", table_name="idempotency_records")
    op.drop_constraint("uq_idempotency_merchant_environment_key", "idempotency_records", type_="unique")
    op.create_unique_constraint(
        "uq_idempotency_merchant_key",
        "idempotency_records",
        ["merchant_id", "idempotency_key"],
    )
    op.drop_column("idempotency_records", "environment")
