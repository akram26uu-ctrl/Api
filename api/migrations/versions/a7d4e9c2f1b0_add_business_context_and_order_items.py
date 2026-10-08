"""Add merchant business context and order items.

Revision ID: a7d4e9c2f1b0
Revises: f6a9c2e4b7d1
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7d4e9c2f1b0"
down_revision: Union[str, Sequence[str], None] = "f6a9c2e4b7d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "merchants",
        sa.Column(
            "primary_business_category",
            sa.String(length=100),
            nullable=False,
            server_default="other",
        ),
    )
    op.add_column(
        "merchants",
        sa.Column(
            "secondary_business_categories",
            sa.JSON(),
            nullable=False,
            server_default="[]",
        ),
    )
    op.create_index(
        "ix_merchants_primary_business_category",
        "merchants",
        ["primary_business_category"],
        unique=False,
    )

    op.create_table(
        "order_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("order_id", sa.Uuid(), nullable=False),
        sa.Column("product_name", sa.String(length=255), nullable=False),
        sa.Column("sku", sa.String(length=100), nullable=True),
        sa.Column("product_category", sa.String(length=100), nullable=True),
        sa.Column("product_category_normalized", sa.String(length=100), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_order_items_quantity_positive"),
        sa.CheckConstraint("unit_price >= 0", name="ck_order_items_unit_price_nonnegative"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_order_items_order_id", "order_items", ["order_id"], unique=False)
    op.create_index("ix_order_items_category", "order_items", ["product_category_normalized"], unique=False)

    for table_name, columns in (
        ("risk_profiles", [
            sa.Column("business_context_min_orders", sa.Integer(), nullable=False, server_default="20"),
            sa.Column("business_context_quantity_multiplier", sa.Float(), nullable=False, server_default="1.75"),
            sa.Column("business_context_value_multiplier", sa.Float(), nullable=False, server_default="2.0"),
            sa.Column("unusual_quantity_score", sa.Integer(), nullable=False, server_default="10"),
            sa.Column("unusual_value_score", sa.Integer(), nullable=False, server_default="10"),
        ]),
    ):
        for column in columns:
            op.add_column(table_name, column)

    op.execute("ALTER TABLE merchants ALTER COLUMN primary_business_category DROP DEFAULT")
    op.execute("ALTER TABLE merchants ALTER COLUMN secondary_business_categories DROP DEFAULT")
    for column_name in (
        "business_context_min_orders",
        "business_context_quantity_multiplier",
        "business_context_value_multiplier",
        "unusual_quantity_score",
        "unusual_value_score",
    ):
        op.execute(f"ALTER TABLE risk_profiles ALTER COLUMN {column_name} DROP DEFAULT")


def downgrade() -> None:
    for column_name in (
        "unusual_value_score",
        "unusual_quantity_score",
        "business_context_value_multiplier",
        "business_context_quantity_multiplier",
        "business_context_min_orders",
    ):
        op.drop_column("risk_profiles", column_name)
    op.drop_index("ix_order_items_category", table_name="order_items")
    op.drop_index("ix_order_items_order_id", table_name="order_items")
    op.drop_table("order_items")
    op.drop_index("ix_merchants_primary_business_category", table_name="merchants")
    op.drop_column("merchants", "secondary_business_categories")
    op.drop_column("merchants", "primary_business_category")
