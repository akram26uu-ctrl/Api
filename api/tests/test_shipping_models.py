from decimal import Decimal
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from app.db.database import SessionLocal
from app.models.merchant import Merchant
from app.models.order import Order
from app.schemas.api_key import AVAILABLE_API_KEY_SCOPES
from app.schemas.order import OrderCreate


@pytest.fixture()
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def _product(db, merchant, sku):
    from app.models.product import Product
    from app.models.store import Store

    store = Store(merchant_id=merchant.id, name="S", slug=uuid4().hex[:8])
    db.add(store)
    db.flush()
    product = Product(merchant_id=merchant.id, store_id=store.id, sku=sku, name="P")
    db.add(product)
    db.flush()
    return product


def _order(db):
    merchant = Merchant(name="M", email=f"{uuid4().hex}@example.com")
    db.add(merchant)
    db.flush()
    order = Order(
        merchant_id=merchant.id, external_order_id=uuid4().hex, total_amount=Decimal("100"),
        first_name="A", last_name="B",
    )
    db.add(order)
    db.flush()
    return merchant, order


def test_stock_level_rejects_reserved_above_on_hand(db):
    from app.models.product import Product, StockLevel

    merchant, _ = _order(db)
    product = _product(db, merchant, "SKU1")
    db.add(StockLevel(product_id=product.id, warehouse_id=None, on_hand=1, reserved=2))
    with pytest.raises(IntegrityError):
        db.flush()


def test_one_active_shipment_per_order(db):
    from app.models.shipment import Shipment

    merchant, order = _order(db)

    def make():
        sid = uuid4()
        return Shipment(id=sid, merchant_id=merchant.id, order_id=order.id, status="pending_dispatch",
                        idempotency_key=str(sid))

    first = make()
    db.add(first)
    db.flush()
    db.add(make())
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()

    merchant, order = _order(db)
    first = Shipment(id=uuid4(), merchant_id=merchant.id, order_id=order.id, status="pending_dispatch",
                     idempotency_key="k1")
    db.add(first)
    db.flush()
    first.status = "cancelled"
    db.flush()
    db.add(Shipment(id=uuid4(), merchant_id=merchant.id, order_id=order.id, status="pending_dispatch",
                    idempotency_key="k2"))
    db.flush()


def test_merchant_stock_location_unique_per_product(db):
    from app.models.product import Product, StockLevel

    merchant, _ = _order(db)
    product = _product(db, merchant, "SKU2")
    db.add(StockLevel(product_id=product.id, warehouse_id=None, on_hand=1))
    db.flush()
    db.add(StockLevel(product_id=product.id, warehouse_id=None, on_hand=2))
    with pytest.raises(IntegrityError):
        db.flush()


def test_order_create_accepts_delivery_type():
    base = dict(external_order_id="1", first_name="A", last_name="B", phone="0555123456", wilaya="Alger",
                commune="Alger", address="rue 1", total_amount="1000")
    assert OrderCreate(**base).delivery_type == "home"
    order = OrderCreate(**base, delivery_type="stop_desk", stop_desk_id="D1")
    assert order.delivery_type == "stop_desk" and order.stop_desk_id == "D1"
    with pytest.raises(ValidationError):
        OrderCreate(**base, delivery_type="drone")


def test_new_scopes_available():
    for scope in ("shipping:read", "shipping:write", "inventory:read", "inventory:write"):
        assert scope in AVAILABLE_API_KEY_SCOPES


def test_migration_chain_head():
    cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    cfg.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "migrations"))
    assert ScriptDirectory.from_config(cfg).get_heads() == ["f3c9a1d7e2b5"]


def test_shipping_settings_defaults(db):
    from app.models.shipping_settings import ShippingSettings
    from app.models.store import Store

    merchant, _ = _order(db)
    store = Store(merchant_id=merchant.id, name="S", slug=uuid4().hex[:8])
    db.add(store)
    db.flush()
    settings = ShippingSettings(merchant_id=merchant.id, store_id=store.id)
    db.add(settings)
    db.flush()
    assert settings.confirmation_timeout_hours == 24
    assert settings.auto_dispatch is True and settings.hold_minutes == 15


