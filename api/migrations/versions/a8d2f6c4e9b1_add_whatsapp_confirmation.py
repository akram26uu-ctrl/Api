"""Add automatic WhatsApp order confirmation"""

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = "a8d2f6c4e9b1"
down_revision = "f7a3c91d5b28"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("merchants", sa.Column("whatsapp_confirmation_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("merchants", sa.Column("whatsapp_confirmation_decisions", sa.String(length=50), nullable=False, server_default="allow,review"))
    op.add_column("merchants", sa.Column("whatsapp_auto_update_status", sa.Boolean(), nullable=False, server_default=sa.text("true")))

    op.create_table(
        "whatsapp_messages",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("order_id", sa.Uuid(), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("merchant_id", sa.Uuid(), sa.ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("store_id", sa.Uuid(), sa.ForeignKey("stores.id", ondelete="SET NULL"), nullable=True),
        sa.Column("environment", sa.String(length=10), nullable=False),
        sa.Column("to_phone", sa.String(length=20), nullable=False),
        sa.Column("template_name", sa.String(length=100), nullable=False),
        sa.Column("template_language", sa.String(length=10), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("reply_token", sa.String(length=64), nullable=False, unique=True),
        sa.Column("provider_message_id", sa.String(length=128), nullable=True, unique=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("processing_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.String(length=255), nullable=True),
        sa.Column("reply_outcome", sa.String(length=30), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("replied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_whatsapp_messages_status", "whatsapp_messages", ["status"])
    op.create_index("ix_whatsapp_messages_status_next", "whatsapp_messages", ["status", "next_attempt_at"])
    op.create_index("ix_whatsapp_messages_merchant_store", "whatsapp_messages", ["merchant_id", "store_id"])

    op.create_table(
        "whatsapp_inbound_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("provider_message_id", sa.String(length=128), nullable=False, unique=True),
        sa.Column("whatsapp_message_id", sa.Uuid(), sa.ForeignKey("whatsapp_messages.id", ondelete="SET NULL"), nullable=True),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("whatsapp_inbound_events")
    op.drop_index("ix_whatsapp_messages_merchant_store", table_name="whatsapp_messages")
    op.drop_index("ix_whatsapp_messages_status_next", table_name="whatsapp_messages")
    op.drop_index("ix_whatsapp_messages_status", table_name="whatsapp_messages")
    op.drop_table("whatsapp_messages")
    op.drop_column("merchants", "whatsapp_auto_update_status")
    op.drop_column("merchants", "whatsapp_confirmation_decisions")
    op.drop_column("merchants", "whatsapp_confirmation_enabled")
