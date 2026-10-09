"""Add manual order confirmation history.

Revision ID: 8c4f2b7a1d90
Revises: 6d2f4a8b1c90
"""
from alembic import op
import sqlalchemy as sa

revision = "8c4f2b7a1d90"
down_revision = "6d2f4a8b1c90"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "order_confirmation_attempts",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("order_id", sa.Uuid(as_uuid=True), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("merchant_id", sa.Uuid(as_uuid=True), sa.ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("store_id", sa.Uuid(as_uuid=True), sa.ForeignKey("stores.id", ondelete="SET NULL"), nullable=True),
        sa.Column("api_key_id", sa.Uuid(as_uuid=True), sa.ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True),
        sa.Column("environment", sa.String(length=10), nullable=False),
        sa.Column("channel", sa.String(length=30), nullable=False),
        sa.Column("outcome", sa.String(length=30), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_confirmation_attempts_order_created", "order_confirmation_attempts", ["order_id", "created_at"])
    op.create_index("ix_confirmation_attempts_merchant_store", "order_confirmation_attempts", ["merchant_id", "store_id"])


def downgrade() -> None:
    op.drop_index("ix_confirmation_attempts_merchant_store", table_name="order_confirmation_attempts")
    op.drop_index("ix_confirmation_attempts_order_created", table_name="order_confirmation_attempts")
    op.drop_table("order_confirmation_attempts")
