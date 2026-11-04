"""Store order backlog for acknowledged deliveries retried later (quota)"""

import sqlalchemy as sa
from alembic import op


revision = "e8b3f5a2c1d9"
down_revision = "d7a4c1e9b2f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "store_order_backlog",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("merchant_id", sa.Uuid(), nullable=False),
        sa.Column("store_id", sa.Uuid(), nullable=False),
        sa.Column("platform", sa.String(length=40), nullable=False),
        sa.Column("external_order_id", sa.String(length=255), nullable=False),
        sa.Column("event_id", sa.String(length=255), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("reason", sa.String(length=255), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution", sa.String(length=40), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("store_id", "platform", "external_order_id", name="uq_store_order_backlog_order"),
    )
    op.create_index("ix_store_order_backlog_merchant_id", "store_order_backlog", ["merchant_id"])
    op.create_index("ix_store_order_backlog_due", "store_order_backlog", ["resolved_at", "next_attempt_at"])


def downgrade() -> None:
    op.drop_index("ix_store_order_backlog_due", table_name="store_order_backlog")
    op.drop_index("ix_store_order_backlog_merchant_id", table_name="store_order_backlog")
    op.drop_table("store_order_backlog")
