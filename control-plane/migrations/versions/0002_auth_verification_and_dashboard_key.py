"""email verification tokens and session-bound dashboard API key"""
from alembic import op
import sqlalchemy as sa

revision = "0002_auth_verification"
down_revision = "0001_control_plane"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("web_sessions", sa.Column("ordium_api_key_id", sa.Uuid(), nullable=True))
    op.create_index("ix_web_sessions_ordium_api_key_id", "web_sessions", ["ordium_api_key_id"], unique=False)
    op.add_column("web_sessions", sa.Column("ordium_live_api_key_id", sa.Uuid(), nullable=True))
    op.create_index("ix_web_sessions_ordium_live_api_key_id", "web_sessions", ["ordium_live_api_key_id"], unique=False)
    op.create_table("email_verification_tokens",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("token_hash", name="uq_email_verification_token_hash"),
    )
    op.create_index("ix_email_verification_tokens_user_id", "email_verification_tokens", ["user_id"], unique=False)
    op.create_index("ix_email_verification_tokens_token_hash", "email_verification_tokens", ["token_hash"], unique=False)
    op.create_index("ix_email_verification_tokens_expires_at", "email_verification_tokens", ["expires_at"], unique=False)

def downgrade():
    op.drop_table("email_verification_tokens")
    op.drop_index("ix_web_sessions_ordium_live_api_key_id", table_name="web_sessions")
    op.drop_column("web_sessions", "ordium_live_api_key_id")
    op.drop_index("ix_web_sessions_ordium_api_key_id", table_name="web_sessions")
    op.drop_column("web_sessions", "ordium_api_key_id")
