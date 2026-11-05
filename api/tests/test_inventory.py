from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.carrier_account import CarrierAccount
from app.models.carrier_warehouse import CarrierWarehouse
from app.models.enums import MerchantStatus, OrderStatus
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product, StockDeposit, StockLevel, StockMovement
from app.models.shipment import Shipment
from app.models.store import Store
from app.services.api_key_service import ApiKeyService
from app.services.inventory_service import InsufficientStock, InventoryService

client = TestClient(app)
SCOPES = ("shipping:read", "shipping:write", "inventory:read", "inventory:write")


def _setup(environment="test", unbound=False):
    with SessionLocal() as db:
        merchant = Merchant(name="Inv", email=f"inv-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE,
                            is_shadow_mode_enabled=False)
        db.add(merchant)
        db.flush()
        store = Store(merchant_id=merchant.id, name="S", slug=f"s-{uuid4().hex[:8]}")
        db.add(store)
        db.flush()
        key, raw = ApiKeyService(db).create_key(merchant=merchant, name="k", environment=environment, scopes=list(SCOPES))
        if unbound:
            key.store_id = None
        db.commit()
        return merchant.id, store.id, {"Authorization": f"Bearer {raw}"}


@pytest.fixture
def ctx():
    merchant_id, store_id, headers = _setup()
    with SessionLocal() as db:
        yield db, merchant_id, store_id, headers
        db.rollback()


def _product(db, merchant_id, store_id, sku="SNK-BLK-42", fulfillment="carrier", on_hand=None, warehouse_id=None):
    p = Product(merchant_id=merchant_id, store_id=store_id, sku=sku, name=sku, fulfillment=fulfillment)
    db.add(p)
    db.flush()
    if on_hand is not None:
        db.add(StockLevel(product_id=p.id, warehouse_id=warehouse_id, on_hand=on_hand, reserved=0, inbound=0))
        db.flush()
    return p


def _shipment(db, merchant_id, store_id):
    order = Order(merchant_id=merchant_id, store_id=store_id, external_order_id=f"o-{uuid4()}",
                  status=OrderStatus.PENDING, total_amount=100, currency="DZD", first_name="A", last_name="B",
                  environment="test", data_origin="real")
    db.add(order)
    db.flush()
    s = Shipment(merchant_id=merchant_id, store_id=store_id, order_id=order.id, environment="test",
                 idempotency_key=str(uuid4()))
    db.add(s)
    db.flush()
    return s, order


def _account(db, merchant_id, store_id):
    acc = CarrierAccount(merchant_id=merchant_id, store_id=store_id, environment="test", carrier_code="sandbox",
                         display_name="sb", status="active")
    db.add(acc)
    db.flush()
    for ext in ("ORN", "ALG"):
        db.add(CarrierWarehouse(carrier_account_id=acc.id, external_id=ext, name=ext))
    db.flush()
    return acc


def test_sku_match_is_case_and_space_insensitive(ctx):
    db, merchant_id, store_id, _ = ctx
    p = _product(db, merchant_id, store_id, "SNK-BLK-42")
    item = OrderItem(sku=" snk-blk-42 ", product_name="x", quantity=1, unit_price=Decimal("1"))
    other = OrderItem(sku="nope", product_name="y", quantity=1, unit_price=Decimal("1"))
    matched, unmatched = InventoryService(db).match_items(store_id, [item, other])
    assert matched == [(item, p)] and unmatched == [other]
    assert InventoryService.normalize_sku("  A   b ") == "a b"
    assert InventoryService.normalize_sku("   ") is None and InventoryService.normalize_sku(None) is None


def test_reserve_then_release_restores_available(ctx):
    db, merchant_id, store_id, _ = ctx
    p = _product(db, merchant_id, store_id, on_hand=5)
    s, _ = _shipment(db, merchant_id, store_id)
    svc = InventoryService(db)
    svc.reserve(s, [(p, None, 2)])
    assert svc.available(p.id, None) == 3
    assert s.allocations == [{"product_id": str(p.id), "warehouse_id": None, "quantity": 2}]
    svc.release(s)
    assert svc.available(p.id, None) == 5


