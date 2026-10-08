"""Scope webhook endpoints and deliveries by environment."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f6a9c2e4b7d1"
down_revision: Union[str, Sequence[str], None] = "e5b7c9d1a2f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "webhook_endpoints",
        sa.Column("environment", sa.String(length=10), nullable=True),
    )
    op.execute(sa.text("UPDATE webhook_endpoints SET environment = 'live' WHERE environment IS NULL"))
    op.alter_column("webhook_endpoints", "environment", nullable=False, server_default="live")
    op.create_check_constraint(
        "ck_webhook_endpoint_environment",
        "webhook_endpoints",
        "environment IN ('live', 'test')",
    )
    op.create_index(
        "ix_webhook_endpoints_merchant_environment_active",
        "webhook_endpoints",
        ["merchant_id", "environment", "is_active"],
        unique=False,
    )

    op.add_column(
        "webhook_deliveries",
        sa.Column("environment", sa.String(length=10), nullable=True),
    )
    op.execute(sa.text(
        "UPDATE webhook_deliveries d SET environment = e.environment "
        "FROM webhook_endpoints e WHERE d.endpoint_id = e.id AND d.environment IS NULL"
    ))
    op.alter_column("webhook_deliveries", "environment", nullable=False, server_default="live")
    op.create_index(
        "ix_webhook_deliveries_environment",
        "webhook_deliveries",
        ["environment"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_webhook_deliveries_environment", table_name="webhook_deliveries")
    op.drop_column("webhook_deliveries", "environment")
    op.drop_index("ix_webhook_endpoints_merchant_environment_active", table_name="webhook_endpoints")
    op.drop_constraint("ck_webhook_endpoint_environment", "webhook_endpoints", type_="check")
    op.drop_column("webhook_endpoints", "environment")
