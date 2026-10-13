"""Add tenant-scoped commerce platform integrations."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a9d3f6c1e820"
down_revision: Union[str, Sequence[str], None] = "f6a9c2e4b7d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "store_integrations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("merchant_id", sa.Uuid(), nullable=False),
        sa.Column("store_id", sa.Uuid(), nullable=False),
        sa.Column("platform", sa.String(length=40), nullable=False),
        sa.Column("external_store_id", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=150), nullable=False),
        sa.Column("webhook_secret_encrypted", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("last_event_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("platform", "external_store_id", name="uq_store_integrations_platform_external_store"),
    )
    op.create_index("ix_store_integrations_merchant_id", "store_integrations", ["merchant_id"], unique=False)
    op.create_index("ix_store_integrations_store_id", "store_integrations", ["store_id"], unique=False)
    op.create_index("ix_store_integrations_merchant_platform", "store_integrations", ["merchant_id", "platform"], unique=False)
    op.create_index("ix_store_integrations_store_active", "store_integrations", ["store_id", "is_active"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_store_integrations_store_active", table_name="store_integrations")
    op.drop_index("ix_store_integrations_merchant_platform", table_name="store_integrations")
    op.drop_index("ix_store_integrations_store_id", table_name="store_integrations")
    op.drop_index("ix_store_integrations_merchant_id", table_name="store_integrations")
    op.drop_table("store_integrations")