def test_reserve_beyond_available_raises(ctx):
    db, merchant_id, store_id, _ = ctx
    p = _product(db, merchant_id, store_id, on_hand=1)
    s, _ = _shipment(db, merchant_id, store_id)
    with pytest.raises(InsufficientStock):
        InventoryService(db).reserve(s, [(p, None, 2)])
    assert InventoryService(db).available(p.id, None) == 1


def test_consume_and_restock_write_movements(ctx):
    db, merchant_id, store_id, _ = ctx
    p = _product(db, merchant_id, store_id, on_hand=5)
    s, _ = _shipment(db, merchant_id, store_id)
    svc = InventoryService(db)
    svc.reserve(s, [(p, None, 1)])
    svc.consume(s)
    level = db.query(StockLevel).filter_by(product_id=p.id).one()
    assert (level.on_hand, level.reserved) == (4, 0)
    svc.restock(s)
    db.refresh(level)
    assert level.on_hand == 5
    moves = db.query(StockMovement).filter_by(shipment_id=s.id).order_by(StockMovement.occurred_at, StockMovement.delta).all()
    assert sorted(m.delta for m in moves) == [-1, 1]
    assert {m.reason for m in moves} == {"shipment", "return"}


def test_import_carrier_stock_creates_products_and_links(ctx):
    db, merchant_id, store_id, _ = ctx
    acc = _account(db, merchant_id, store_id)
    from app.services.carriers.registry import get_adapter
    stock = get_adapter("sandbox", {"api_token": "test_abc"}, "test").list_stock()
    svc = InventoryService(db)
    svc.import_carrier_stock(acc, stock)
    products = db.query(Product).filter_by(store_id=store_id).all()
    assert len(products) == 3 and all(p.fulfillment == "carrier" for p in products)
    assert db.query(StockMovement).join(Product, Product.id == StockMovement.product_id).filter(Product.store_id == store_id, StockMovement.reason == "sync").count() == 3
    svc.import_carrier_stock(acc, stock)  # idempotent
    assert db.query(Product).filter_by(store_id=store_id).count() == 3
    assert db.query(StockMovement).join(Product, Product.id == StockMovement.product_id).filter(Product.store_id == store_id, StockMovement.reason == "sync").count() == 3


def test_deposit_received_increases_on_hand(ctx):
    db, merchant_id, store_id, _ = ctx
    acc = _account(db, merchant_id, store_id)
    wh = db.query(CarrierWarehouse).filter_by(carrier_account_id=acc.id, external_id="ORN").one()
    p = _product(db, merchant_id, store_id, "ABC-1", on_hand=2, warehouse_id=wh.id)
    dep = StockDeposit(merchant_id=merchant_id, carrier_account_id=acc.id, warehouse_id=wh.id, reference="D1",
                       status="counting", lines=[{"sku": " abc-1", "quantity": 10}])
    db.add(dep)
    db.flush()
    InventoryService(db).receive_deposit(dep)
    assert dep.status == "received"
    assert db.query(StockLevel).filter_by(product_id=p.id).one().on_hand == 12
    assert db.query(StockMovement).filter_by(deposit_id=dep.id, reason="deposit").one().delta == 10


def test_stock_increase_hook_called(ctx, monkeypatch):
    db, merchant_id, store_id, _ = ctx
    from app.services import inventory_service
    seen = []
    monkeypatch.setattr(inventory_service, "on_stock_increased", lambda ids, _db: seen.append(set(ids)))
    acc = _account(db, merchant_id, store_id)
    p = _product(db, merchant_id, store_id, "ABC-1")
    dep = StockDeposit(merchant_id=merchant_id, carrier_account_id=acc.id, reference="D1", status="counting",
                       lines=[{"sku": "ABC-1", "quantity": 3}])
    db.add(dep)
    db.flush()
    InventoryService(db).receive_deposit(dep)
    assert seen == [{p.id}]


