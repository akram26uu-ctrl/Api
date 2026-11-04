"""rules-v6: trusted buyer history, finalized cancel-rate, signal groups, mobile IPs."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.db.database import SessionLocal
from app.models.customer import Customer
from app.models.device_identifier import DeviceIdentifier
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
    m = Merchant(name="Trust", email=f"trust6-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
    db.add(m)
    db.flush()
    return m


def _customer(db, label="buyer"):
    c = Customer(first_name=label, last_name="User", normalized_name=f"{label} {uuid4().hex}")
    db.add(c)
    db.flush()
    return c


def _phone(db):
    p = PhoneIdentifier(phone=f"066{uuid4().int % 10**7:07d}")
    db.add(p)
    db.flush()
    return p


def _device(db):
    d = DeviceIdentifier(fingerprint=f"fp-{uuid4().hex}")
    db.add(d)
    db.flush()
    return d


def _order(merchant, customer=None, **kw):
    base = dict(
        merchant_id=merchant.id, customer_id=customer.id if customer else None,
        external_order_id=f"T-{uuid4()}", status=OrderStatus.PENDING, total_amount=5000,
        currency="DZD", first_name="T", last_name="U",
        created_at=datetime.now(timezone.utc) - timedelta(days=3),
    )
    base.update(kw)
    return Order(**base)


def _types(result):
    return {e.event_type for e in result.events}


def _loyal_history(db, m, c, phone, device, delivered=10, returned=0):
    for _ in range(delivered):
        db.add(_order(m, c, phone_identifier_id=phone.id, device_identifier_id=device.id, status=OrderStatus.DELIVERED))
    for _ in range(returned):
        db.add(_order(m, c, phone_identifier_id=phone.id, device_identifier_id=device.id, status=OrderStatus.RETURNED))
    db.flush()


def test_proven_buyer_is_not_penalised_for_coming_back():
    db = SessionLocal()
    try:
        m, c, phone, device = _merchant(db), _customer(db), _phone(db), _device(db)
        _loyal_history(db, m, c, phone, device)
        current = _order(m, c, phone_identifier_id=phone.id, device_identifier_id=device.id, created_at=datetime.now(timezone.utc))
        db.add(current)
        db.flush()

        result = RiskService(db).assess_order(current)

        types = _types(result)
        assert RiskEventType.TRUSTED_CUSTOMER_HISTORY in types
        assert RiskEventType.PHONE_REUSED not in types
        assert RiskEventType.DEVICE_REUSED not in types
        assert result.score == 0
        trusted = next(e for e in result.events if e.event_type is RiskEventType.TRUSTED_CUSTOMER_HISTORY)
        assert trusted.score_impact < 0
        assert set(trusted.event_data["suppressed_signals"]) == {"phone_reused", "device_reused"}
    finally:
        db.rollback()
        db.close()


def test_history_with_many_returns_is_not_trusted():
    db = SessionLocal()
    try:
        m, c, phone, device = _merchant(db), _customer(db), _phone(db), _device(db)
        _loyal_history(db, m, c, phone, device, delivered=6, returned=4)
        current = _order(m, c, phone_identifier_id=phone.id, device_identifier_id=device.id, created_at=datetime.now(timezone.utc))
        db.add(current)
        db.flush()

        types = _types(RiskService(db).assess_order(current))

        assert RiskEventType.TRUSTED_CUSTOMER_HISTORY not in types
        assert RiskEventType.PHONE_REUSED in types
    finally:
        db.rollback()
        db.close()


def test_trust_does_not_hide_network_signals():
    db = SessionLocal()
    try:
        m, c, phone, device = _merchant(db), _customer(db), _phone(db), _device(db)
        _loyal_history(db, m, c, phone, device, delivered=3)
        current = _order(m, c, phone_identifier_id=phone.id, device_identifier_id=device.id,
                         ip_address="203.0.113.9", created_at=datetime.now(timezone.utc))
        db.add(current)
        db.flush()
        vpn = NetworkIntelResult(ip_address="203.0.113.9", vpn=True, provider="test")

        result = RiskService(db, network_provider=_StaticProvider(vpn)).assess_order(current)

        assert {RiskEventType.TRUSTED_CUSTOMER_HISTORY, RiskEventType.VPN_DETECTED} <= _types(result)
        assert result.score > 0
    finally:
        db.rollback()
        db.close()


def test_pending_orders_do_not_dilute_cancel_rate():
    """5 refused + 10 still pending: the known outcomes are 100% bad."""
    db = SessionLocal()
    try:
        m, c = _merchant(db), _customer(db)
        for _ in range(5):
            db.add(_order(m, c, status=OrderStatus.RETURNED))
        for _ in range(10):
            db.add(_order(m, c, status=OrderStatus.PENDING))
        current = _order(m, c, created_at=datetime.now(timezone.utc))
        db.add(current)
        db.flush()

        result = RiskService(db).assess_order(current)

        event = next(e for e in result.events if e.event_type is RiskEventType.HIGH_CANCEL_RATE)
        assert event.event_data["finalized_orders"] == 5
        assert event.event_data["cancellation_rate"] == 1.0
    finally:
        db.rollback()
        db.close()


def test_one_burst_is_not_counted_three_times():
    db = SessionLocal()
    try:
        m, c, phone, device = _merchant(db), _customer(db), _phone(db), _device(db)
        now = datetime.now(timezone.utc)
        for minutes in (2, 4, 6):
            db.add(_order(m, c, phone_identifier_id=phone.id, device_identifier_id=device.id,
                          total_amount=1000 + minutes, created_at=now - timedelta(minutes=minutes)))
        current = _order(m, c, phone_identifier_id=phone.id, device_identifier_id=device.id, created_at=now)
        db.add(current)
        db.flush()

        result = RiskService(db).assess_order(current)

        velocity = {RiskEventType.HIGH_CUSTOMER_VELOCITY, RiskEventType.HIGH_PHONE_VELOCITY, RiskEventType.HIGH_DEVICE_VELOCITY}
        assert velocity <= _types(result)
        raw = sum(e.score_impact for e in result.events if e.event_type in velocity)
        assert raw > RiskService.SCORE_GROUP_CAPS["velocity"]
        snapshot = result.assessment.feature_snapshot.features
        assert snapshot["score_caps_applied"]["velocity"]["cap"] == RiskService.SCORE_GROUP_CAPS["velocity"]
    finally:
        db.rollback()
        db.close()


def _shared_ip_case(db, mobile):
    m = _merchant(db)
    ip = "198.51.100.77"
    db.add(_order(m, _customer(db, "other"), ip_address=ip, created_at=datetime.now(timezone.utc) - timedelta(days=2)))
    current = _order(m, _customer(db, "me"), ip_address=ip, created_at=datetime.now(timezone.utc))
    db.add(current)
    db.flush()
    net = NetworkIntelResult(ip_address=ip, mobile=mobile, provider="test")
    return _types(RiskService(db, network_provider=_StaticProvider(net)).assess_order(current))


def test_shared_mobile_ip_is_not_a_signal():
    db = SessionLocal()
    try:
        assert RiskEventType.MULTIPLE_CUSTOMERS_SAME_IP not in _shared_ip_case(db, mobile=True)
        assert RiskEventType.MULTIPLE_CUSTOMERS_SAME_IP in _shared_ip_case(db, mobile=False)
    finally:
        db.rollback()
        db.close()


def _cluster_case(db, mobile, days_ago=1):
    m = _merchant(db)
    ip = "198.51.100.88"
    for i in range(7):
        db.add(_order(m, _customer(db, f"n{i}"), ip_address=ip,
                      created_at=datetime.now(timezone.utc) - timedelta(days=days_ago, minutes=i)))
    current = _order(m, _customer(db, "me"), ip_address=ip, created_at=datetime.now(timezone.utc))
    db.add(current)
    db.flush()
    net = NetworkIntelResult(ip_address=ip, mobile=mobile, provider="test")
    return RiskService(db, network_provider=_StaticProvider(net)).assess_order(current)


def test_mobile_ip_neighbours_do_not_form_an_identity_cluster():
    db = SessionLocal()
    try:
        assert RiskEventType.IDENTITY_CLUSTER_RISK not in _types(_cluster_case(db, mobile=True))
        assert RiskEventType.IDENTITY_CLUSTER_RISK in _types(_cluster_case(db, mobile=False))
    finally:
        db.rollback()
        db.close()


def test_old_ip_neighbours_do_not_form_an_identity_cluster():
    db = SessionLocal()
    try:
        assert RiskEventType.IDENTITY_CLUSTER_RISK not in _types(_cluster_case(db, mobile=False, days_ago=30))
    finally:
        db.rollback()
        db.close()


def test_own_past_orders_do_not_count_as_cluster_members():
    db = SessionLocal()
    try:
        m, c, phone = _merchant(db), _customer(db), _phone(db)
        db.add(_order(m, c, phone_identifier_id=phone.id))
        current = _order(m, c, phone_identifier_id=phone.id, created_at=datetime.now(timezone.utc))
        db.add(current)
        db.flush()
        result = RiskService(db).assess_order(current)
        graph = result.assessment.feature_snapshot.features["identity_graph"]
        assert graph["identity_cluster_size"] == 0
        assert graph["counts"]["phone_customers"] == 0
    finally:
        db.rollback()
        db.close()


def test_known_good_phone_typed_by_someone_else_is_not_trusted():
    db = SessionLocal()
    try:
        m, owner, phone, device = _merchant(db), _customer(db, "owner"), _phone(db), _device(db)
        _loyal_history(db, m, owner, phone, device, delivered=5)
        stranger = _customer(db, "stranger")
        current = _order(m, stranger, phone_identifier_id=phone.id, device_identifier_id=_device(db).id,
                         created_at=datetime.now(timezone.utc))
        db.add(current)
        db.flush()

        types = _types(RiskService(db).assess_order(current))

        assert RiskEventType.TRUSTED_CUSTOMER_HISTORY not in types
    finally:
        db.rollback()
        db.close()
