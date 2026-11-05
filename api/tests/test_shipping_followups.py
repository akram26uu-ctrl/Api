"""Deferred shipping follow-ups: batched pending warehouses, cancel failures, closed orders,
two-environment hold re-evaluation, bounded sandbox cache."""
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event

from app.db.database import SessionLocal, engine
from app.main import app
from app.models.enums import OrderStatus
from app.models.notification import Notification
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product, StockLevel
from app.models.shipment import Shipment
from app.services.carrier_account_service import CarrierAccountService
from app.services.carriers.base import Capabilities, CarrierUnavailable
from app.services.shipping_service import ShippingService
from tests import test_carrier_sandbox as sbx
from tests import test_inventory as inv
from tests import test_shipments_api as sa
from tests import test_shipping_service as ss

client = TestClient(app)


def _items(order_id, sku, qty=1):
    with SessionLocal() as db:
        db.add(OrderItem(order_id=order_id, sku=sku, product_name=sku, quantity=qty, unit_price=Decimal("10")))
        db.commit()


def test_pending_available_warehouses_batched():
    w = sa._world()
    with SessionLocal() as db:
        for sku, stock in (("FU-A", 5), ("FU-B", 0)):
            p = Product(merchant_id=w["merchant"], store_id=w["store"], sku=sku, name=sku, fulfillment="carrier")
            db.add(p)
            db.flush()
            db.add(StockLevel(product_id=p.id, warehouse_id=w["warehouse"], on_hand=stock, reserved=0, inbound=0))
        db.commit()
    ids = {}
    for sku in ("FU-A", "fu-a ", "FU-B", "FU-A"):
        order = sa._order(w)
        _items(order, sku)
        ids.setdefault(sku, []).append(str(sa._shipment(w, order_id=order, hold="out_of_stock")))
    statements = []

    def spy(conn, cursor, statement, *a):
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", spy)
    try:
        body = client.get(f"{sa.API}/pending?reason=stock", headers=w["h"]).json()
    finally:
        event.remove(engine, "before_cursor_execute", spy)
    assert sum(1 for s in statements if "FROM products" in s) == 1
    assert sum(1 for s in statements if "FROM stock_levels" in s) == 1
    by_id = {i["shipment_id"]: i["available_warehouses"] for i in body["data"]}
    assert len(by_id) == 4
    for sid in ids["FU-A"] + ids["fu-a "]:
        assert [x["id"] for x in by_id[sid]] == [str(w["warehouse"])]
    assert by_id[ids["FU-B"][0]] == []
    # identical to the per-shipment computation
    with SessionLocal() as db:
        svc = ShippingService(db)
        for sid, rows in by_id.items():
            single = svc.available_warehouses(db.get(Shipment, UUID(sid)))
            assert [str(x.id) for x in single] == [r["id"] for r in rows]


class _BoomAdapter:
    code = "boom"
    capabilities = Capabilities(webhooks=False, warehouses=False, stop_desks=False, cancel=True)

    def cancel_shipment(self, tracking):
        raise RuntimeError("secret-token boom")


@pytest.mark.parametrize("exc", [RuntimeError("secret-token boom"), CarrierUnavailable("down")])
def test_cancel_accepted_any_adapter_error_notifies(exc, monkeypatch):
    from app.models.enums import RiskDecision
    adapter = _BoomAdapter()
    adapter.cancel_shipment = lambda tracking: (_ for _ in ()).throw(exc)
    monkeypatch.setattr(CarrierAccountService, "adapter_for", lambda self, account: adapter)
    with SessionLocal() as db:
        merchant, store, acc = ss._world(db)
        order = ss._order(db, merchant, store)
        s = ShippingService(db).on_decision(order, merchant, RiskDecision.ALLOW)
        s.status, s.tracking_number, s.carrier_account_id = "accepted", "TRK1", acc.id
        ShippingService(db).on_cancelled(order)
        assert s.status == "accepted"
        assert db.query(Notification).filter_by(
            resource_id=str(s.id), notification_type="shipment.cancel_failed").count() == 1
        assert "secret-token" not in (s.last_error or "")
        db.rollback()


@pytest.mark.parametrize("closed", [OrderStatus.CANCELLED, OrderStatus.RETURNED, OrderStatus.DELIVERED])
def test_create_and_retry_refuse_closed_orders(closed):
    w = sa._world()
    order = sa._order(w)
    failed = sa._shipment(w, order_id=order, status="dispatch_failed")
    with SessionLocal() as db:
        db.get(Order, order).status = closed
        db.commit()
    r = client.post(f"{sa.API}/shipments", json={"order_id": str(order)}, headers=w["h"])
    assert r.status_code == 409 and r.json()["detail"] == "order_closed"
    r = client.post(f"{sa.API}/shipments/{failed}/retry", headers=w["h"])
    assert r.status_code == 409 and r.json()["detail"] == "order_closed"
    with SessionLocal() as db:
        assert db.query(Shipment).filter_by(order_id=order).count() == 1


def test_product_change_reevaluates_both_environments(monkeypatch):
    merchant_id, store_id, headers = inv._setup()
    calls = []
    monkeypatch.setattr(ShippingService, "reevaluate_store_holds",
                        lambda self, sid, env=None: calls.append((sid, env)) or 0)
    r = client.post("/api/v1/inventory/products", json={"sku": f"RE-{uuid4().hex[:6]}", "name": "P"}, headers=headers)
    assert r.status_code in (200, 201), r.text
    assert calls == [(store_id, "live"), (store_id, "test")]


def test_sandbox_state_cache_is_bounded(monkeypatch):
    monkeypatch.setattr(sbx.sandbox, "_STATE", {})
    monkeypatch.setattr(sbx.sandbox, "_STATE_MAX", 3)
    monkeypatch.setattr(sbx.sandbox, "SANDBOX_CLOCK", lambda: sbx.T0)
    c = sbx.SandboxCarrier(sbx.CREDS)
    for i in range(6):
        c.create_shipment(sbx._req(f"k{i}"))
    assert list(sbx.sandbox._STATE) == ["k3", "k4", "k5"]
    assert c.create_shipment(sbx._req("k5")).tracking_number == sbx.sandbox._STATE["k5"]
