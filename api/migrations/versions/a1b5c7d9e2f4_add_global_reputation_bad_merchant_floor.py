"""Add cross-merchant bad-merchant floor for reputation signals."""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "a1b5c7d9e2f4"
down_revision: Union[str, Sequence[str], None] = "9f4c2a7e1d6b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "risk_profiles",
        sa.Column("global_reputation_min_bad_merchants", sa.Integer(), nullable=True),
    )
    op.execute(
        "UPDATE risk_profiles SET global_reputation_min_bad_merchants = 2 "
        "WHERE global_reputation_min_bad_merchants IS NULL"
    )
    op.alter_column("risk_profiles", "global_reputation_min_bad_merchants", nullable=False)


def downgrade() -> None:
    op.drop_column("risk_profiles", "global_reputation_min_bad_merchants")
