"""store dashboard API credentials encrypted server-side"""
from alembic import op
import sqlalchemy as sa

revision = "0004_encrypted_dashboard_credentials"
down_revision = "0003_password_reset"
branch_labels = None
depends_on = None

def upgrade():
    # Existing sessions do not have encrypted credentials; revoke them so they cannot
    # authenticate to the hardened dashboard proxy without a fresh login.
    op.execute("UPDATE web_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE revoked_at IS NULL")
    op.add_column("web_sessions", sa.Column("ordium_api_key_encrypted", sa.LargeBinary(), nullable=True))
    op.add_column("web_sessions", sa.Column("ordium_live_api_key_encrypted", sa.LargeBinary(), nullable=True))

def downgrade():
    op.drop_column("web_sessions", "ordium_live_api_key_encrypted")
    op.drop_column("web_sessions", "ordium_api_key_encrypted")
