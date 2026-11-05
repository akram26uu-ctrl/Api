from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest

from app.db.database import SessionLocal
from app.models.address_identifier import AddressIdentifier
from app.models.carrier_account import CarrierAccount
from app.models.carrier_warehouse import CarrierWarehouse
from app.models.enums import MerchantStatus, OrderStatus, RiskDecision
from app.models.merchant import Merchant
from app.models.notification import Notification
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.phone_identifier import PhoneIdentifier
from app.models.product import Product, StockDeposit, StockLevel
from app.models.shipment import Shipment, ShipmentEvent
from app.models.shipping_settings import ShippingRoute
from app.models.store import Store
from app.models.webhook_delivery import WebhookDelivery
from app.models.webhook_endpoint import WebhookEndpoint
from app.services.carrier_account_service import CarrierAccountService
from app.services.carriers.base import CarrierShipmentResult, CarrierUnavailable
from app.services.dispatch_service import DispatchService
from app.services.inventory_service import InventoryService
from app.services.shipping_service import ShippingService
from app.services.shipping_settings_service import ShippingSettingsService


def _aware(v):
    return v if v.tzinfo else v.replace(tzinfo=timezone.utc)


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session
        session.rollback()


def _world(db):
    merchant = Merchant(name="D", email=f"d-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE,
                        is_shadow_mode_enabled=False)
    db.add(merchant)
    db.flush()
    store = Store(merchant_id=merchant.id, name="S", slug=f"s-{uuid4().hex[:8]}")
    db.add(store)
    db.flush()
    return merchant, store, _account(db, merchant, store)


def _account(db, merchant, store):
    acc = CarrierAccount(merchant_id=merchant.id, store_id=store.id, environment="test", carrier_code="sandbox",
                         display_name=f"sb-{uuid4().hex[:4]}", status="active",
                         created_at=datetime.now(timezone.utc) - timedelta(hours=1))
    db.add(acc)
    db.flush()
    for ext in ("ORN", "ALG"):
        db.add(CarrierWarehouse(carrier_account_id=acc.id, external_id=ext, name=ext, wilaya_code="16" if ext == "ALG" else "31"))
    db.flush()
    return acc


def _order(db, merchant, store, items=(), address="rue 1", phone=True):
    addr = AddressIdentifier(normalized_address=f"{address} {uuid4()}", wilaya="Alger", commune="c",
                             address_hash=uuid4().hex + uuid4().hex)
    db.add(addr)
    ph = None
    if phone:
        ph = PhoneIdentifier(phone=f"05{uuid4().int % 10**8:08d}")
        db.add(ph)
    db.flush()
    order = Order(merchant_id=merchant.id, store_id=store.id, external_order_id=f"o-{uuid4()}",
                  status=OrderStatus.PENDING, total_amount=Decimal("100"), currency="DZD", first_name="A",
                  last_name="B", environment="test", data_origin="real", address_identifier_id=addr.id,
                  phone_identifier_id=ph.id if ph else None)
    db.add(order)
    db.flush()
    for sku, qty in items:
        db.add(OrderItem(order_id=order.id, sku=sku, product_name=sku, quantity=qty, unit_price=Decimal("10")))
    db.flush()
    db.refresh(order)
    return order


def _shipment(db, merchant, store, **kw):
    order = _order(db, merchant, store, **kw)
    return ShippingService(db).on_decision(order, merchant, RiskDecision.ALLOW), order


def _svc(db):
    later = datetime.now(timezone.utc) + timedelta(hours=1)
    return DispatchService(db, clock=lambda: later), later


def test_held_shipments_never_dispatched(db):
    merchant, store, _ = _world(db)
    held = []
    for reason in ("review", "rejected", "awaiting_confirmation", "out_of_stock"):
        s, _o = _shipment(db, merchant, store)
        s.hold_reason = reason
        s.next_attempt_at = datetime.now(timezone.utc) - timedelta(hours=1)  # even if (wrongly) due
        held.append(s)
    db.flush()
    counts = _svc(db)[0].run_batch()
    assert counts == {"dispatched": 0, "retried": 0, "failed": 0, "fell_back": 0}
    for s in held:
        db.refresh(s)
        assert s.status == "pending_dispatch" and s.tracking_number is None and s.attempts == 0