def test_stock_status_values(ctx):
    db, merchant_id, store_id, h = ctx
    wh_acc = _account(db, merchant_id, store_id)
    wh = db.query(CarrierWarehouse).filter_by(carrier_account_id=wh_acc.id, external_id="ORN").one()
    ok = _product(db, merchant_id, store_id, "OK", on_hand=100, warehouse_id=wh.id)
    out = _product(db, merchant_id, store_id, "OUT", on_hand=0, warehouse_id=wh.id)
    low = _product(db, merchant_id, store_id, "LOW", on_hand=10, warehouse_id=wh.id)
    mer = _product(db, merchant_id, store_id, "MER", fulfillment="merchant", on_hand=3)
    unm = _product(db, merchant_id, store_id, "UNM")
    from app.models.product import ProductCarrierLink
    for p in (ok, out, low):
        db.add(ProductCarrierLink(product_id=p.id, carrier_account_id=wh_acc.id, external_product_id=p.sku))
    # LOW sells 14/day over the last 14 days -> 10 units last < 5 days
    order = Order(merchant_id=merchant_id, store_id=store_id, external_order_id=f"o-{uuid4()}",
                  status=OrderStatus.SHIPPED, total_amount=1, currency="DZD", first_name="A", last_name="B",
                  environment="test", data_origin="real")
    order.items.append(OrderItem(sku="low", product_name="LOW", quantity=140, unit_price=Decimal("1")))
    db.add(order)
    db.commit()
    svc = InventoryService(db)
    assert svc.is_low(low) is True and svc.is_low(ok) is False
    r = client.get(f"/api/v1/inventory/stock?store_id={store_id}", headers=h)
    assert r.status_code == 200, r.text
    by = {row["sku"]: row for row in r.json()}
    assert by["OK"]["status"] == "ok" and by["OUT"]["status"] == "out" and by["LOW"]["status"] == "low"
    assert by["MER"]["status"] == "merchant" and by["UNM"]["status"] == "unmapped"
    assert by["OK"]["total_on_hand"] == 100 and by["OK"]["locations"][0]["on_hand"] == 100


def test_inventory_isolated_by_store():
    merchant_id, store_id, h = _setup()
    with SessionLocal() as db:
        other = Store(merchant_id=merchant_id, name="S2", slug=f"s-{uuid4().hex[:8]}")
        db.add(other)
        db.flush()
        _product(db, merchant_id, other.id, "ONLY-OTHER", on_hand=4)
        _product(db, merchant_id, store_id, "ONLY-MINE", on_hand=4)
        other_id = other.id
        db.commit()
    mine = client.get(f"/api/v1/inventory/products?store_id={store_id}", headers=h).json()
    assert [p["sku"] for p in mine] == ["ONLY-MINE"]
    _, _, h2 = _setup()
    assert client.get("/api/v1/inventory/products", headers=h2).json() == []
    assert client.get("/api/v1/inventory/stock", headers=h2).json() == []


def test_products_api_and_store_required():
    _, store_id, h = _setup()
    r = client.post(f"/api/v1/inventory/products?store_id={store_id}", json={"sku": "A-1", "name": "A"}, headers=h)
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    dup = client.post(f"/api/v1/inventory/products?store_id={store_id}", json={"sku": " a-1", "name": "A"}, headers=h)
    assert dup.status_code == 409
    u = client.put(f"/api/v1/inventory/products/{pid}?store_id={store_id}",
                   json={"name": "B", "fulfillment": "carrier", "weight_grams": 300}, headers=h)
    assert u.status_code == 200 and u.json()["fulfillment"] == "carrier" and u.json()["weight_grams"] == 300
    _, _, unbound = _setup(unbound=True)
    r = client.post("/api/v1/inventory/products", json={"sku": "A-1", "name": "A"}, headers=unbound)
    assert r.status_code == 422 and r.json()["detail"] == "store_id_required"


