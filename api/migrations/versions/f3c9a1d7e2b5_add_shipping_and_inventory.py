"""Shipping, tracking and inventory tables; order delivery fields"""

import json

import sqlalchemy as sa
from alembic import op


revision = "f3c9a1d7e2b5"
down_revision = "e8b3f5a2c1d9"
branch_labels = None
depends_on = None

NEW_SCOPES = ["shipping:read", "shipping:write", "inventory:read", "inventory:write"]
ACTIVE_WHERE = sa.text("status NOT IN ('cancelled','returned','delivered','dispatch_failed')")
_now = sa.func.now()


def _id():
    return sa.Column("id", sa.Uuid(), nullable=False)


def _ts(name):
    return sa.Column(name, sa.DateTime(timezone=True), server_default=_now, nullable=False)


def _dashboard_keys(conn):
    return conn.execute(
        sa.text("SELECT id, scopes FROM api_keys WHERE key_kind = 'system' AND name LIKE 'Dashboard session%'")
    ).fetchall()


def _write_scopes(conn, key_id, scopes):
    conn.execute(
        sa.text("UPDATE api_keys SET scopes = :scopes WHERE id = :id").bindparams(
            sa.bindparam("scopes", type_=sa.JSON()), sa.bindparam("id", type_=sa.Uuid())
        ),
        {"scopes": scopes, "id": key_id},
    )


def _as_list(value):
    return json.loads(value) if isinstance(value, str) else list(value or [])


