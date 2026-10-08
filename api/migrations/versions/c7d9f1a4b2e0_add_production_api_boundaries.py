"""Add production API boundaries: environments, provenance, idempotency, versions."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c7d9f1a4b2e0"
down_revision: Union[str, Sequence[str], None] = "b480385725b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # API key environment boundary.
    op.add_column(
        "api_keys",
        sa.Column("environment", sa.String(length=10), nullable=False, server_default="live"),
    )
    op.create_check_constraint(
        "ck_api_key_environment",
        "api_keys",
        "environment IN ('live', 'test')",
    )
    op.create_index("ix_api_keys_environment", "api_keys", ["environment"], unique=False)

    # Order provenance and the API key that created the order.
    op.add_column("orders", sa.Column("api_key_id", sa.Uuid(), nullable=True))
    op.add_column(
        "orders",
        sa.Column("environment", sa.String(length=10), nullable=False, server_default="live"),
    )
    op.add_column(
        "orders",
        sa.Column("data_origin", sa.String(length=20), nullable=False, server_default="real"),
    )
    op.create_foreign_key(
        "fk_orders_api_key_id",
        "orders",
        "api_keys",
        ["api_key_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_check_constraint(
        "ck_order_environment",
        "orders",
        "environment IN ('live', 'test')",
    )
    op.create_check_constraint(
        "ck_order_data_origin",
        "orders",
        "data_origin IN ('real', 'test', 'synthetic', 'imported', 'manual')",
    )
    op.create_index("ix_orders_api_key_id", "orders", ["api_key_id"], unique=False)
    op.create_index("ix_orders_environment", "orders", ["environment"], unique=False)
    op.create_index("ix_orders_data_origin", "orders", ["data_origin"], unique=False)
    op.create_index(
        "ix_orders_merchant_created_at",
        "orders",
        ["merchant_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_orders_merchant_ip_created_at",
        "orders",
        ["merchant_id", "ip_address", "created_at"],
        unique=False,
    )

    op.drop_constraint("uq_order_merchant_external_id", "orders", type_="unique")
    op.create_unique_constraint(
        "uq_order_merchant_environment_external_id",
        "orders",
        ["merchant_id", "environment", "external_order_id"],
    )

    # Immutable risk-engine provenance.
    op.add_column(
        "risk_profiles",
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "risk_assessments",
        sa.Column("rules_version", sa.String(length=100), nullable=False, server_default="2026-09-p0"),
    )
    op.add_column(
        "risk_assessments",
        sa.Column("risk_profile_version", sa.Integer(), nullable=False, server_default="1"),
    )

    # Idempotency records make network retries safe and auditable.
    op.create_table(
        "idempotency_records",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("merchant_id", sa.Uuid(), nullable=False),
        sa.Column("api_key_id", sa.Uuid(), nullable=True),
        sa.Column("order_id", sa.Uuid(), nullable=True),
        sa.Column("idempotency_key", sa.String(length=255), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("response_body", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status_code >= 200 AND status_code < 500",
            name="ck_idempotency_status_code",
        ),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["api_key_id"], ["api_keys.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("merchant_id", "idempotency_key", name="uq_idempotency_merchant_key"),
    )
    op.create_index(
        "ix_idempotency_records_merchant_id",
        "idempotency_records",
        ["merchant_id"],
        unique=False,
    )
    op.create_index(
        "ix_idempotency_records_api_key_id",
        "idempotency_records",
        ["api_key_id"],
        unique=False,
    )
    op.create_index(
        "ix_idempotency_records_order_id",
        "idempotency_records",
        ["order_id"],
        unique=False,
    )
    op.create_index(
        "ix_idempotency_merchant_created_at",
        "idempotency_records",
        ["merchant_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_idempotency_merchant_created_at", table_name="idempotency_records")
    op.drop_index("ix_idempotency_records_order_id", table_name="idempotency_records")
    op.drop_index("ix_idempotency_records_api_key_id", table_name="idempotency_records")
    op.drop_index("ix_idempotency_records_merchant_id", table_name="idempotency_records")
    op.drop_table("idempotency_records")

    op.drop_column("risk_assessments", "risk_profile_version")
    op.drop_column("risk_assessments", "rules_version")
    op.drop_column("risk_profiles", "version")

    op.drop_constraint("uq_order_merchant_environment_external_id", "orders", type_="unique")
    op.drop_index("ix_orders_merchant_ip_created_at", table_name="orders")
    op.drop_index("ix_orders_merchant_created_at", table_name="orders")
    op.drop_index("ix_orders_data_origin", table_name="orders")
    op.drop_index("ix_orders_environment", table_name="orders")
    op.drop_index("ix_orders_api_key_id", table_name="orders")
    op.drop_constraint("ck_order_data_origin", "orders", type_="check")
    op.drop_constraint("ck_order_environment", "orders", type_="check")
    op.drop_constraint("fk_orders_api_key_id", "orders", type_="foreignkey")
    op.drop_column("orders", "data_origin")
    op.drop_column("orders", "environment")
    op.drop_column("orders", "api_key_id")
    op.create_unique_constraint(
        "uq_order_merchant_external_id",
        "orders",
        ["merchant_id", "external_order_id"],
    )

    op.drop_index("ix_api_keys_environment", table_name="api_keys")
    op.drop_constraint("ck_api_key_environment", "api_keys", type_="check")
    op.drop_column("api_keys", "environment")
