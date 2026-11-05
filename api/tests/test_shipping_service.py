from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

import pytest

from app.core.outcomes import is_bad_outcome
from app.db.database import SessionLocal
from app.models.address_identifier import AddressIdentifier
from app.models.carrier_account import CarrierAccount
from app.models.carrier_warehouse import CarrierWarehouse
from app.models.enums import MerchantStatus, OrderStatus, RiskDecision
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.order_outcome import OrderOutcome
from app.models.product import Product, StockLevel
from app.models.shipment import Shipment
from app.models.shipping_settings import ShippingRoute
from app.models.store import Store
from app.services.confirmation_service import apply_confirmation
from app.services.inventory_service import InventoryService
from app.services.shipping_service import ShipmentActionRefused, ShippingService
from app.services.shipping_settings_service import ShippingSettingsService


def _aware(v):
    return v if v.tzinfo else v.replace(tzinfo=timezone.utc)


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session
        session.rollback()


def _world(db, confirmation=False, linked=True, link_offset=-timedelta(hours=1), with_store=True):
    merchant = Merchant(name="Ship", email=f"ship-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE,
                        is_shadow_mode_enabled=False, whatsapp_confirmation_enabled=confirmation,
                        whatsapp_confirmation_decisions="allow,review")
    db.add(merchant)
    db.flush()
    store = Store(merchant_id=merchant.id, name="S", slug=f"s-{uuid4().hex[:8]}")
    db.add(store)
    db.flush()
    account = None
    if linked:
        account = _account(db, merchant, store, created_at=datetime.now(timezone.utc) + link_offset)
    return merchant, store, account


def _account(db, merchant, store, created_at=None, warehouses=("ORN", "ALG")):
    acc = CarrierAccount(merchant_id=merchant.id, store_id=store.id, environment="test", carrier_code="sandbox",
                         display_name=f"sb-{uuid4().hex[:4]}", status="active")
    if created_at is not None:
        acc.created_at = created_at
    db.add(acc)
    db.flush()
    for ext in warehouses:
        db.add(CarrierWarehouse(carrier_account_id=acc.id, external_id=ext, name=ext))
    db.flush()
    return acc


def _order(db, merchant, store, items=(), wilaya="Alger"):
    address = AddressIdentifier(normalized_address=f"a-{uuid4()}", wilaya=wilaya, commune="c",
                                address_hash=uuid4().hex + uuid4().hex)
    db.add(address)
    db.flush()
    order = Order(merchant_id=merchant.id, store_id=store.id if store else None, external_order_id=f"o-{uuid4()}",
                  status=OrderStatus.PENDING, total_amount=Decimal("100"), currency="DZD", first_name="A",
                  last_name="B", environment="test", data_origin="real", address_identifier_id=address.id)
    db.add(order)
    db.flush()
    for sku, qty in items:
        db.add(OrderItem(order_id=order.id, sku=sku, product_name=sku, quantity=qty, unit_price=Decimal("10")))
    db.flush()
    db.refresh(order)
    return order


def _product(db, merchant, store, sku, fulfillment="carrier", stock=None):
    p = Product(merchant_id=merchant.id, store_id=store.id, sku=sku, name=sku, fulfillment=fulfillment)
    db.add(p)
    db.flush()
    for warehouse_id, on_hand in (stock or []):
        db.add(StockLevel(product_id=p.id, warehouse_id=warehouse_id, on_hand=on_hand, reserved=0, inbound=0))
    db.flush()
    return p


def test_review_and_reject_are_held(db):
    merchant, store, _ = _world(db)
    for decision, reason in ((RiskDecision.REVIEW, "review"), (RiskDecision.REJECT, "rejected")):
        s = ShippingService(db).on_decision(_order(db, merchant, store), merchant, decision)
        assert s.hold_reason == reason and s.next_attempt_at is None and s.status == "pending_dispatch"
        assert s.idempotency_key == str(s.id) and s.environment == "test" and s.merchant_id == merchant.id


