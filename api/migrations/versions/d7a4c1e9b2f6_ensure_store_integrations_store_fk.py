"""Ensure store_integrations.store_id references stores.

a9d3f6c1e820 (store_integrations) and 4b8d2f6a1c90 (stores) are on parallel
branches merged by 0d4e8c2a7f31, so a9d3 cannot reference stores (the table
may not exist yet). Add the constraint here, after both branches, unless the
database already has it.
"""

import sqlalchemy as sa
from alembic import op


revision = "d7a4c1e9b2f6"
down_revision = "c5f2a8e3d7b4"
branch_labels = None
depends_on = None

_NAME = "fk_store_integrations_store_id"


def _has_store_fk() -> bool:
    inspector = sa.inspect(op.get_bind())
    return any(fk.get("referred_table") == "stores" for fk in inspector.get_foreign_keys("store_integrations"))


def upgrade() -> None:
    if op.get_bind().dialect.name == "sqlite":
        return  # SQLite cannot ALTER constraints; tests build the schema from models.
    if not _has_store_fk():
        op.create_foreign_key(_NAME, "store_integrations", "stores", ["store_id"], ["id"], ondelete="CASCADE")


def downgrade() -> None:
    # Keep the constraint: older databases had it from a9d3f6c1e820 itself.
    pass
