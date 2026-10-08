"""Add production-only risk outcome evaluations."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e83b2d4f9a10"
down_revision: Union[str, Sequence[str], None] = "d4a8e1f7c2b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "risk_evaluations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("merchant_id", sa.Uuid(), nullable=False),
        sa.Column("order_id", sa.Uuid(), nullable=False),
        sa.Column("risk_assessment_id", sa.Uuid(), nullable=False),
        sa.Column("environment", sa.String(length=10), nullable=False),
        sa.Column("data_origin", sa.String(length=20), nullable=False),
        sa.Column("predicted_risky", sa.Boolean(), nullable=False),
        sa.Column("actual_bad_outcome", sa.Boolean(), nullable=False),
        sa.Column("classification", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "classification IN ('true_positive', 'false_positive', 'true_negative', 'false_negative')",
            name="ck_risk_evaluation_classification",
        ),
        sa.CheckConstraint(
            "environment = 'live'",
            name="ck_risk_evaluation_environment_live",
        ),
        sa.CheckConstraint(
            "data_origin = 'real'",
            name="ck_risk_evaluation_real_data",
        ),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["risk_assessment_id"], ["risk_assessments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("order_id"),
    )
    op.create_index("ix_risk_evaluations_merchant_id", "risk_evaluations", ["merchant_id"], unique=False)
    op.create_index("ix_risk_evaluations_order_id", "risk_evaluations", ["order_id"], unique=True)
    op.create_index("ix_risk_evaluations_risk_assessment_id", "risk_evaluations", ["risk_assessment_id"], unique=False)
    op.create_index("ix_risk_evaluations_classification", "risk_evaluations", ["classification"], unique=False)
    op.create_index("ix_risk_evaluations_merchant_created_at", "risk_evaluations", ["merchant_id", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_risk_evaluations_merchant_created_at", table_name="risk_evaluations")
    op.drop_index("ix_risk_evaluations_classification", table_name="risk_evaluations")
    op.drop_index("ix_risk_evaluations_risk_assessment_id", table_name="risk_evaluations")
    op.drop_index("ix_risk_evaluations_order_id", table_name="risk_evaluations")
    op.drop_index("ix_risk_evaluations_merchant_id", table_name="risk_evaluations")
    op.drop_table("risk_evaluations")