def test_allow_without_confirmation_is_due_after_hold(db):
    merchant, store, _ = _world(db)
    order = _order(db, merchant, store)
    s = ShippingService(db).on_decision(order, merchant, RiskDecision.ALLOW)
    assert s.hold_reason is None
    delta = _aware(s.next_attempt_at) - datetime.now(timezone.utc)
    assert timedelta(minutes=14) < delta <= timedelta(minutes=15)


def test_allow_with_confirmation_waits(db):
    merchant, store, _ = _world(db, confirmation=True)
    s = ShippingService(db).on_decision(_order(db, merchant, store), merchant, RiskDecision.ALLOW)
    assert s.hold_reason == "awaiting_confirmation" and s.next_attempt_at is None


def test_confirmation_releases_and_cancel_cancels(db):
    merchant, store, _ = _world(db, confirmation=True)
    order = _order(db, merchant, store)
    s = ShippingService(db).on_decision(order, merchant, RiskDecision.ALLOW)
    apply_confirmation(db, order, channel="whatsapp", outcome="confirmed")
    assert s.hold_reason is None and s.next_attempt_at is not None
    apply_confirmation(db, order, channel="whatsapp", outcome="cancelled", update_status=False)
    assert s.status == "cancelled"


def test_unconfirmed_moves_to_no_answer_after_24h(db):
    merchant, store, _ = _world(db, confirmation=True)
    s = ShippingService(db).on_decision(_order(db, merchant, store), merchant, RiskDecision.ALLOW)
    svc = ShippingService(db)
    assert svc.expire_unconfirmed(datetime.now(timezone.utc) + timedelta(hours=23)) == 0
    assert svc.expire_unconfirmed(datetime.now(timezone.utc) + timedelta(hours=25)) == 1
    assert s.hold_reason == "no_answer" and s.next_attempt_at is None


def test_trigger_change_releases_awaiting_confirmation(db):
    merchant, store, _ = _world(db, confirmation=True)
    s = ShippingService(db).on_decision(_order(db, merchant, store), merchant, RiskDecision.ALLOW)
    ShippingSettingsService(db).update(store.id, {"dispatch_trigger": "on_allow"})
    assert ShippingService(db).expire_unconfirmed(datetime.now(timezone.utc)) == 1
    assert s.hold_reason is None and s.next_attempt_at is not None


def test_orders_before_first_link_get_no_shipment(db):
    merchant, store, _ = _world(db, link_offset=timedelta(hours=1))
    assert ShippingService(db).on_decision(_order(db, merchant, store), merchant, RiskDecision.ALLOW) is None
    merchant2, store2, _ = _world(db, linked=False)
    assert ShippingService(db).on_decision(_order(db, merchant2, store2), merchant2, RiskDecision.ALLOW) is None


def test_no_store_order_held(db):
    merchant, _, _ = _world(db)
    s = ShippingService(db).on_decision(_order(db, merchant, None), merchant, RiskDecision.ALLOW)
    assert s.hold_reason == "no_store" and s.next_attempt_at is None


def test_unmapped_and_mixed_source_holds(db):
    merchant, store, _ = _world(db)
    _product(db, merchant, store, "CAR", "carrier")
    _product(db, merchant, store, "MER", "merchant")
    s = ShippingService(db).on_decision(_order(db, merchant, store, [("NOPE", 1)]), merchant, RiskDecision.ALLOW)
    assert s.hold_reason == "unmapped_product" and s.next_attempt_at is None
    s = ShippingService(db).on_decision(_order(db, merchant, store, [("CAR", 1), ("MER", 1)]), merchant, RiskDecision.ALLOW)
    assert s.hold_reason == "mixed_source" and s.next_attempt_at is None


def test_successful_reservation_picks_warehouse_in_same_wilaya(db):
    merchant, store, acc = _world(db)
    algiers = db.query(CarrierWarehouse).filter_by(carrier_account_id=acc.id, external_id="ALG").one()
    orn = db.query(CarrierWarehouse).filter_by(carrier_account_id=acc.id, external_id="ORN").one()
    algiers.wilaya_code, orn.wilaya_code = "16", "31"
    _product(db, merchant, store, "CAR", stock=[(algiers.id, 5), (orn.id, 5)])
    s = ShippingService(db).on_decision(_order(db, merchant, store, [("CAR", 2)], wilaya="Oran"), merchant, RiskDecision.ALLOW)
    assert s.hold_reason is None and s.warehouse_id == orn.id and s.carrier_account_id == acc.id
    assert InventoryService(db).available(db.query(Product).filter_by(sku="CAR", store_id=store.id).one().id, orn.id) == 3


