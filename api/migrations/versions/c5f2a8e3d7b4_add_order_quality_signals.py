"""Add first-order quality signals (identity quality, phone, location)"""

import sqlalchemy as sa
from alembic import op


revision = "c5f2a8e3d7b4"
down_revision = "b3e7d1a9c4f2"
branch_labels = None
depends_on = None

_COLUMNS = (
    ("low_quality_identity_score", 20),
    ("suspicious_phone_score", 20),
    ("address_location_mismatch_score", 15),
)
_EVENTS = ("low_quality_identity", "suspicious_phone_number", "address_location_mismatch")


def upgrade() -> None:
    for name, default in _COLUMNS:
        op.add_column("risk_profiles", sa.Column(name, sa.Integer(), nullable=False, server_default=str(default)))
    if op.get_bind().dialect.name == "postgresql":
        for value in _EVENTS:
            op.execute(f"ALTER TYPE risk_event_type ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    for name, _ in reversed(_COLUMNS):
        op.drop_column("risk_profiles", name)
    # PostgreSQL does not support removing enum values directly.
