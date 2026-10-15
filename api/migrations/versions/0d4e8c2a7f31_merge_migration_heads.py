"""Merge the two pre-existing Alembic heads.

Revision 8c4f2b7a1d90 and revision a9d3f6c1e820 both descended from the initial
migration without referencing each other, leaving the revision graph with two
heads. Any `alembic upgrade head` therefore failed with "Multiple head revisions
are present". This empty merge revision unifies them; subsequent migrations
chain onto it.
"""

revision = "0d4e8c2a7f31"
down_revision = ("8c4f2b7a1d90", "a9d3f6c1e820")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