def test_due_allow_dispatches_with_tracking(db):
    merchant, store, acc = _world(db)
    s, order = _shipment(db, merchant, store)
    svc, now = _svc(db)
    assert svc.run_batch()["dispatched"] >= 1
    db.refresh(s)
    assert s.status == "accepted" and s.tracking_number.startswith("SBX-") and s.label_url
    assert s.carrier_account_id == acc.id and s.next_attempt_at is None
    assert s.dispatched_at is not None
    ev = db.query(ShipmentEvent).filter_by(shipment_id=s.id).one()
    assert ev.status == "accepted" and ev.source == "poll" and ev.dedupe_key == f"{s.tracking_number}:accepted"


def test_not_yet_due_is_untouched(db):
    merchant, store, _ = _world(db)
    s, _o = _shipment(db, merchant, store)
    DispatchService(db).run_batch()
    db.refresh(s)
    assert s.status == "pending_dispatch" and s.tracking_number is None


def test_auto_dispatch_off_is_skipped_but_manual_works(db):
    merchant, store, _ = _world(db)
    ShippingSettingsService(db).update(store.id, {"auto_dispatch": False})
    s, _o = _shipment(db, merchant, store)
    svc, _now = _svc(db)
    svc.run_batch()
    db.refresh(s)
    assert s.status == "pending_dispatch"
    assert svc.dispatch_one(s, source="manual") == "dispatched"
    assert s.status == "accepted"
    assert db.query(ShipmentEvent).filter_by(shipment_id=s.id).one().source == "manual"


def test_dispatch_is_idempotent_on_retry_after_crash(db):
    merchant, store, _ = _world(db)
    s, _o = _shipment(db, merchant, store)
    svc, _now = _svc(db)
    svc.run_batch()
    db.refresh(s)
    tracking = s.tracking_number
    # crash: the carrier accepted, but the DB write was lost
    s.status, s.tracking_number, s.label_url, s.dispatched_at = "pending_dispatch", None, None, None
    s.next_attempt_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.flush()
    svc.run_batch()
    db.refresh(s)
    assert s.tracking_number == tracking and s.status == "accepted"
    assert db.query(ShipmentEvent).filter_by(shipment_id=s.id).count() == 1


def test_no_second_dispatch_for_accepted(db):
    merchant, store, _ = _world(db)
    s, _o = _shipment(db, merchant, store)
    svc, _now = _svc(db)
    svc.run_batch()
    assert svc.dispatch_one(s) == "skipped"


class _FakeAdapter:
    def __init__(self, fail):
        self.fail = fail
        self.calls = 0

    def create_shipment(self, req):
        self.calls += 1
        if self.fail:
            raise CarrierUnavailable("down")
        return CarrierShipmentResult("FAKE-1", None, {})


