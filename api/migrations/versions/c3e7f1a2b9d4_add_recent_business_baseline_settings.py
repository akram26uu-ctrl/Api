"""Add recent business baseline settings to risk profiles."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c3e7f1a2b9d4"
down_revision: Union[str, Sequence[str], None] = "a7d4e9c2f1b0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("risk_profiles", sa.Column("business_context_recent_days", sa.Integer(), nullable=False, server_default="30"))
    op.add_column("risk_profiles", sa.Column("business_context_recent_min_orders", sa.Integer(), nullable=False, server_default="10"))
    op.execute("ALTER TABLE risk_profiles ALTER COLUMN business_context_recent_days DROP DEFAULT")
    op.execute("ALTER TABLE risk_profiles ALTER COLUMN business_context_recent_min_orders DROP DEFAULT")


def downgrade() -> None:
    op.drop_column("risk_profiles", "business_context_recent_min_orders")
    op.drop_column("risk_profiles", "business_context_recent_days")
