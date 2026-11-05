import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.enums import OrderStatus
from app.models.order_outcome import OrderOutcome
from app.models.product import Product
from app.models.shipment import Shipment, ShipmentEvent
from app.models.webhook_delivery import WebhookDelivery
from app.models.webhook_endpoint import WebhookEndpoint
from app.services import outcome_service
from app.services.inventory_service import InventoryService
from app.services.carrier_account_service import CarrierAccountService
from app.services.carriers import sandbox
from app.services.carriers.base import TrackingEvent
from app.services.dispatch_service import DispatchService
from app.services.tracking_service import TrackingService
from tests.test_dispatch_worker import _world, _shipment, _product, _wh

client = TestClient(app)


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session
        session.rollback()


def _ev(status, hours=0, key=None, tracking="T-1"):
    return TrackingEvent(status, status, None, datetime.now(timezone.utc) + timedelta(hours=hours),
                         key or f"{tracking}:{status}")


def _accepted(db, items=(), address="rue 1"):
    merchant, store, acc = _world(db)
    level = None
    if items:
        level = _product(db, merchant, store, items[0][0], _wh(db, acc).id, 10)
    s, order = _shipment(db, merchant, store, items=list(items), address=address)
    s.status, s.tracking_number, s.carrier_account_id = "accepted", f"T-{uuid4().hex[:6]}", acc.id
    db.flush()
    return s, order, level, acc


def _events(db, s):
    return db.query(ShipmentEvent).filter_by(shipment_id=s.id).all()


def test_duplicate_events_ignored(db):
    s, order, _l, _a = _accepted(db)
    svc = TrackingService(db)
    e = _ev("in_transit", key="k1")
    assert svc.apply_events(s, [e, e], "poll") == 1
    assert svc.apply_events(s, [e], "webhook") == 0
    assert len(_events(db, s)) == 1 and s.status == "in_transit"


def test_late_in_transit_after_delivered_is_logged_not_applied(db):
    s, order, _l, _a = _accepted(db)
    svc = TrackingService(db)
    svc.apply_events(s, [_ev("delivered", 5)], "webhook")
    assert s.status == "delivered"
    svc.apply_events(s, [_ev("in_transit", -5)], "webhook")
    assert s.status == "delivered"
    assert {e.status for e in _events(db, s)} == {"delivered", "in_transit"}


def test_delivered_records_outcome_and_consumes_stock(db):
    s, order, level, _a = _accepted(db, items=[("TR-1", 3)])
    p = db.query(Product).filter_by(sku="TR-1").one()
    assert s.meta["stock"] == "reserved"
    TrackingService(db).apply_events(s, [_ev("delivered")], "webhook")
    db.refresh(level); db.refresh(order)
    assert s.status == "delivered" and s.delivered_at is not None
    assert level.on_hand == 7 and level.reserved == 0 and s.meta["stock"] == "consumed"
    outcome = db.query(OrderOutcome).filter_by(order_id=order.id).one()
    assert outcome.outcome_status == "delivered" and outcome.source == "carrier"
    assert order.status == OrderStatus.DELIVERED


def test_returned_restocks_even_with_manual_outcome(db):
    s, order, level, _a = _accepted(db, items=[("TR-2", 3)])
    p = db.query(Product).filter_by(sku="TR-2").one()
    inv = InventoryService(db)
    inv.consume(s)
    outcome_service.record_outcome(db, order, "cancelled", source="manual")
    TrackingService(db).apply_events(s, [_ev("returned")], "webhook")
    db.refresh(level)
    assert level.on_hand == 10 and s.meta["stock"] == "restocked" and s.status == "returned"
    outcome = db.query(OrderOutcome).filter_by(order_id=order.id).one()
    assert outcome.outcome_status == "cancelled" and outcome.source == "manual"


