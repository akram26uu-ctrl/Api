"""Regression tests for risk-engine logic fixes (F3, F6, F7)."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.db.database import SessionLocal
from app.models.customer import Customer
from app.models.enums import MerchantStatus, OrderStatus, RiskEventType
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.phone_identifier import PhoneIdentifier
from app.services.network_intelligence import NetworkIntelResult
from app.services.risk_service import RiskService


class _StaticProvider:
    def __init__(self, result):
        self.result = result

    def lookup(self, ip_address):
        return self.result


def _merchant(db):
    m = Merchant(name="Logic", email=f"logic-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
    db.add(m)
    db.flush()
    return m


def _customer(db, label):
    c = Customer(first_name=label, last_name="User", normalized_name=f"{label} {uuid4().hex}")
    db.add(c)
    db.flush()
    return c


def _order(merchant, customer=None, **kw):
    base = dict(
        merchant_id=merchant.id, customer_id=customer.id if customer else None,
        external_order_id=f"L-{uuid4()}", status=OrderStatus.PENDING, total_amount=5000,
        currency="DZD", first_name="L", last_name="U",
        created_at=datetime.now(timezone.utc) - timedelta(days=3),
    )
    base.update(kw)
    return Order(**base)


def _events(result):
    return {e.event_type for e in result.events}


def test_returns_count_toward_bad_outcome_rate():
    """F3: COD refusals (RETURNED) are the main fake-order signal."""
    db = SessionLocal()
    try:
        m = _merchant(db)
        c = _customer(db, "returner")
        for _ in range(5):
            db.add(_order(m, c, status=OrderStatus.RETURNED))
        current = _order(m, c, created_at=datetime.now(timezone.utc))
        db.add(current)
        db.flush()
        assert RiskEventType.HIGH_CANCEL_RATE in _events(RiskService(db).assess_order(current))
    finally:
        db.rollback()
        db.close()


def test_multiple_customers_same_phone_is_independent_of_customer_history():
    """F6: the same situation (phone shared with one other customer) must give
    the same answer whether or not the current customer ordered before."""
    db = SessionLocal()
    try:
        m = _merchant(db)
        phone = PhoneIdentifier(phone=f"077{uuid4().int % 10**7:07d}")
        db.add(phone)
        db.flush()
        db.add(_order(m, _customer(db, "other"), phone_identifier_id=phone.id))
        db.flush()

        new_customer = _customer(db, "newcomer")
        first = _order(m, new_customer, phone_identifier_id=phone.id, created_at=datetime.now(timezone.utc))
        db.add(first)
        db.flush()
        first_events = _events(RiskService(db).assess_order(first))

        second = _order(m, new_customer, phone_identifier_id=phone.id, created_at=datetime.now(timezone.utc))
        db.add(second)
        db.flush()
        second_events = _events(RiskService(db).assess_order(second))

        flag = RiskEventType.MULTIPLE_CUSTOMERS_SAME_PHONE
        assert (flag in first_events) == (flag in second_events) is True
    finally:
        db.rollback()
        db.close()


def test_single_customer_alone_on_phone_is_not_flagged():
    db = SessionLocal()
    try:
        m = _merchant(db)
        phone = PhoneIdentifier(phone=f"078{uuid4().int % 10**7:07d}")
        db.add(phone)
        db.flush()
        c = _customer(db, "solo")
        db.add(_order(m, c, phone_identifier_id=phone.id))
        current = _order(m, c, phone_identifier_id=phone.id, created_at=datetime.now(timezone.utc))
        db.add(current)
        db.flush()
        assert RiskEventType.MULTIPLE_CUSTOMERS_SAME_PHONE not in _events(RiskService(db).assess_order(current))
    finally:
        db.rollback()
        db.close()


def test_network_signals_are_capped_as_one_group():
    """F7: one IP fact (vpn+tor+reputation+bot) must not push an order to REJECT alone."""
    db = SessionLocal()
    try:
        m = _merchant(db)
        c = _customer(db, "net")
        current = _order(m, c, ip_address="41.1.2.3", created_at=datetime.now(timezone.utc))
        db.add(current)
        db.flush()
        provider = _StaticProvider(NetworkIntelResult(
            ip_address="41.1.2.3", vpn=True, tor=True, bot_status=True, fraud_score=99, provider="test",
        ))
        result = RiskService(db, network_provider=provider).assess_order(current)
        assert {RiskEventType.VPN_DETECTED, RiskEventType.TOR_DETECTED, RiskEventType.BOT_ACTIVITY} <= _events(result)
        assert result.score == RiskService.SCORE_GROUP_CAPS["network"]
    finally:
        db.rollback()
        db.close()


def test_stale_shared_ip_is_ignored():
    """Unrelated shoppers share carrier (CGNAT) IPs over time; only recent sharing counts."""
    db = SessionLocal()
    try:
        m = _merchant(db)
        old = datetime.now(timezone.utc) - timedelta(days=30)
        for label in ("old-a", "old-b"):
            db.add(_order(m, _customer(db, label), ip_address="41.9.9.9", created_at=old))
        current = _order(m, _customer(db, "now"), ip_address="41.9.9.9", created_at=datetime.now(timezone.utc))
        db.add(current)
        db.flush()
        provider = _StaticProvider(NetworkIntelResult(ip_address="41.9.9.9", provider="test"))
        result = RiskService(db, network_provider=provider).assess_order(current)
        assert RiskEventType.MULTIPLE_CUSTOMERS_SAME_IP not in _events(result)
    finally:
        db.rollback()
        db.close()
