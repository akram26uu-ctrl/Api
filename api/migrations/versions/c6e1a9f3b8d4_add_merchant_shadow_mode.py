"""Add merchants.is_shadow_mode_enabled

The Merchant model declares is_shadow_mode_enabled, but no migration ever
added the column, so any code path reading it crashed with UndefinedColumn.
Backfill existing rows with true (observe-only) to preserve current behavior.

Chained onto the head-merge revision 0d4e8c2a7f31.
"""

from alembic import op
import sqlalchemy as sa


revision = "c6e1a9f3b8d4"
down_revision = "0d4e8c2a7f31"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "merchants",
        sa.Column(
            "is_shadow_mode_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column("merchants", "is_shadow_mode_enabled")