def test_deposits_api_and_movements_and_refresh():
    _, store_id, h = _setup()
    acc = client.post(f"/api/v1/shipping/carriers?store_id={store_id}", headers=h, json={
        "carrier_code": "sandbox", "display_name": "x", "credentials": {"api_token": "test_abc"}}).json()
    assert "id" in acc, acc
    stock = client.get(f"/api/v1/inventory/stock?store_id={store_id}", headers=h).json()
    assert len(stock) == 3
    assert client.get(f"/api/v1/inventory/stock?store_id={store_id}&refresh=1", headers=h).status_code == 200
    mv = client.get(f"/api/v1/inventory/movements?store_id={store_id}", headers=h).json()
    assert mv["pagination"]["total"] == 3 and mv["data"][0]["reason"] == "sync"
    d = client.post(f"/api/v1/inventory/deposits?store_id={store_id}", headers=h, json={
        "carrier_account_id": acc["id"], "reference": "R1", "lines": [{"sku": "SNK-BLK-41", "quantity": 5}]})
    assert d.status_code == 201, d.text
    did = d.json()["id"]
    assert client.post(f"/api/v1/inventory/deposits/{did}/status?store_id={store_id}", headers=h,
                       json={"status": "received"}).json()["status"] == "received"
    again = client.post(f"/api/v1/inventory/deposits/{did}/status?store_id={store_id}", headers=h,
                        json={"status": "counting"})
    assert again.status_code == 409
    row = [s for s in client.get(f"/api/v1/inventory/stock?store_id={store_id}", headers=h).json()
           if s["sku"] == "SNK-BLK-41"][0]
    assert row["total_on_hand"] == 30
    assert len(client.get(f"/api/v1/inventory/deposits?store_id={store_id}", headers=h).json()) == 1


def test_unmapped_products_endpoint():
    merchant_id, store_id, h = _setup()
    with SessionLocal() as db:
        s, order = _shipment(db, merchant_id, store_id)
        s.hold_reason = "unmapped_product"
        order.items.append(OrderItem(sku=" Zed-1 ", product_name="Zed", quantity=1, unit_price=Decimal("1")))
        db.commit()
    r = client.get(f"/api/v1/inventory/products/unmapped?store_id={store_id}", headers=h)
    assert r.status_code == 200 and r.json() == [{"sku": "zed-1", "display_sku": "Zed-1", "name": "Zed"}]


def _level_of(db, p):
    db.expire_all()
    lv = db.query(StockLevel).filter_by(product_id=p.id).one()
    return lv.on_hand, lv.reserved


def test_allocation_operations_are_idempotent(ctx):
    from app.services.inventory_service import AlreadyAllocated
    db, merchant_id, store_id, _ = ctx
    p = _product(db, merchant_id, store_id, on_hand=10)
    s1, _ = _shipment(db, merchant_id, store_id)
    s2, _ = _shipment(db, merchant_id, store_id)
    svc = InventoryService(db)
    svc.reserve(s1, [(p, None, 2)])
    svc.reserve(s2, [(p, None, 3)])
    with pytest.raises(AlreadyAllocated):
        svc.reserve(s1, [(p, None, 1)])
    svc.release(s1)
    svc.release(s1)  # double release must not free s2's reservation
    assert _level_of(db, p) == (10, 3)
    svc.consume(s1)  # after release: no-op
    assert _level_of(db, p) == (10, 3)
    svc.consume(s2)
    svc.consume(s2)
    assert _level_of(db, p) == (7, 0)
    svc.restock(s1)  # never consumed: no-op
    assert _level_of(db, p) == (7, 0)
    svc.restock(s2)
    svc.restock(s2)
    assert _level_of(db, p) == (10, 0)
    assert db.query(StockMovement).filter_by(shipment_id=s2.id).count() == 2


def test_second_receive_adds_nothing(ctx):
    db, merchant_id, store_id, _ = ctx
    acc = _account(db, merchant_id, store_id)
    p = _product(db, merchant_id, store_id, "ABC-1", on_hand=0)
    dep = StockDeposit(merchant_id=merchant_id, carrier_account_id=acc.id, reference="D", status="counting",
                       lines=[{"sku": "ABC-1", "quantity": 4}])
    db.add(dep)
    db.flush()
    svc = InventoryService(db)
    svc.receive_deposit(dep)
    svc.receive_deposit(dep)
    assert _level_of(db, p) == (4, 0)
    assert db.query(StockMovement).filter_by(deposit_id=dep.id).count() == 1


def test_stock_import_errors_are_recorded(ctx):
    from app.services.carriers.base import CarrierError
    db, merchant_id, store_id, _ = ctx
    acc = _account(db, merchant_id, store_id)

    class Broken:
        def list_stock(self):
            raise CarrierError("boom")

    InventoryService(db).import_for_account(acc, Broken())
    assert acc.last_error == "boom" and acc.status == "active"
    acc.last_error = None
    InventoryService(db).refresh_store(store_id, "test", lambda a: Broken())
    assert acc.last_error == "boom" and acc.status == "active"
