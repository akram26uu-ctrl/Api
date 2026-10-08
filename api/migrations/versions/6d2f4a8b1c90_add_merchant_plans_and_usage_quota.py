"""Add merchant plan metadata and monthly usage quota.

Revision ID: 6d2f4a8b1c90
Revises: 5c1e7a9d3b42
"""
from alembic import op
import sqlalchemy as sa

revision = "6d2f4a8b1c90"
down_revision = "5c1e7a9d3b42"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("merchants", sa.Column("plan_code", sa.String(length=50), nullable=False, server_default="free"))
    op.add_column("merchants", sa.Column("monthly_order_limit", sa.Integer(), nullable=False, server_default="1000"))
    op.add_column("merchants", sa.Column("quota_period_start", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("date_trunc('month', now())")))
    op.add_column("merchants", sa.Column("beta_access", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.create_index("ix_merchants_plan_code", "merchants", ["plan_code"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_merchants_plan_code", table_name="merchants")
    op.drop_column("merchants", "beta_access")
    op.drop_column("merchants", "quota_period_start")
    op.drop_column("merchants", "monthly_order_limit")
    op.drop_column("merchants", "plan_code")
