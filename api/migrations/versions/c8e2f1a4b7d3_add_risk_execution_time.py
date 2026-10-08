"""Persist risk evaluation execution time for truthful telemetry."""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "c8e2f1a4b7d3"
down_revision: Union[str, Sequence[str], None] = "8b2f6d1a4c90"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("risk_assessments", sa.Column("execution_time_ms", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("risk_assessments", "execution_time_ms")