def test_unavailable_backs_off_then_falls_back(db, monkeypatch):
    merchant, store, primary = _world(db)
    fallback = _account(db, merchant, store)
    db.add(ShippingRoute(merchant_id=merchant.id, store_id=store.id, wilaya_codes=[],
                         carrier_account_id=primary.id, fallback_carrier_account_id=fallback.id, priority=1))
    ShippingSettingsService(db).update(store.id, {"retry_max": 3, "retry_interval_minutes": 10})
    adapters = {primary.id: _FakeAdapter(True), fallback.id: _FakeAdapter(False)}
    monkeypatch.setattr(CarrierAccountService, "adapter_for", lambda self, acc: adapters[acc.id])
    s, _o = _shipment(db, merchant, store)
    assert s.carrier_account_id is None or s.carrier_account_id == primary.id
    now = datetime.now(timezone.utc) + timedelta(hours=1)
    clock = {"t": now}
    svc = DispatchService(db, clock=lambda: clock["t"])

    assert svc.run_batch()["retried"] == 1
    db.refresh(s)
    assert s.attempts == 1 and s.last_error and s.status == "pending_dispatch"
    assert abs((_aware(s.next_attempt_at) - clock["t"]).total_seconds() - 600) < 2
    assert svc.run_batch() == {"dispatched": 0, "retried": 0, "failed": 0, "fell_back": 0}  # not due yet

    clock["t"] += timedelta(minutes=11)
    assert svc.run_batch()["retried"] == 1
    db.refresh(s)
    assert s.attempts == 2 and abs((_aware(s.next_attempt_at) - clock["t"]).total_seconds() - 1200) < 2

    clock["t"] += timedelta(minutes=21)
    assert svc.run_batch()["fell_back"] == 1
    db.refresh(s)
    assert s.carrier_account_id == fallback.id and s.attempts == 0 and s.meta["fell_back"] is True
    assert s.status == "pending_dispatch"

    assert svc.run_batch()["dispatched"] == 1
    db.refresh(s)
    assert s.status == "accepted" and s.tracking_number == "FAKE-1"


def test_exhausted_without_fallback_fails_and_releases_stock(db, monkeypatch):
    merchant, store, acc = _world(db)
    ShippingSettingsService(db).update(store.id, {"retry_max": 1})
    monkeypatch.setattr(CarrierAccountService, "adapter_for", lambda self, a: _FakeAdapter(True))
    wh = db.query(CarrierWarehouse).filter_by(carrier_account_id=acc.id, external_id="ALG").one()
    _product(db, merchant, store, "SKU-1", wh.id, 5)
    s, _o = _shipment(db, merchant, store, items=[("SKU-1", 2)])
    assert s.meta.get("stock") == "reserved"
    svc, _now = _svc(db)
    assert svc.run_batch()["failed"] == 1
    db.refresh(s)
    assert s.status == "dispatch_failed" and s.next_attempt_at is None and s.meta.get("stock") == "released"
    assert db.query(Notification).filter_by(resource_id=str(s.id), notification_type="shipment.dispatch_failed").count() == 1


def test_validation_error_fails_with_message_and_releases_stock(db):
    merchant, store, acc = _world(db)
    wh = db.query(CarrierWarehouse).filter_by(carrier_account_id=acc.id, external_id="ALG").one()
    level = _product(db, merchant, store, "SKU-1", wh.id, 5)
    s, _o = _shipment(db, merchant, store, items=[("SKU-1", 2)], address="FAIL street")
    assert level.reserved == 2
    svc, _now = _svc(db)
    assert svc.run_batch()["failed"] == 1
    db.refresh(s)
    db.refresh(level)
    assert s.status == "dispatch_failed" and "rejected" in s.last_error and len(s.last_error) <= 500
    assert level.reserved == 0 and s.meta.get("stock") == "released"
    n = db.query(Notification).filter_by(resource_id=str(s.id), notification_type="shipment.dispatch_failed").one()
    assert n.merchant_id == merchant.id


def test_missing_phone_fails_clearly(db):
    merchant, store, _ = _world(db)
    s, _o = _shipment(db, merchant, store, phone=False)
    svc, _now = _svc(db)
    assert svc.run_batch()["failed"] == 1
    db.refresh(s)
    assert s.status == "dispatch_failed" and "phone" in s.last_error.lower()


def test_no_carrier_route_fails(db):
    merchant, store, acc = _world(db)
    s, _o = _shipment(db, merchant, store)
    acc.status = "disabled"
    s.carrier_account_id = None
    db.flush()
    svc, _now = _svc(db)
    assert svc.run_batch()["failed"] == 1
    db.refresh(s)
    assert s.status == "dispatch_failed" and s.last_error == "no_carrier_route"
    assert db.query(Notification).filter_by(resource_id=str(s.id), notification_type="shipment.dispatch_failed").count() == 1