def test_returned_with_reserved_stock_releases(db):
    s, order, level, _a = _accepted(db, items=[("TR-3", 2)])
    p = db.query(Product).filter_by(sku="TR-3").one()
    assert s.meta["stock"] == "reserved"
    TrackingService(db).apply_events(s, [_ev("returned")], "webhook")
    db.refresh(level)
    assert level.on_hand == 10 and level.reserved == 0 and s.meta["stock"] == "released"
    assert db.query(OrderOutcome).filter_by(order_id=order.id).one().outcome_status == "returned"


def test_picked_up_marks_order_shipped(db):
    s, order, _l, _a = _accepted(db)
    TrackingService(db).apply_events(s, [_ev("picked_up")], "webhook")
    assert order.status == OrderStatus.SHIPPED


def test_picked_up_does_not_override_other_order_status(db):
    s, order, _l, _a = _accepted(db)
    order.status = OrderStatus.CANCELLED
    db.flush()
    TrackingService(db).apply_events(s, [_ev("picked_up")], "webhook")
    assert order.status == OrderStatus.CANCELLED


def test_status_update_enqueues_webhook(db):
    s, order, _l, acc = _accepted(db)
    db.add(WebhookEndpoint(merchant_id=order.merchant_id, store_id=order.store_id, environment="test",
                           url="https://example.invalid/h", signing_secret_encrypted=b"x", is_active=True,
                           events=["order.shipment.updated"]))
    db.flush()
    TrackingService(db).apply_events(s, [_ev("in_transit")], "poll")
    row = db.query(WebhookDelivery).filter_by(event_type="order.shipment.updated").one()
    assert row.payload["status"] == "in_transit" and row.payload["carrier_code"] == "sandbox"
    assert row.payload["shipment_id"] == str(s.id)


# ---- webhook endpoint (committed data: the app uses its own session) -------
def _committed_world(token="test_tok"):
    with SessionLocal() as db:
        merchant, store, acc = _world(db)
        acc.credentials_encrypted = CarrierAccountService.encrypt_credentials({"api_token": token})
        s, order = _shipment(db, merchant, store)
        s.status, s.tracking_number, s.carrier_account_id = "accepted", f"W-{uuid4().hex[:6]}", acc.id
        db.commit()
        return acc.id, s.id, s.tracking_number


def _post(account_id, payload, token="test_tok", sign=True, code="sandbox"):
    body = json.dumps(payload).encode()
    headers = {"X-Sandbox-Signature": hmac.new(token.encode(), body, hashlib.sha256).hexdigest() if sign else "bad"}
    return client.post(f"/api/v1/carriers/{code}/webhook/{account_id}", content=body, headers=headers)


def _payload(tracking, status="in_transit"):
    return {"events": [{"tracking": tracking, "status": status,
                        "occurred_at": datetime.now(timezone.utc).isoformat()}]}


def test_carrier_webhook_bad_signature_401():
    acc_id, _sid, tracking = _committed_world()
    assert _post(acc_id, _payload(tracking), sign=False).status_code == 401


def test_carrier_webhook_unknown_account_or_code_404():
    acc_id, _sid, tracking = _committed_world()
    assert _post(uuid4(), _payload(tracking)).status_code == 404
    assert _post(acc_id, _payload(tracking), code="other").status_code == 404


def test_carrier_webhook_applies_and_ignores_foreign_tracking():
    acc_id, sid, tracking = _committed_world()
    payload = _payload(tracking)
    payload["events"] += _payload("NOT-MINE")["events"]
    r = _post(acc_id, payload)
    assert r.status_code == 200 and r.json() == {"accepted": 1}
    assert _post(acc_id, payload).json() == {"accepted": 0}
    with SessionLocal() as db:
        assert db.get(Shipment, sid).status == "in_transit"


def test_carrier_webhook_malformed_400():
    acc_id, _sid, _t = _committed_world()
    assert _post(acc_id, {"nope": 1}).status_code == 400


