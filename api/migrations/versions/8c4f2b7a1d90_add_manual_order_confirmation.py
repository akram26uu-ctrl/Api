"""Add manual order confirmation history.

This migration is idempotent because production schema reconciliation may have
created the table before Alembic's revision ledger was repaired.
"""
from alembic import op
import sqlalchemy as sa

revision = "8c4f2b7a1d90"
down_revision = "6d2f4a8b1c90"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS public.order_confirmation_attempts (
            id uuid PRIMARY KEY NOT NULL,
            order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
            merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
            store_id uuid NULL REFERENCES public.stores(id) ON DELETE SET NULL,
            api_key_id uuid NULL REFERENCES public.api_keys(id) ON DELETE SET NULL,
            environment varchar(10) NOT NULL,
            channel varchar(30) NOT NULL,
            outcome varchar(30) NOT NULL,
            notes text NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        )
    """))
    op.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_confirmation_attempts_order_created
        ON public.order_confirmation_attempts (order_id, created_at)
    """))
    op.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_confirmation_attempts_merchant_store
        ON public.order_confirmation_attempts (merchant_id, store_id)
    """))


def downgrade() -> None:
    op.execute(sa.text("DROP TABLE IF EXISTS public.order_confirmation_attempts CASCADE"))