def upgrade() -> None:
    op.add_column("orders", sa.Column("delivery_type", sa.String(length=20), nullable=False, server_default="home"))
    op.add_column("orders", sa.Column("stop_desk_id", sa.String(length=100), nullable=True))

    op.create_table(
        "carrier_accounts", _id(),
        sa.Column("merchant_id", sa.Uuid(), nullable=False),
        sa.Column("store_id", sa.Uuid(), nullable=False),
        sa.Column("environment", sa.String(length=10), nullable=False),
        sa.Column("carrier_code", sa.String(length=40), nullable=False),
        sa.Column("display_name", sa.String(length=150), nullable=False),
        sa.Column("credentials_encrypted", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        _ts("created_at"), _ts("updated_at"),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("environment IN ('live', 'test')", name="ck_carrier_account_environment"),
        sa.CheckConstraint("status IN ('active', 'error', 'disabled')", name="ck_carrier_account_status"),
    )
    op.create_index("ix_carrier_accounts_merchant_id", "carrier_accounts", ["merchant_id"])
    op.create_index("ix_carrier_accounts_store_env", "carrier_accounts", ["store_id", "environment"])

    op.create_table(
        "carrier_warehouses", _id(),
        sa.Column("carrier_account_id", sa.Uuid(), nullable=False),
        sa.Column("external_id", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("wilaya_code", sa.String(length=10), nullable=True),
        sa.Column("commune", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["carrier_account_id"], ["carrier_accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_carrier_warehouses_carrier_account_id", "carrier_warehouses", ["carrier_account_id"])
    op.create_index("uq_carrier_warehouses_external", "carrier_warehouses", ["carrier_account_id", "external_id"], unique=True)

    op.create_table(
        "products", _id(),
        sa.Column("merchant_id", sa.Uuid(), nullable=False),
        sa.Column("store_id", sa.Uuid(), nullable=True),
        sa.Column("sku", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("fulfillment", sa.String(length=20), nullable=False),
        sa.Column("weight_grams", sa.Integer(), nullable=True),
        _ts("created_at"), _ts("updated_at"),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("store_id", "sku", name="uq_products_store_sku"),
        sa.CheckConstraint("fulfillment IN ('carrier', 'merchant')", name="ck_products_fulfillment"),
    )
    op.create_index("ix_products_merchant_id", "products", ["merchant_id"])
    op.create_index("ix_products_store_id", "products", ["store_id"])

    op.create_table(
        "product_carrier_links", _id(),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("carrier_account_id", sa.Uuid(), nullable=False),
        sa.Column("external_product_id", sa.String(length=100), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["carrier_account_id"], ["carrier_accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_id", "carrier_account_id", name="uq_product_carrier_links"),
    )
    op.create_index("ix_product_carrier_links_product_id", "product_carrier_links", ["product_id"])
    op.create_index("ix_product_carrier_links_carrier_account_id", "product_carrier_links", ["carrier_account_id"])

    op.create_table(
        "stock_levels", _id(),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("warehouse_id", sa.Uuid(), nullable=True),
        sa.Column("on_hand", sa.Integer(), nullable=False),
        sa.Column("reserved", sa.Integer(), nullable=False),
        sa.Column("inbound", sa.Integer(), nullable=False),
        _ts("updated_at"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["warehouse_id"], ["carrier_warehouses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_id", "warehouse_id", name="uq_stock_levels_product_warehouse"),
        sa.CheckConstraint("on_hand >= 0 AND reserved >= 0 AND inbound >= 0", name="ck_stock_levels_non_negative"),
        sa.CheckConstraint("reserved <= on_hand", name="ck_stock_levels_reserved_le_on_hand"),
    )
    op.create_index("ix_stock_levels_product_id", "stock_levels", ["product_id"])
    op.create_index(
        "uq_stock_levels_product_merchant_location", "stock_levels", ["product_id"], unique=True,
        postgresql_where=sa.text("warehouse_id IS NULL"), sqlite_where=sa.text("warehouse_id IS NULL"),
    )

    op.create_table(
        "stock_deposits", _id(),
        sa.Column("merchant_id", sa.Uuid(), nullable=False),
        sa.Column("carrier_account_id", sa.Uuid(), nullable=False),
        sa.Column("warehouse_id", sa.Uuid(), nullable=True),
        sa.Column("reference", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("lines", sa.JSON(), nullable=False),
        _ts("created_at"), _ts("updated_at"),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["carrier_account_id"], ["carrier_accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["warehouse_id"], ["carrier_warehouses.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("status IN ('in_transit', 'counting', 'received')", name="ck_stock_deposits_status"),
    )
    op.create_index("ix_stock_deposits_merchant_id", "stock_deposits", ["merchant_id"])
    op.create_index("ix_stock_deposits_carrier_account_id", "stock_deposits", ["carrier_account_id"])

    op.create_table(
        "shipments", _id(),
        sa.Column("merchant_id", sa.Uuid(), nullable=False),
        sa.Column("store_id", sa.Uuid(), nullable=True),
        sa.Column("order_id", sa.Uuid(), nullable=False),
        sa.Column("environment", sa.String(length=10), nullable=False),
        sa.Column("carrier_account_id", sa.Uuid(), nullable=True),
        sa.Column("warehouse_id", sa.Uuid(), nullable=True),
        sa.Column("fulfillment", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("hold_reason", sa.String(length=30), nullable=True),
        sa.Column("tracking_number", sa.String(length=100), nullable=True),
        sa.Column("label_url", sa.String(length=1000), nullable=True),
        sa.Column("cod_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("delivery_type", sa.String(length=20), nullable=False),
        sa.Column("idempotency_key", sa.String(length=64), nullable=False),
        sa.Column("allocations", sa.JSON(), nullable=False),
        sa.Column("meta", sa.JSON(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        _ts("created_at"), _ts("updated_at"),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["carrier_account_id"], ["carrier_accounts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["warehouse_id"], ["carrier_warehouses.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("environment IN ('live', 'test')", name="ck_shipments_environment"),
        sa.CheckConstraint("fulfillment IN ('carrier', 'merchant')", name="ck_shipments_fulfillment"),
        sa.CheckConstraint("delivery_type IN ('home', 'stop_desk')", name="ck_shipments_delivery_type"),
    )
    op.create_index("ix_shipments_merchant_id", "shipments", ["merchant_id"])
    op.create_index("ix_shipments_store_id", "shipments", ["store_id"])
    op.create_index("ix_shipments_order_id", "shipments", ["order_id"])
    op.create_index("ix_shipments_status_next_attempt", "shipments", ["status", "next_attempt_at"])
    op.create_index("ix_shipments_tracking_number", "shipments", ["tracking_number"])
    op.create_index(
        "uq_shipments_order_active", "shipments", ["order_id"], unique=True,
        postgresql_where=ACTIVE_WHERE, sqlite_where=ACTIVE_WHERE,
    )

    op.create_table(
        "stock_movements", _id(),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("warehouse_id", sa.Uuid(), nullable=True),
        sa.Column("delta", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=20), nullable=False),
        sa.Column("shipment_id", sa.Uuid(), nullable=True),
        sa.Column("deposit_id", sa.Uuid(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=_now, nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["warehouse_id"], ["carrier_warehouses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["shipment_id"], ["shipments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["deposit_id"], ["stock_deposits.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "reason IN ('shipment', 'return', 'deposit', 'adjustment', 'sync')", name="ck_stock_movements_reason"
        ),
    )
    op.create_index("ix_stock_movements_shipment_id", "stock_movements", ["shipment_id"])
    op.create_index("ix_stock_movements_product_occurred", "stock_movements", ["product_id", "occurred_at"])

    op.create_table(
        "shipment_events", _id(),
        sa.Column("shipment_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("raw_status", sa.String(length=200), nullable=True),
        sa.Column("location", sa.String(length=200), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=_now, nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("dedupe_key", sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(["shipment_id"], ["shipments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("source IN ('webhook', 'poll', 'manual')", name="ck_shipment_events_source"),
    )
    op.create_index("ix_shipment_events_shipment_id", "shipment_events", ["shipment_id"])
    op.create_index("uq_shipment_events_dedupe_key", "shipment_events", ["dedupe_key"], unique=True)

    op.create_table(
        "shipping_settings", _id(),
        sa.Column("merchant_id", sa.Uuid(), nullable=False),
        sa.Column("store_id", sa.Uuid(), nullable=False),
        sa.Column("auto_dispatch", sa.Boolean(), nullable=False),
        sa.Column("dispatch_trigger", sa.String(length=30), nullable=False),
        sa.Column("hold_minutes", sa.Integer(), nullable=False),
        sa.Column("confirmation_timeout_hours", sa.Integer(), nullable=False, server_default="24"),
        sa.Column("retry_max", sa.Integer(), nullable=False),
        sa.Column("retry_interval_minutes", sa.Integer(), nullable=False),
        sa.Column("fallback_enabled", sa.Boolean(), nullable=False),
        sa.Column("out_of_stock_policy", sa.String(length=20), nullable=False),
        sa.Column("low_stock_days", sa.Integer(), nullable=False),
        sa.Column("reserve_on_accept", sa.Boolean(), nullable=False),
        sa.Column("disable_product_when_out", sa.Boolean(), nullable=False),
        sa.Column("pickup_name", sa.String(length=150), nullable=True),
        sa.Column("pickup_wilaya", sa.String(length=100), nullable=True),
        sa.Column("pickup_commune", sa.String(length=100), nullable=True),
        sa.Column("pickup_phone", sa.String(length=32), nullable=True),
        sa.Column("label_size", sa.String(length=10), nullable=False),
        sa.Column("notify_on_hold", sa.Boolean(), nullable=False),
        sa.Column("notify_on_failure", sa.Boolean(), nullable=False),
        sa.Column("notify_on_low_stock", sa.Boolean(), nullable=False),
        _ts("created_at"), _ts("updated_at"),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("store_id"),
        sa.CheckConstraint("dispatch_trigger IN ('after_confirmation', 'on_allow')", name="ck_shipping_settings_trigger"),
        sa.CheckConstraint(
            "out_of_stock_policy IN ('hold', 'backorder', 'other_warehouse')", name="ck_shipping_settings_oos_policy"
        ),
    )
    op.create_index("ix_shipping_settings_merchant_id", "shipping_settings", ["merchant_id"])

    op.create_table(
        "shipping_routes", _id(),
        sa.Column("merchant_id", sa.Uuid(), nullable=False),
        sa.Column("store_id", sa.Uuid(), nullable=False),
        sa.Column("wilaya_codes", sa.JSON(), nullable=False),
        sa.Column("carrier_account_id", sa.Uuid(), nullable=False),
        sa.Column("fallback_carrier_account_id", sa.Uuid(), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["carrier_account_id"], ["carrier_accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["fallback_carrier_account_id"], ["carrier_accounts.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_shipping_routes_merchant_id", "shipping_routes", ["merchant_id"])
    op.create_index("ix_shipping_routes_store_priority", "shipping_routes", ["store_id", "priority"])

    conn = op.get_bind()
    for key_id, raw in _dashboard_keys(conn):
        scopes = _as_list(raw)
        merged = scopes + [s for s in NEW_SCOPES if s not in scopes]
        if merged != scopes:
            _write_scopes(conn, key_id, merged)


def downgrade() -> None:
    conn = op.get_bind()
    for key_id, raw in _dashboard_keys(conn):
        scopes = _as_list(raw)
        kept = [s for s in scopes if s not in NEW_SCOPES]
        if kept != scopes:
            _write_scopes(conn, key_id, kept)

    for table in (
        "shipping_routes", "shipping_settings", "shipment_events", "stock_movements", "shipments",
        "stock_deposits", "stock_levels", "product_carrier_links", "products", "carrier_warehouses",
        "carrier_accounts",
    ):
        op.drop_table(table)
    op.drop_column("orders", "stop_desk_id")
    op.drop_column("orders", "delivery_type")
