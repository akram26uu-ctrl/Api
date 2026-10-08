"""add api key scopes

Revision ID: c4d8e2a1f7b3
Revises: b31e7a4c9d22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c4d8e2a1f7b3"
down_revision: Union[str, Sequence[str], None] = "b31e7a4c9d22"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_DEFAULT_SCOPES = '["orders:write","outcomes:write","metrics:read","risk_profile:read","risk_features:read","keys:manage","webhooks:manage","audit:read"]'


def upgrade() -> None:
    op.add_column("api_keys", sa.Column("scopes", sa.JSON(), nullable=True))
    op.execute(
        "UPDATE api_keys SET scopes = '" + _DEFAULT_SCOPES.replace("'", "''") + "'"
    )
    op.alter_column("api_keys", "scopes", existing_type=sa.JSON(), nullable=False)


def downgrade() -> None:
    op.drop_column("api_keys", "scopes")
