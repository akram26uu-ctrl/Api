"""Add merchant stores and scope integrations/analytics by store."""
from typing import Sequence, Union
from uuid import uuid4
from alembic import op
import sqlalchemy as sa

revision: str = "4b8d2f6a1c90"
down_revision: Union[str, Sequence[str], None] = "3e7a9c1b5d20"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stores",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("merchant_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("merchant_id", "slug", name="uq_stores_merchant_slug"),
    )
    op.create_index("ix_stores_merchant_id", "stores", ["merchant_id"], unique=False)
    op.create_index("ix_stores_is_active", "stores", ["is_active"], unique=False)
    op.create_index("ix_stores_merchant_active", "stores", ["merchant_id", "is_active"], unique=False)

    for table in ("api_keys", "orders", "notifications", "risk_evaluations", "webhook_endpoints"):
        op.add_column(table, sa.Column("store_id", sa.Uuid(), nullable=True))
        op.create_index(f"ix_{table}_store_id", table, ["store_id"], unique=False)
        op.create_foreign_key(f"fk_{table}_store_id", table, "stores", ["store_id"], ["id"], ondelete="SET NULL")

    # Backfill one default store per merchant. The expression generates UUIDs
    # without requiring a PostgreSQL extension, so the migration also supports
    # Alembic offline SQL generation.
    op.execute(sa.text("""
        INSERT INTO stores (id, merchant_id, name, slug, is_active)
        SELECT md5(m.id::text || clock_timestamp()::text || random()::text)::uuid,
               m.id, 'Main Store', 'main-store', true
        FROM merchants AS m
    """))
    for table in ("api_keys", "orders", "notifications", "risk_evaluations", "webhook_endpoints"):
        op.execute(sa.text(f"""
            UPDATE {table} AS target
            SET store_id = stores.id
            FROM stores
            WHERE target.merchant_id = stores.merchant_id
              AND target.store_id IS NULL
        """))

    op.drop_constraint("uq_order_merchant_environment_external_id", "orders", type_="unique")
    op.create_unique_constraint("uq_order_merchant_environment_store_external_id", "orders", ["merchant_id", "environment", "store_id", "external_order_id"])


def downgrade() -> None:
    op.drop_constraint("uq_order_merchant_environment_store_external_id", "orders", type_="unique")
    op.create_unique_constraint("uq_order_merchant_environment_external_id", "orders", ["merchant_id", "environment", "external_order_id"])
    for table in ("webhook_endpoints", "risk_evaluations", "notifications", "orders", "api_keys"):
        op.drop_constraint(f"fk_{table}_store_id", table, type_="foreignkey")
        op.drop_index(f"ix_{table}_store_id", table_name=table)
        op.drop_column(table, "store_id")
    op.drop_index("ix_stores_merchant_active", table_name="stores")
    op.drop_index("ix_stores_is_active", table_name="stores")
    op.drop_index("ix_stores_merchant_id", table_name="stores")
    op.drop_table("stores")
