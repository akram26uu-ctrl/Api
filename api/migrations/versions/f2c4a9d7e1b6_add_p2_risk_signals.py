"""Add P2 risk signals and network intelligence settings."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "f2c4a9d7e1b6"
down_revision: Union[str, Sequence[str], None] = "e83b2d4f9a10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        for value in (
            "high_customer_velocity",
            "high_phone_velocity",
            "high_device_velocity",
            "multiple_customers_same_address",
            "multiple_customers_same_device",
            "high_ip_reputation",
            "bot_activity",
            "tor_detected",
        ):
            op.execute(sa.text(
                f"ALTER TYPE risk_event_type ADD VALUE IF NOT EXISTS '{value}'"
            ))
    columns = [
        ("customer_velocity_count", sa.Integer(), "3"),
        ("customer_velocity_window_minutes", sa.Integer(), "15"),
        ("customer_velocity_score", sa.Integer(), "10"),
        ("phone_velocity_count", sa.Integer(), "3"),
        ("phone_velocity_window_minutes", sa.Integer(), "15"),
        ("phone_velocity_score", sa.Integer(), "12"),
        ("device_velocity_count", sa.Integer(), "3"),
        ("device_velocity_window_minutes", sa.Integer(), "15"),
        ("device_velocity_score", sa.Integer(), "12"),
        ("multiple_customers_same_address_threshold", sa.Integer(), "3"),
        ("multiple_customers_same_address_score", sa.Integer(), "18"),
        ("multiple_customers_same_device_threshold", sa.Integer(), "3"),
        ("multiple_customers_same_device_score", sa.Integer(), "25"),
        ("high_ip_reputation_threshold", sa.Integer(), "85"),
        ("high_ip_reputation_score", sa.Integer(), "20"),
        ("bot_activity_score", sa.Integer(), "15"),
        ("tor_score", sa.Integer(), "20"),
    ]
    for name, column_type, default in columns:
        op.add_column(
            "risk_profiles",
            sa.Column(name, column_type, nullable=False, server_default=default),
        )


def downgrade() -> None:
    names = [
        "tor_score", "bot_activity_score", "high_ip_reputation_score",
        "high_ip_reputation_threshold", "multiple_customers_same_device_score",
        "multiple_customers_same_device_threshold", "multiple_customers_same_address_score",
        "multiple_customers_same_address_threshold", "device_velocity_score",
        "device_velocity_window_minutes", "device_velocity_count", "phone_velocity_score",
        "phone_velocity_window_minutes", "phone_velocity_count", "customer_velocity_score",
        "customer_velocity_window_minutes", "customer_velocity_count",
    ]
    for name in names:
        op.drop_column("risk_profiles", name)
