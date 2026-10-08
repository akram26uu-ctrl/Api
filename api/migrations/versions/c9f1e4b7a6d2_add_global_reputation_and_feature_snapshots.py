"""Add cross-merchant reputation signals and immutable feature snapshots."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c9f1e4b7a6d2"
down_revision: Union[str, Sequence[str], None] = "f2c4a9d7e1b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        for value in (
            "global_phone_reputation",
            "global_device_reputation",
            "global_ip_reputation",
        ):
            op.execute(
                sa.text(
                    f"ALTER TYPE risk_event_type ADD VALUE IF NOT EXISTS '{value}'"
                )
            )
    columns = [
        ("global_phone_min_orders", sa.Integer(), "12"),
        ("global_phone_bad_rate_threshold", sa.Float(), "0.70"),
        ("global_phone_min_merchants", sa.Integer(), "2"),
        ("global_phone_score", sa.Integer(), "20"),
        ("global_device_min_orders", sa.Integer(), "10"),
        ("global_device_bad_rate_threshold", sa.Float(), "0.65"),
        ("global_device_min_merchants", sa.Integer(), "2"),
        ("global_device_score", sa.Integer(), "25"),
        ("global_ip_min_orders", sa.Integer(), "20"),
        ("global_ip_bad_rate_threshold", sa.Float(), "0.70"),
        ("global_ip_min_merchants", sa.Integer(), "3"),
        ("global_ip_score", sa.Integer(), "20"),
    ]

    for name, column_type, default in columns:
        op.add_column(
            "risk_profiles",
            sa.Column(name, column_type, nullable=False, server_default=default),
        )

    op.create_table(
        "risk_feature_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("risk_assessment_id", sa.Uuid(), nullable=False),
        sa.Column("schema_version", sa.String(length=50), nullable=False),
        sa.Column("features", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["risk_assessment_id"],
            ["risk_assessments.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "risk_assessment_id",
            name="uq_risk_feature_snapshot_assessment",
        ),
    )
    op.create_index(
        "ix_risk_feature_snapshots_risk_assessment_id",
        "risk_feature_snapshots",
        ["risk_assessment_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_risk_feature_snapshots_risk_assessment_id",
        table_name="risk_feature_snapshots",
    )
    op.drop_table("risk_feature_snapshots")

    for name in (
        "global_ip_score",
        "global_ip_min_merchants",
        "global_ip_bad_rate_threshold",
        "global_ip_min_orders",
        "global_device_score",
        "global_device_min_merchants",
        "global_device_bad_rate_threshold",
        "global_device_min_orders",
        "global_phone_score",
        "global_phone_min_merchants",
        "global_phone_bad_rate_threshold",
        "global_phone_min_orders",
    ):
        op.drop_column("risk_profiles", name)
