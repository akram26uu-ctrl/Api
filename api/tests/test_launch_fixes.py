"""Regression tests for the pre-launch review findings (C1-C3, I2, I5, M2, T8)."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event

from app.db.database import SessionLocal
from app.main import app
from app.models.carrier_account import CarrierAccount
from app.models.carrier_warehouse import CarrierWarehouse
from app.models.enums import OrderStatus, RiskDecision
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.product import Product, StockLevel, StockMovement
from app.models.shipment import Shipment
from app.models.webhook_delivery import WebhookDelivery
from app.models.webhook_endpoint import WebhookEndpoint
from app.services.api_key_service import ApiKeyService
from app.services.carrier_account_service import CarrierAccountService
from app.services.carriers.base import Capabilities, CarrierShipmentResult
from app.services.dispatch_service import DispatchService
from app.services.inventory_service import InventoryService
from app.services.outcome_service import record_outcome
from app.services.shipping_service import ShipmentActionRefused, ShippingService
from app.services.shipping_settings_service import ShippingSettingsService
from app.services.tracking_service import TrackingService
from tests import test_dispatch_worker as dw
from tests import test_shipping_service as ss

client = TestClient(app)


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session
        session.rollback()


class SpyAdapter:
    capabilities = Capabilities(webhooks=False, warehouses=True, stop_desks=False, cancel=True)

    def __init__(self):
        self.created, self.cancelled = [], []

    def create_shipment(self, req):
        self.created.append(req)
        return CarrierShipmentResult(f"SPY-{uuid4().hex[:6]}", None, {})

    def cancel_shipment(self, tracking):
        self.cancelled.append(tracking)

    def get_tracking(self, tracking):
        return []


@pytest.fixture
def spy(monkeypatch):
    adapter = SpyAdapter()
    monkeypatch.setattr(CarrierAccountService, "adapter_for", lambda self, account: adapter)
    return adapter


def _later():
    return datetime.now(timezone.utc) + timedelta(hours=1)


# ---- C1: cancelled orders never ship ----------------------------------------
def test_outcome_cancelled_during_hold_window_cancels_and_releases(db, spy):
    merchant, store, acc = dw._world(db)
    level = dw._product(db, merchant, store, "C1-A", dw._wh(db, acc).id, 5)
    s, order = dw._shipment(db, merchant, store, items=[("C1-A", 2)])
    assert s.hold_reason is None and s.next_attempt_at is not None and level.reserved == 2
    record_outcome(db, order, "cancelled", source="merchant", reason="customer_cancelled")
    db.refresh(level)
    assert s.status == "cancelled" and s.meta["stock"] == "released" and level.reserved == 0
    DispatchService(db, clock=_later).run_batch()
    assert spy.created == []


def test_backorder_of_cancelled_order_is_never_dispatched(db, spy):
    merchant, store, acc = dw._world(db)
    ShippingSettingsService(db).update(store.id, {"out_of_stock_policy": "backorder"})
    level = dw._product(db, merchant, store, "C1-B", dw._wh(db, acc).id, 0)
    s, order = dw._shipment(db, merchant, store, items=[("C1-B", 1)])
    assert s.hold_reason == "out_of_stock" and s.meta["backorder"] is True
    order.status = OrderStatus.CANCELLED  # cancelled by a path that has no shipping hook
    db.flush()
    level.on_hand = 5
    db.flush()
    ShippingService(db).release_backorders({level.product_id})
    assert s.status == "cancelled" and level.reserved == 0
    DispatchService(db, clock=_later).run_batch()
    assert spy.created == []


@pytest.mark.parametrize("closed", [OrderStatus.CANCELLED, OrderStatus.RETURNED, OrderStatus.DELIVERED])
def test_dispatch_guard_cancels_shipment_of_closed_order(db, spy, closed):
    merchant, store, acc = dw._world(db)
    sku = f"C1-G-{closed.value}"
    level = dw._product(db, merchant, store, sku, dw._wh(db, acc).id, 3)
    s, order = dw._shipment(db, merchant, store, items=[(sku, 1)])
    assert level.reserved == 1
    order.status = closed
    db.flush()
    assert DispatchService(db, clock=_later).dispatch_one(s) == "cancelled"
    db.refresh(level)
    assert s.status == "cancelled" and level.reserved == 0 and spy.created == []


def test_outcome_cancelled_on_accepted_shipment_attempts_carrier_cancel(db, spy):
    merchant, store, acc = dw._world(db)
    s, order = dw._shipment(db, merchant, store)
    assert DispatchService(db, clock=_later).dispatch_one(s) == "dispatched"
    assert s.status == "accepted"
    record_outcome(db, order, "cancelled", source="merchant")
    assert spy.cancelled == [s.tracking_number] and s.status == "cancelled"


def _api_order_world(confirmation=False):
    with SessionLocal() as db:
        merchant, store, acc = ss._world(db, confirmation=confirmation)
        _, raw = ApiKeyService(db).create_key(
            merchant=merchant, name="k", environment="test", store_id=store.id,
            scopes=["outcomes:write", "inventory:read", "inventory:write", "shipping:read", "shipping:write"])
        db.commit()
        return merchant.id, store.id, acc.id, {"Authorization": f"Bearer {raw}"}


def test_outcome_api_post_and_put_cancel_the_shipment():
    merchant_id, store_id, _acc, h = _api_order_world()
    with SessionLocal() as db:
        from app.models.store import Store
        merchant, store = db.get(Merchant, merchant_id), db.get(Store, store_id)
        o1 = ss._order(db, merchant, store)
        s1 = ShippingService(db).on_decision(o1, merchant, RiskDecision.ALLOW)
        o2 = ss._order(db, merchant, store)
        s2 = ShippingService(db).on_decision(o2, merchant, RiskDecision.ALLOW)
        db.commit()
        ids = (o1.id, s1.id, o2.id, s2.id)
    o1, s1, o2, s2 = ids
    r = client.post(f"/api/v1/orders/{o1}/outcome", headers=h, json={"outcome_status": "cancelled", "source": "api"})
    assert r.status_code == 201, r.text
    r = client.post(f"/api/v1/orders/{o2}/outcome", headers=h, json={"outcome_status": "returned", "source": "api"})
    assert r.status_code == 201, r.text
    with SessionLocal() as db:
        assert db.get(Shipment, s1).status == "cancelled"
        assert db.get(Shipment, s2).status == "pending_dispatch"
    r = client.put(f"/api/v1/orders/{o2}/outcome", headers=h, json={"outcome_status": "cancelled"})
    assert r.status_code == 200, r.text
    with SessionLocal() as db:
        assert db.get(Shipment, s2).status == "cancelled"


def test_reject_still_records_once_with_cancel_hook(db):
    merchant, store, _ = ss._world(db)
    order = ss._order(db, merchant, store)
    svc = ShippingService(db)
    s = svc.on_decision(order, merchant, RiskDecision.REJECT)
    svc.reject(s, "key")
    from app.models.notification import Notification
    assert s.status == "cancelled" and order.status == OrderStatus.CANCELLED
    assert db.query(Notification).filter_by(resource_id=str(s.id),
                                            notification_type="shipment.cancel_after_pickup").count() == 0


# ---- C2: holds are re-evaluated when the cause is fixed -----------------------
def test_unmapped_hold_released_by_product_create_to_awaiting_confirmation():
    merchant_id, store_id, _acc, h = _api_order_world(confirmation=True)
    with SessionLocal() as db:
        from app.models.store import Store
        merchant, store = db.get(Merchant, merchant_id), db.get(Store, store_id)
        order = ss._order(db, merchant, store, [("NEW-SKU-1", 1)])
        s = ShippingService(db).on_decision(order, merchant, RiskDecision.ALLOW)
        assert s.hold_reason == "unmapped_product" and s.meta["needs_confirmation"] is True
        db.commit()
        sid = s.id
    r = client.post(f"/api/v1/inventory/products?store_id={store_id}", headers=h,
                    json={"sku": " new-sku-1 ", "name": "New", "fulfillment": "merchant"})
    assert r.status_code == 201, r.text
    with SessionLocal() as db:
        s = db.get(Shipment, sid)
        assert s.hold_reason == "awaiting_confirmation" and s.next_attempt_at is None
        assert s.meta["stock"] == "untracked"
        s.status = "cancelled"  # leave no platform-wide awaiting row behind for other tests' expiry counts
        db.commit()


def test_mixed_source_released_by_fulfillment_update():
    merchant_id, store_id, _acc, h = _api_order_world()
    with SessionLocal() as db:
        from app.models.store import Store
        merchant, store = db.get(Merchant, merchant_id), db.get(Store, store_id)
        ss._product(db, merchant, store, "MX-C", "carrier")
        mer = ss._product(db, merchant, store, "MX-M", "merchant")
        order = ss._order(db, merchant, store, [("MX-C", 1), ("MX-M", 1)])
        s = ShippingService(db).on_decision(order, merchant, RiskDecision.ALLOW)
        assert s.hold_reason == "mixed_source"
        db.commit()
        sid, carrier_pid = s.id, db.query(Product.id).filter_by(store_id=store.id, sku="MX-C").scalar()
    r = client.put(f"/api/v1/inventory/products/{carrier_pid}?store_id={store_id}", headers=h,
                   json={"fulfillment": "merchant"})
    assert r.status_code == 200, r.text
    with SessionLocal() as db:
        s = db.get(Shipment, sid)
        assert s.hold_reason is None and s.next_attempt_at is not None and s.fulfillment == "merchant"


def test_reevaluate_respects_hold_policy_and_lingering_no_answer(db):
    merchant, store, acc = ss._world(db, confirmation=True)
    svc = ShippingService(db)
    plain = svc.on_decision(ss._order(db, merchant, store, [("RV-1", 1)]), merchant, RiskDecision.ALLOW)
    assert plain.hold_reason == "unmapped_product"
    timed_out = svc.on_decision(ss._order(db, merchant, store, [("RV-1", 1)]), merchant, RiskDecision.ALLOW)
    svc._set_meta(timed_out, no_answer=True)
    wh = db.query(CarrierWarehouse).filter_by(carrier_account_id=acc.id).first()
    p = ss._product(db, merchant, store, "RV-1", "carrier", stock=[])
    assert svc.reevaluate_store_holds(store.id, "test") == 2
    # plain "hold" policy: out of stock now, and stays for the merchant to decide
    assert plain.hold_reason == "out_of_stock" and not plain.meta.get("backorder")
    db.add(StockLevel(product_id=p.id, warehouse_id=wh.id, on_hand=5, reserved=0, inbound=0))
    db.flush()
    assert svc.reevaluate_store_holds(store.id, "test") == 0
    assert plain.hold_reason == "out_of_stock"
    # backorder: released; the customer who timed out lands on no_answer, not awaiting
    for s in (plain, timed_out):
        svc._set_meta(s, backorder=True)
    assert svc.reevaluate_store_holds(store.id, "test") == 2
    assert plain.hold_reason == "awaiting_confirmation" and timed_out.hold_reason == "no_answer"
    assert plain.next_attempt_at is None and timed_out.next_attempt_at is None


def test_reevaluate_never_touches_risk_holds(db):
    merchant, store, _ = ss._world(db)
    svc = ShippingService(db)
    review = svc.on_decision(ss._order(db, merchant, store, [("RK-1", 1)]), merchant, RiskDecision.REVIEW)
    ss._product(db, merchant, store, "RK-1", "merchant")
    svc.reevaluate_store_holds(store.id)
    assert review.hold_reason == "review" and review.next_attempt_at is None


def test_worker_housekeeping_is_gated(db, tmp_path, monkeypatch):
    from scripts import dispatch_shipments
    monkeypatch.setattr(dispatch_shipments, "STAMP_DIR", tmp_path)
    calls = {"expire": 0, "reevaluate": 0}
    monkeypatch.setattr(ShippingService, "expire_unconfirmed",
                        lambda self, now=None: calls.__setitem__("expire", calls["expire"] + 1) or 0)
    monkeypatch.setattr(ShippingService, "stores_with_stock_holds", lambda self: [(uuid4(), "test")])
    monkeypatch.setattr(ShippingService, "reevaluate_store_holds",
                        lambda self, sid, env=None: calls.__setitem__("reevaluate", calls["reevaluate"] + 1) or 1)
    t0 = 1_000_000.0
    assert dispatch_shipments.housekeeping(db, t0) == {"expired": 0, "reevaluated": 1}
    assert dispatch_shipments.housekeeping(db, t0 + 60) == {}
    assert dispatch_shipments.housekeeping(db, t0 + 301) == {"expired": 0}
    assert dispatch_shipments.housekeeping(db, t0 + 400) == {}
    assert dispatch_shipments.housekeeping(db, t0 + 601) == {"expired": 0, "reevaluated": 1}
    assert calls == {"expire": 3, "reevaluate": 2}


def test_worker_main_runs_batch_without_expiry(monkeypatch, tmp_path):
    from scripts import dispatch_shipments
    monkeypatch.setattr(dispatch_shipments, "STAMP_DIR", tmp_path)
    seen = {}

    def run_batch(self, limit=50, commit=None, expire=True):
        seen["expire"] = expire
        return {}

    monkeypatch.setattr(dispatch_shipments, "housekeeping", lambda db, now=None: {})
    monkeypatch.setattr(DispatchService, "run_batch", run_batch)
    dispatch_shipments.main()
    assert seen == {"expire": False}


# ---- C3 + I6: merchant-location stock ------------------------------------------
def _live_world(db):
    merchant, store, _ = ss._world(db, linked=False)
    acc = CarrierAccount(merchant_id=merchant.id, store_id=store.id, environment="live", carrier_code="sandbox",
                         display_name="live", status="active", created_at=datetime.now(timezone.utc) - timedelta(hours=1))
    db.add(acc)
    db.flush()
    return merchant, store, acc


def _live_order(db, merchant, store, items):
    order = dw._order(db, merchant, store, items=items)
    order.environment = "live"
    db.flush()
    return order


def test_live_merchant_untracked_ships_without_reservation(db, spy):
    merchant, store, acc = _live_world(db)
    ss._product(db, merchant, store, "UT-1", "merchant")
    order = _live_order(db, merchant, store, [("UT-1", 2)])
    s = ShippingService(db).on_decision(order, merchant, RiskDecision.ALLOW)
    assert s.hold_reason is None and s.fulfillment == "merchant" and s.meta["stock"] == "untracked"
    assert s.allocations == []
    assert DispatchService(db, clock=_later).dispatch_one(s) == "dispatched" and len(spy.created) == 1
    TrackingService(db).apply_events(s, [dw_event(s, "delivered")], "poll")
    assert s.status == "delivered" and s.meta["stock"] == "untracked"
    assert db.query(StockLevel).join(Product).filter(Product.sku == "UT-1", Product.store_id == store.id).count() == 0


def dw_event(s, status):
    from app.services.carriers.base import TrackingEvent
    return TrackingEvent(status, status, None, datetime.now(timezone.utc), f"{s.tracking_number}:{status}")


def test_live_tracked_merchant_stock_is_reserved_and_can_run_out(db):
    merchant, store, acc = _live_world(db)
    p = ss._product(db, merchant, store, "TR-M", "merchant", stock=[(None, 1)])
    svc = ShippingService(db)
    s1 = svc.on_decision(_live_order(db, merchant, store, [("TR-M", 1)]), merchant, RiskDecision.ALLOW)
    assert s1.hold_reason is None and s1.meta["stock"] == "reserved"
    assert InventoryService(db).available(p.id, None) == 0
    s2 = svc.on_decision(_live_order(db, merchant, store, [("TR-M", 1)]), merchant, RiskDecision.ALLOW)
    assert s2.hold_reason == "out_of_stock"
    InventoryService(db).consume(s1)
    level = db.query(StockLevel).filter_by(product_id=p.id).one()
    assert (level.on_hand, level.reserved) == (0, 0)


def test_test_environment_never_touches_merchant_stock(db, spy):
    merchant, store, acc = dw._world(db)
    p = ss._product(db, merchant, store, "TS-M", "merchant", stock=[(None, 5)])
    s, order = dw._shipment(db, merchant, store, items=[("TS-M", 2)])
    assert s.environment == "test" and s.meta["stock"] == "untracked" and s.allocations == []
    level = db.query(StockLevel).filter_by(product_id=p.id).one()
    assert (level.on_hand, level.reserved) == (5, 0)
    # even a (legacy) merchant-location allocation on a TEST shipment never moves stock
    inv = InventoryService(db)
    s.allocations = [{"product_id": str(p.id), "warehouse_id": None, "quantity": 2}]
    inv._set_state(s, "reserved")
    inv.consume(s)
    inv._set_state(s, "consumed")
    inv.restock(s)
    db.refresh(level)
    assert (level.on_hand, level.reserved) == (5, 0)
    assert db.query(StockMovement).filter_by(product_id=p.id).count() == 0


# ---- I2: actions re-read the row under a lock -----------------------------------
def test_cancel_on_stale_instance_sees_concurrent_accept(spy):
    with SessionLocal() as db:
        merchant, store, acc = dw._world(db)
        s, order = dw._shipment(db, merchant, store)
        db.commit()
        sid, acc_id = s.id, acc.id
    with SessionLocal() as stale_session:
        stale = stale_session.get(Shipment, sid)
        assert stale.status == "pending_dispatch"
        with SessionLocal() as other:  # the worker accepts it meanwhile
            row = other.get(Shipment, sid)
            row.status, row.tracking_number, row.carrier_account_id = "accepted", "SPY-RACE", acc_id
            other.commit()
        ShippingService(stale_session).cancel_shipment(stale, "key")
        assert stale.status == "cancelled" and spy.cancelled == ["SPY-RACE"]
        stale_session.rollback()


def test_reject_on_stale_instance_refused_after_concurrent_cancel():
    with SessionLocal() as db:
        merchant, store, _ = ss._world(db)
        s = ShippingService(db).on_decision(ss._order(db, merchant, store), merchant, RiskDecision.REVIEW)
        db.commit()
        sid = s.id
    with SessionLocal() as stale_session:
        stale = stale_session.get(Shipment, sid)
        with SessionLocal() as other:
            other.get(Shipment, sid).status = "cancelled"
            other.commit()
        for action in ("reject", "approve", "archive"):
            with pytest.raises(ShipmentActionRefused):
                getattr(ShippingService(stale_session), action)(stale, "key")
        stale_session.rollback()


# ---- I5: expire_unconfirmed only loads rows that can change ------------------------
def test_expire_selects_only_changeable_rows(db):
    loaded: list = []

    def on_load(target, _ctx):
        loaded.append(target.id)

    merchant, store, _ = ss._world(db, confirmation=True)
    svc = ShippingService(db)
    young = svc.on_decision(ss._order(db, merchant, store), merchant, RiskDecision.ALLOW)
    old = svc.on_decision(ss._order(db, merchant, store), merchant, RiskDecision.ALLOW)
    parked = svc.on_decision(ss._order(db, merchant, store), merchant, RiskDecision.ALLOW)
    parked.hold_reason = "no_answer"
    now = datetime.now(timezone.utc)
    old.created_at = now - timedelta(hours=3)
    parked.created_at = now - timedelta(hours=30)
    ShippingSettingsService(db).update(store.id, {"confirmation_timeout_hours": 2})
    # a second store with the default 24 h timeout: a 3 h old row must not be touched
    m2, store2, _ = ss._world(db, confirmation=True)
    other = svc.on_decision(ss._order(db, m2, store2), m2, RiskDecision.ALLOW)
    other.created_at = now - timedelta(hours=3)
    db.flush()
    db.expunge_all()
    event.listen(Shipment, "load", on_load)
    try:
        assert ShippingService(db).expire_unconfirmed(now) >= 1
    finally:
        event.remove(Shipment, "load", on_load)
    assert old.id in loaded
    assert young.id not in loaded and parked.id not in loaded and other.id not in loaded
    assert db.get(Shipment, old.id).hold_reason == "no_answer"
    assert db.get(Shipment, other.id).hold_reason == "awaiting_confirmation"


def test_expire_releases_when_store_stops_waiting(db):
    merchant, store, _ = ss._world(db, confirmation=True)
    svc = ShippingService(db)
    s = svc.on_decision(ss._order(db, merchant, store), merchant, RiskDecision.ALLOW)
    parked = svc.on_decision(ss._order(db, merchant, store), merchant, RiskDecision.ALLOW)
    parked.hold_reason = "no_answer"
    merchant.whatsapp_confirmation_enabled = False
    db.flush()
    assert svc.expire_unconfirmed() >= 2
    assert s.hold_reason is None and parked.hold_reason is None and not s.meta.get("needs_confirmation")


# ---- M2: GET pending takes no stock row locks ----------------------------------------
def test_pending_list_takes_no_stock_locks(monkeypatch):
    merchant_id, store_id, acc_id, h = _api_order_world()
    with SessionLocal() as db:
        from app.models.store import Store
        merchant, store = db.get(Merchant, merchant_id), db.get(Store, store_id)
        wh = db.query(CarrierWarehouse).filter_by(carrier_account_id=acc_id, external_id="ORN").one()
        p = ss._product(db, merchant, store, "PL-1", "carrier", stock=[])
        s = ShippingService(db).on_decision(ss._order(db, merchant, store, [("PL-1", 1)]), merchant, RiskDecision.ALLOW)
        assert s.hold_reason == "out_of_stock"
        db.add(StockLevel(product_id=p.id, warehouse_id=wh.id, on_hand=4, reserved=0, inbound=0))
        db.commit()
    monkeypatch.setattr(InventoryService, "_level",
                        lambda *a, **k: (_ for _ in ()).throw(AssertionError("row lock on a read path")))
    r = client.get(f"/api/v1/shipping/pending?reason=stock&store_id={store_id}", headers=h)
    assert r.status_code == 200, r.text
    item = r.json()["data"][0]
    assert [w["name"] for w in item["available_warehouses"]] == ["ORN"]


# ---- T8: carrier outcome correction enqueues the outcome webhook ---------------------
def test_returned_after_delivered_enqueues_outcome_webhook(db):
    merchant, store, acc = dw._world(db)
    db.add(WebhookEndpoint(merchant_id=merchant.id, store_id=store.id, environment="test",
                           url="https://example.invalid/h", signing_secret_encrypted=b"x", is_active=True,
                           events=["order.outcome.updated"]))
    s, order = dw._shipment(db, merchant, store)
    s.status, s.tracking_number, s.carrier_account_id = "accepted", f"T-{uuid4().hex[:6]}", acc.id
    db.flush()
    svc = TrackingService(db)
    svc.apply_events(s, [dw_event(s, "delivered")], "poll")
    svc.apply_events(s, [dw_event(s, "returned")], "poll")
    rows = db.query(WebhookDelivery).filter_by(event_type="order.outcome.updated").all()
    rows = [r for r in rows if r.payload["order_id"] == str(order.id)]
    assert [r.payload["outcome_status"] for r in rows] == ["delivered", "returned"]
