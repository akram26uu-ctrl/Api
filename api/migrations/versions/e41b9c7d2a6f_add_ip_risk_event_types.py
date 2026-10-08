"""Add IP risk event types"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "e41b9c7d2a6f"
down_revision = "d806826a79de"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return

    op.execute(
        """
        ALTER TYPE risk_event_type
        ADD VALUE IF NOT EXISTS 'multiple_customers_same_ip'
        """
    )

    op.execute(
        """
        ALTER TYPE risk_event_type
        ADD VALUE IF NOT EXISTS 'high_ip_frequency'
        """
    )


def downgrade() -> None:
    # PostgreSQL does not support removing enum values directly.
    pass