# ---- polling ---------------------------------------------------------------
def test_sync_shipments_advances_sandbox_by_clock(db, monkeypatch):
    merchant, store, acc = _world(db)
    s, order = _shipment(db, merchant, store)
    DispatchService(db, clock=lambda: datetime.now(timezone.utc) + timedelta(hours=1)).run_batch()
    db.refresh(s)
    assert s.status == "accepted"
    created = sandbox._STATE[s.tracking_number]["created_at"]
    monkeypatch.setattr(sandbox, "SANDBOX_CLOCK", lambda: created + timedelta(hours=30))
    counts = TrackingService(db).sync_active()
    assert counts["polled"] >= 1 and s.status == "in_transit" and order.status == OrderStatus.SHIPPED
    monkeypatch.setattr(sandbox, "SANDBOX_CLOCK", lambda: created + timedelta(hours=49))
    TrackingService(db).sync_active()
    assert s.status == "delivered" and order.status == OrderStatus.DELIVERED
    assert {e.source for e in _events(db, s)} >= {"poll"}
    TrackingService(db).sync_active()  # delivered shipments are no longer polled
    assert len(_events(db, s)) == 5


def test_sync_inventory_isolates_account_errors(db, monkeypatch):
    from scripts import sync_inventory
    from app.services.carriers.base import CarrierUnavailable
    merchant, store, bad = _world(db)
    from tests.test_dispatch_worker import _account
    good = _account(db, merchant, store)

    class Fake:
        def __init__(self, fail): self.fail = fail
        def list_stock(self):
            if self.fail:
                raise CarrierUnavailable("down")
            return []

    def adapter_for(self, account):
        return Fake(account.id == bad.id)

    monkeypatch.setattr(CarrierAccountService, "adapter_for", adapter_for)
    counts = sync_inventory.run(db)
    assert counts["errors"] >= 1 and counts["synced"] >= 1
    db.refresh(bad); db.refresh(good)
    assert "down" in bad.last_error and good.last_error is None and good.last_sync_at is not None


def test_returned_after_delivered_restocks_and_flips_carrier_outcome(db):
    s, order, level, _a = _accepted(db, items=[("TR-4", 3)])
    svc = TrackingService(db)
    svc.apply_events(s, [_ev("delivered", -2)], "poll")
    assert level.on_hand == 7 and order.status == OrderStatus.DELIVERED
    svc.apply_events(s, [_ev("returning", -1)], "poll")
    svc.apply_events(s, [_ev("returned")], "poll")
    db.refresh(level)
    assert s.status == "returned" and level.on_hand == 10 and s.meta["stock"] == "restocked"
    assert order.status == OrderStatus.RETURNED
    outcome = db.query(OrderOutcome).filter_by(order_id=order.id).one()
    assert (outcome.outcome_status, outcome.reason, outcome.source) == ("returned", "customer_refused", "carrier")


def test_returned_after_delivered_keeps_manual_outcome(db):
    s, order, level, _a = _accepted(db, items=[("TR-5", 3)])
    outcome_service.record_outcome(db, order, "delivered", source="manual")
    InventoryService(db).consume(s)
    s.status = "delivered"
    db.flush()
    TrackingService(db).apply_events(s, [_ev("returned")], "webhook")
    db.refresh(level)
    assert s.status == "returned" and level.on_hand == 10
    outcome = db.query(OrderOutcome).filter_by(order_id=order.id).one()
    assert (outcome.outcome_status, outcome.source) == ("delivered", "manual")
    assert order.status == OrderStatus.DELIVERED


def test_returned_not_applied_after_cancelled(db):
    s, order, _l, _a = _accepted(db)
    svc = TrackingService(db)
    svc.apply_events(s, [_ev("cancelled", -1)], "webhook")
    svc.apply_events(s, [_ev("returned")], "webhook")
    assert s.status == "cancelled"


def test_poll_error_does_not_touch_account_last_error(db, monkeypatch):
    s, _order, _l, acc = _accepted(db)

    def boom(self, account):
        raise RuntimeError("nope")

    monkeypatch.setattr(CarrierAccountService, "adapter_for", boom)
    assert TrackingService(db).sync_active()["errors"] >= 1
    db.refresh(acc)
    assert acc.last_error is None
