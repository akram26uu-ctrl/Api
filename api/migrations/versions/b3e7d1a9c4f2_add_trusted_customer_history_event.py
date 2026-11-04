"""Add trusted_customer_history risk event type"""

from alembic import op


revision = "b3e7d1a9c4f2"
down_revision = "a8d2f6c4e9b1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute("ALTER TYPE risk_event_type ADD VALUE IF NOT EXISTS 'trusted_customer_history'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values directly.
    pass
