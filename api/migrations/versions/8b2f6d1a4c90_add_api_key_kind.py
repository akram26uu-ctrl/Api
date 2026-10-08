"""Distinguish customer API keys from internal platform credentials."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "8b2f6d1a4c90"
down_revision: Union[str, Sequence[str], None] = "a1b5c7d9e2f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "api_keys",
        sa.Column("key_kind", sa.String(length=20), nullable=True),
    )
    # Existing dashboard/session, bootstrap, and seed credentials are platform-managed.
    op.execute(sa.text("""
        UPDATE api_keys
        SET key_kind = CASE
            WHEN lower(name) LIKE 'dashboard session (%' THEN 'system'
            WHEN lower(name) IN ('initial test key', 'ordium seed ingestion') THEN 'system'
            ELSE 'customer'
        END
        WHERE key_kind IS NULL
    """))
    op.alter_column("api_keys", "key_kind", nullable=False, server_default="customer")
    op.create_check_constraint(
        "ck_api_key_kind",
        "api_keys",
        "key_kind IN ('customer', 'system')",
    )
    op.create_index("ix_api_keys_merchant_kind_environment", "api_keys", ["merchant_id", "key_kind", "environment"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_api_keys_merchant_kind_environment", table_name="api_keys")
    op.drop_constraint("ck_api_key_kind", "api_keys", type_="check")
    op.drop_column("api_keys", "key_kind")