def test_merchant_fulfilled_dispatches_without_warehouse(db, monkeypatch):
    merchant, store, acc = _world(db)
    seen = []

    class Spy(_FakeAdapter):
        def create_shipment(self, req):
            seen.append(req)
            return super().create_shipment(req)

    monkeypatch.setattr(CarrierAccountService, "adapter_for", lambda self, a: Spy(False))
    _product(db, merchant, store, "M-1", None, 5, fulfillment="merchant")
    s, _o = _shipment(db, merchant, store, items=[("M-1", 1)])
    assert s.fulfillment == "merchant"
    svc, _now = _svc(db)
    assert svc.run_batch()["dispatched"] == 1
    assert seen[0].warehouse_external_id is None and seen[0].cod_amount == Decimal("100")
    assert seen[0].recipient.wilaya == "Alger" and seen[0].lines[0].sku == "M-1"


def _product(db, merchant, store, sku, warehouse_id, on_hand, fulfillment="carrier"):
    p = Product(merchant_id=merchant.id, store_id=store.id, sku=sku, name=sku, fulfillment=fulfillment)
    db.add(p)
    db.flush()
    level = StockLevel(product_id=p.id, warehouse_id=warehouse_id, on_hand=on_hand, reserved=0, inbound=0)
    db.add(level)
    db.flush()
    return level


def test_backorder_released_when_deposit_received(db):
    merchant, store, acc = _world(db)
    ShippingSettingsService(db).update(store.id, {"out_of_stock_policy": "backorder"})
    wh = db.query(CarrierWarehouse).filter_by(carrier_account_id=acc.id, external_id="ALG").one()
    _product(db, merchant, store, "BO-1", wh.id, 0)
    s, _o = _shipment(db, merchant, store, items=[("BO-1", 2)])
    assert s.hold_reason == "out_of_stock" and s.meta.get("backorder")
    dep = StockDeposit(merchant_id=merchant.id, carrier_account_id=acc.id, warehouse_id=wh.id, reference="D1",
                       status="counting", lines=[{"sku": "BO-1", "quantity": 5}])
    db.add(dep)
    db.flush()
    InventoryService(db).receive_deposit(dep)
    db.refresh(s)
    assert s.hold_reason is None and s.meta.get("stock") == "reserved" and s.next_attempt_at is not None


def test_backorder_awaiting_confirmation_stays_held(db):
    merchant, store, acc = _world(db)
    ShippingSettingsService(db).update(store.id, {"out_of_stock_policy": "backorder"})
    wh = db.query(CarrierWarehouse).filter_by(carrier_account_id=acc.id, external_id="ALG").one()
    _product(db, merchant, store, "BO-2", wh.id, 0)
    s, _o = _shipment(db, merchant, store, items=[("BO-2", 1)])
    s.meta = {**s.meta, "needs_confirmation": True}
    db.flush()
    dep = StockDeposit(merchant_id=merchant.id, carrier_account_id=acc.id, warehouse_id=wh.id, reference="D2",
                       status="counting", lines=[{"sku": "BO-2", "quantity": 5}])
    db.add(dep)
    db.flush()
    InventoryService(db).receive_deposit(dep)
    db.refresh(s)
    assert s.hold_reason == "awaiting_confirmation"


def test_webhook_event_enqueued_on_accept(db):
    merchant, store, acc = _world(db)
    ep = WebhookEndpoint(merchant_id=merchant.id, store_id=store.id, environment="test", url="https://example.com/h",
                         signing_secret_encrypted=b"x", events=["order.shipment.updated"], is_active=True)
    db.add(ep)
    db.flush()
    s, order = _shipment(db, merchant, store)
    svc, _now = _svc(db)
    svc.run_batch()
    db.refresh(s)
    d = db.query(WebhookDelivery).filter_by(endpoint_id=ep.id, event_type="order.shipment.updated").one()
    assert d.payload == {"order_id": str(order.id), "external_order_id": order.external_order_id,
                         "shipment_id": str(s.id), "status": "accepted", "tracking_number": s.tracking_number,
                         "carrier_code": "sandbox"}
