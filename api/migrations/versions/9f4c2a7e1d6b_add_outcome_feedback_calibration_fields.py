"""Add correctable outcome feedback fields to risk evaluations."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "9f4c2a7e1d6b"
down_revision: Union[str, Sequence[str], None] = "c3e7f1a2b9d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("risk_evaluations", sa.Column("outcome_status", sa.String(length=20), nullable=True))
    op.add_column("risk_evaluations", sa.Column("outcome_occurred_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("risk_evaluations", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True))

    op.execute("UPDATE risk_evaluations re SET outcome_status = oo.outcome_status, outcome_occurred_at = oo.occurred_at FROM order_outcomes oo WHERE oo.order_id = re.order_id")
    op.execute("UPDATE risk_evaluations SET outcome_status = CASE WHEN actual_bad_outcome THEN 'cancelled' ELSE 'delivered' END WHERE outcome_status IS NULL")
    op.execute("UPDATE risk_evaluations SET outcome_occurred_at = created_at WHERE outcome_occurred_at IS NULL")

    op.alter_column("risk_evaluations", "outcome_status", nullable=False)
    op.alter_column("risk_evaluations", "outcome_occurred_at", nullable=False)
    op.alter_column("risk_evaluations", "updated_at", nullable=False)
    op.create_check_constraint(
        "ck_risk_evaluation_outcome_status",
        "risk_evaluations",
        "outcome_status IN ('delivered', 'cancelled', 'returned')",
    )
    op.create_index("ix_risk_evaluations_merchant_outcome_occurred_at", "risk_evaluations", ["merchant_id", "outcome_occurred_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_risk_evaluations_merchant_outcome_occurred_at", table_name="risk_evaluations")
    op.drop_constraint("ck_risk_evaluation_outcome_status", "risk_evaluations", type_="check")
    op.drop_column("risk_evaluations", "updated_at")
    op.drop_column("risk_evaluations", "outcome_occurred_at")
    op.drop_column("risk_evaluations", "outcome_status")
