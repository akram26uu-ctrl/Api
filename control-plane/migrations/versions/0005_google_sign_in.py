"""sign in with Google: link a Google account and allow password-less users"""
from alembic import op
import sqlalchemy as sa

revision = "0005_google_sign_in"
down_revision = "0004_encrypted_dashboard_credentials"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users") as batch:
        batch.alter_column("password_hash", existing_type=sa.String(length=255), nullable=True)
        batch.add_column(sa.Column("google_sub", sa.String(length=255), nullable=True))
    op.create_index("ix_users_google_sub", "users", ["google_sub"], unique=True)


def downgrade():
    op.drop_index("ix_users_google_sub", table_name="users")
    # Google-only accounts have no password. "!" is not a valid argon2 hash, so these
    # accounts cannot sign in with a password until it is reset.
    op.execute("UPDATE users SET password_hash = '!' WHERE password_hash IS NULL")
    with op.batch_alter_table("users") as batch:
        batch.drop_column("google_sub")
        batch.alter_column("password_hash", existing_type=sa.String(length=255), nullable=False)