@pytest.mark.parametrize("policy", ["hold", "backorder", "other_warehouse", "other_warehouse_none"])
def test_out_of_stock_policies(db, policy):
    merchant, store, primary = _world(db)
    fallback = _account(db, merchant, store, created_at=datetime.now(timezone.utc) - timedelta(hours=1))
    db.add(ShippingRoute(merchant_id=merchant.id, store_id=store.id, wilaya_codes=[],
                         carrier_account_id=primary.id, fallback_carrier_account_id=fallback.id))
    fb_wh = db.query(CarrierWarehouse).filter_by(carrier_account_id=fallback.id).first()
    stock = [(fb_wh.id, 5)] if policy == "other_warehouse" else []
    _product(db, merchant, store, "CAR", stock=stock)
    ShippingSettingsService(db).update(store.id, {"out_of_stock_policy": policy.replace("_none", "")})
    s = ShippingService(db).on_decision(_order(db, merchant, store, [("CAR", 1)]), merchant, RiskDecision.ALLOW)
    if policy == "other_warehouse":
        assert s.hold_reason is None and s.carrier_account_id == fallback.id and s.meta.get("fell_back") is True
    else:
        assert s.hold_reason == "out_of_stock" and s.next_attempt_at is None
        assert bool(s.meta.get("backorder")) is (policy == "backorder")


def test_reject_records_risk_decision_outcome_not_bad(db):
    merchant, store, _ = _world(db)
    order = _order(db, merchant, store)
    svc = ShippingService(db)
    s = svc.on_decision(order, merchant, RiskDecision.REJECT)
    svc.reject(s, "key-1")
    outcome = db.query(OrderOutcome).filter_by(order_id=order.id).one()
    assert (outcome.outcome_status, outcome.reason, outcome.source) == ("cancelled", "risk_decision", "merchant")
    assert not is_bad_outcome(outcome.outcome_status, outcome.reason)
    assert s.status == "cancelled" and order.status == OrderStatus.CANCELLED


def test_dispatch_from_refused_for_review(db):
    merchant, store, acc = _world(db)
    wh = db.query(CarrierWarehouse).filter_by(carrier_account_id=acc.id).first()
    svc = ShippingService(db)
    for decision in (RiskDecision.REVIEW, RiskDecision.REJECT):
        s = svc.on_decision(_order(db, merchant, store), merchant, decision)
        with pytest.raises(ShipmentActionRefused):
            svc.dispatch_from(s, wh.id, "key")
        assert s.next_attempt_at is None
    svc.approve(s, "key")  # rejected -> approved is the only way out
    assert s.hold_reason is None and s.next_attempt_at is not None


def test_restore_only_rejected(db):
    merchant, store, _ = _world(db)
    svc = ShippingService(db)
    s = svc.on_decision(_order(db, merchant, store), merchant, RiskDecision.REVIEW)
    with pytest.raises(ShipmentActionRefused):
        svc.restore(s, "key")
    s2 = svc.on_decision(_order(db, merchant, store), merchant, RiskDecision.REJECT)
    svc.restore(s2, "key")
    assert s2.hold_reason == "review" and s2.next_attempt_at is None


def test_shipping_failure_never_breaks_order_hooks(db, monkeypatch):
    merchant, store, _ = _world(db, confirmation=True)
    order = _order(db, merchant, store)
    monkeypatch.setattr(ShippingService, "on_confirmed", lambda self, o: (_ for _ in ()).throw(RuntimeError("boom")))
    attempt = apply_confirmation(db, order, channel="whatsapp", outcome="confirmed")
    assert attempt is not None and order.status == OrderStatus.CONFIRMED
