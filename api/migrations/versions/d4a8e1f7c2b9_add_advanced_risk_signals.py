"""Add advanced risk signals and system-controlled profile settings."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d4a8e1f7c2b9"
down_revision: Union[str, Sequence[str], None] = "c7d9f1a4b2e0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Historical databases created before the model enum was updated may be
    # missing these values. PostgreSQL cannot remove enum values on downgrade.
    if op.get_bind().dialect.name == "postgresql":
        for value in (
            "phone_reused",
            "device_reused",
            "duplicate_order_pattern",
            "burst_network_activity",
            "strong_identity_combination",
        ):
            op.execute(sa.text(
                f"ALTER TYPE risk_event_type ADD VALUE IF NOT EXISTS '{value}'"
            ))
    op.add_column(
        "risk_profiles",
        sa.Column("duplicate_order_window_minutes", sa.Integer(), nullable=False, server_default="30"),
    )
    op.add_column(
        "risk_profiles",
        sa.Column("duplicate_order_score", sa.Integer(), nullable=False, server_default="10"),
    )
    op.add_column(
        "risk_profiles",
        sa.Column("burst_ip_window_minutes", sa.Integer(), nullable=False, server_default="10"),
    )
    op.add_column(
        "risk_profiles",
        sa.Column("burst_ip_customer_threshold", sa.Integer(), nullable=False, server_default="3"),
    )
    op.add_column(
        "risk_profiles",
        sa.Column("burst_ip_phone_threshold", sa.Integer(), nullable=False, server_default="3"),
    )
    op.add_column(
        "risk_profiles",
        sa.Column("burst_ip_score", sa.Integer(), nullable=False, server_default="20"),
    )
    op.add_column(
        "risk_profiles",
        sa.Column("strong_identity_combination_score", sa.Integer(), nullable=False, server_default="15"),
    )


def downgrade() -> None:
    op.drop_column("risk_profiles", "strong_identity_combination_score")
    op.drop_column("risk_profiles", "burst_ip_score")
    op.drop_column("risk_profiles", "burst_ip_phone_threshold")
    op.drop_column("risk_profiles", "burst_ip_customer_threshold")
    op.drop_column("risk_profiles", "burst_ip_window_minutes")
    op.drop_column("risk_profiles", "duplicate_order_score")
    op.drop_column("risk_profiles", "duplicate_order_window_minutes")
