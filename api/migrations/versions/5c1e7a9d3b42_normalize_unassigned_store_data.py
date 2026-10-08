"""Normalize store-less data without reintroducing an implicit default store.

Revision ID: 5c1e7a9d3b42
Revises: 4b8d2f6a1c90
"""
from alembic import op
import sqlalchemy as sa

revision = "5c1e7a9d3b42"
down_revision = "4b8d2f6a1c90"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The previous release created an implicit "Main Store" for existing
    # merchants. Preserve that data but stop presenting it as a default store.
    op.execute(sa.text("""
        UPDATE stores
        SET name = 'متجر سابق',
            slug = 'legacy-main-' || substr(replace(id::text, '-', ''), 1, 12)
        WHERE slug = 'main-store'
          AND name IN ('Main Store', 'المتجر الرئيسي')
    """))

    # Any rows that were created without a store after the store migration are
    # assigned to a dedicated legacy store for that merchant. This is explicit
    # and isolated; it never mixes those rows into a newly created store.
    op.execute(sa.text("""
        INSERT INTO stores (id, merchant_id, name, slug, is_active)
        SELECT md5(m.id::text || ':legacy-unassigned')::uuid,
               m.id,
               'بيانات سابقة',
               'legacy-unassigned',
               true
        FROM merchants AS m
        WHERE EXISTS (
            SELECT 1 FROM orders o WHERE o.merchant_id = m.id AND o.store_id IS NULL
            UNION ALL
            SELECT 1 FROM notifications n WHERE n.merchant_id = m.id AND n.store_id IS NULL
            UNION ALL
            SELECT 1 FROM risk_evaluations r WHERE r.merchant_id = m.id AND r.store_id IS NULL
            UNION ALL
            SELECT 1 FROM webhook_endpoints w WHERE w.merchant_id = m.id AND w.store_id IS NULL
            UNION ALL
            SELECT 1 FROM api_keys k WHERE k.merchant_id = m.id AND k.store_id IS NULL AND k.key_kind = 'customer'
        )
        AND NOT EXISTS (
            SELECT 1 FROM stores s
            WHERE s.merchant_id = m.id AND s.slug = 'legacy-unassigned'
        )
    """))

    for table in ("orders", "notifications", "risk_evaluations", "webhook_endpoints"):
        op.execute(sa.text(f"""
            UPDATE {table} AS target
            SET store_id = stores.id
            FROM stores
            WHERE target.merchant_id = stores.merchant_id
              AND stores.slug = 'legacy-unassigned'
              AND target.store_id IS NULL
        """))

    op.execute(sa.text("""
        UPDATE api_keys AS target
        SET store_id = stores.id
        FROM stores
        WHERE target.merchant_id = stores.merchant_id
          AND stores.slug = 'legacy-unassigned'
          AND target.store_id IS NULL
          AND target.key_kind = 'customer'
    """))


def downgrade() -> None:
    for table in ("orders", "notifications", "risk_evaluations", "webhook_endpoints"):
        op.execute(sa.text(f"""
            UPDATE {table}
            SET store_id = NULL
            WHERE store_id IN (SELECT id FROM stores WHERE slug = 'legacy-unassigned')
        """))
    op.execute(sa.text("""
        UPDATE api_keys
        SET store_id = NULL
        WHERE store_id IN (SELECT id FROM stores WHERE slug = 'legacy-unassigned')
          AND key_kind = 'customer'
    """))
    op.execute(sa.text("DELETE FROM stores WHERE slug = 'legacy-unassigned'"))