def test_integration_maps_stop_desk_shipping_method():
    from app.api.v1.integrations import _normalize_order

    payload = {
        "billing": {"first_name": "A", "last_name": "B", "phone": "0555123456", "city": "Alger", "address_1": "rue 1"},
        "shipping_lines": [{"method_title": "Livraison Bureau (Yalidine)"}],
        "total": "1000", "currency": "DZD",
    }
    assert _normalize_order(payload, "9").delivery_type == "stop_desk"
    payload["shipping_lines"] = [{"method_title": "Livraison à domicile"}]
    assert _normalize_order(payload, "9").delivery_type == "home"
    payload.pop("shipping_lines")
    assert _normalize_order(payload, "9").delivery_type == "home"


def _load_migration():
    import importlib.util

    path = Path(__file__).resolve().parents[1] / "migrations" / "versions" / "f3c9a1d7e2b5_add_shipping_and_inventory.py"
    spec = importlib.util.spec_from_file_location("mig_f3c9", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_migration_scope_data_steps():
    import json
    import sqlalchemy as sa

    mig = _load_migration()
    engine = sa.create_engine("sqlite+pysqlite://")
    dash, other, system_other = uuid4(), uuid4(), uuid4()
    existing = ["orders:read", "audit:read", "inventory:read"]
    with engine.begin() as conn:
        conn.execute(sa.text(
            "CREATE TABLE api_keys (id CHAR(32) PRIMARY KEY, name TEXT, key_kind TEXT, scopes JSON)"
        ))
        for kid, name, kind, scopes in (
            (dash, "Dashboard session (test)", "system", existing),
            (other, "Dashboard session (live)", "customer", ["orders:read"]),
            (system_other, "Initial test key", "system", ["orders:write"]),
        ):
            conn.execute(sa.text("INSERT INTO api_keys VALUES (:i, :n, :k, :s)"),
                         {"i": kid.hex, "n": name, "k": kind, "s": json.dumps(scopes)})

        def scopes_of(kid):
            return json.loads(conn.execute(sa.text("SELECT scopes FROM api_keys WHERE id = :i"), {"i": kid.hex}).scalar())

        mig.append_scopes(conn)
        mig.append_scopes(conn)  # idempotent: no duplicates
        assert scopes_of(dash) == existing + ["shipping:read", "shipping:write", "inventory:write"]
        assert scopes_of(other) == ["orders:read"]
        assert scopes_of(system_other) == ["orders:write"]

        mig.remove_scopes(conn)
        assert scopes_of(dash) == ["orders:read", "audit:read"]
        assert scopes_of(other) == ["orders:read"]
        assert scopes_of(system_other) == ["orders:write"]


def test_label_size_default_and_check(db):
    from app.models.shipping_settings import ShippingSettings
    from app.models.store import Store

    merchant, _ = _order(db)
    store = Store(merchant_id=merchant.id, name="S", slug=uuid4().hex[:8])
    db.add(store)
    db.flush()
    settings = ShippingSettings(merchant_id=merchant.id, store_id=store.id)
    db.add(settings)
    db.flush()
    assert settings.label_size == "a6"
    settings.label_size = "A6"
    with pytest.raises(IntegrityError):
        db.flush()


def test_product_requires_store(db):
    from app.models.product import Product

    merchant, _ = _order(db)
    db.add(Product(merchant_id=merchant.id, store_id=None, sku="X", name="P"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_shipment_event_dedupe_is_per_shipment(db):
    from app.models.shipment import Shipment, ShipmentEvent

    merchant, order = _order(db)
    _, order2 = _order(db)
    shipments = []
    for o in (order, order2):
        s = Shipment(merchant_id=o.merchant_id, order_id=o.id, environment="test", idempotency_key=uuid4().hex)
        db.add(s)
        db.flush()
        shipments.append(s)
    assert shipments[0].last_polled_at is None
    for s in shipments:  # the same carrier key on two shipments is allowed
        db.add(ShipmentEvent(shipment_id=s.id, status="accepted", source="poll", dedupe_key="SAME:accepted"))
    db.flush()
    db.add(ShipmentEvent(shipment_id=shipments[0].id, status="accepted", source="poll", dedupe_key="SAME:accepted"))
    with pytest.raises(IntegrityError):
        db.flush()
