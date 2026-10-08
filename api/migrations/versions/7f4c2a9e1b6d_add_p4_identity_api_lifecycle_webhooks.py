"""add p4 identity confidence api lifecycle audit webhooks feature controls

Revision ID: 7f4c2a9e1b6d
Revises: 1a7c9e4b2d11
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "7f4c2a9e1b6d"
down_revision: Union[str, Sequence[str], None] = "1a7c9e4b2d11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("identity_confidence", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("orders", sa.Column("identity_match_reasons", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("risk_assessments", sa.Column("identity_confidence", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("risk_assessments", sa.Column("identity_match_reasons", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("risk_profiles", sa.Column("identity_cluster_threshold", sa.Integer(), nullable=False, server_default="6"))
    op.add_column("risk_profiles", sa.Column("identity_cluster_score", sa.Integer(), nullable=False, server_default="15"))

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("merchant_id", sa.UUID(), sa.ForeignKey("merchants.id", ondelete="CASCADE"), nullable=True),
        sa.Column("api_key_id", sa.UUID(), sa.ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(100), nullable=False),
        sa.Column("resource_id", sa.String(255), nullable=True),
        sa.Column("environment", sa.String(10), nullable=True),
        sa.Column("request_id", sa.String(64), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_audit_logs_merchant_id", "audit_logs", ["merchant_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_resource_type", "audit_logs", ["resource_type"])
    op.create_index("ix_audit_logs_resource_id", "audit_logs", ["resource_id"])
    op.create_index("ix_audit_logs_environment", "audit_logs", ["environment"])
    op.create_index("ix_audit_logs_request_id", "audit_logs", ["request_id"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])

    op.create_table(
        "webhook_endpoints",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("merchant_id", sa.UUID(), sa.ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("url", sa.String(2048), nullable=False),
        sa.Column("signing_secret_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column("events", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_webhook_endpoints_merchant_id", "webhook_endpoints", ["merchant_id"])
    op.create_index("ix_webhook_endpoints_is_active", "webhook_endpoints", ["is_active"])

    op.create_table(
        "webhook_deliveries",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("endpoint_id", sa.UUID(), sa.ForeignKey("webhook_endpoints.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_id", sa.UUID(), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_webhook_deliveries_endpoint_id", "webhook_deliveries", ["endpoint_id"])
    op.create_index("ix_webhook_deliveries_event_id", "webhook_deliveries", ["event_id"])
    op.create_index("ix_webhook_deliveries_event_type", "webhook_deliveries", ["event_type"])
    op.create_index("ix_webhook_deliveries_status", "webhook_deliveries", ["status"])
    op.create_index("ix_webhook_deliveries_next_attempt_at", "webhook_deliveries", ["next_attempt_at"])
    op.create_index("ix_webhook_deliveries_created_at", "webhook_deliveries", ["created_at"])


def downgrade() -> None:
    op.drop_table("webhook_deliveries")
    op.drop_table("webhook_endpoints")
    op.drop_table("audit_logs")
    op.drop_column("risk_profiles", "identity_cluster_score")
    op.drop_column("risk_profiles", "identity_cluster_threshold")
    op.drop_column("risk_assessments", "identity_match_reasons")
    op.drop_column("risk_assessments", "identity_confidence")
    op.drop_column("orders", "identity_match_reasons")
    op.drop_column("orders", "identity_confidence")
