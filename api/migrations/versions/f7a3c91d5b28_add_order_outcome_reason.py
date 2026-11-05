"""Add reason to order outcomes"""

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = "f7a3c91d5b28"
down_revision = "c6e1a9f3b8d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("order_outcomes", sa.Column("reason", sa.String(length=32), nullable=True))
    op.create_index("ix_order_outcomes_reason", "order_outcomes", ["reason"])


def downgrade() -> None:
    op.drop_index("ix_order_outcomes_reason", table_name="order_outcomes")
    op.drop_column("order_outcomes", "reason")
