from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.db.database import SessionLocal
from app.models.enums import MerchantStatus, OrderStatus, RiskEventType
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.customer import Customer
from app.models.phone_identifier import PhoneIdentifier
from app.models.device_identifier import DeviceIdentifier
from app.services.risk_service import RiskService


def test_multi_window_velocity_and_identity_graph_rules():
    db = SessionLocal()
    try:
        merchant = Merchant(name="P2", email=f"p2-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
        db.add(merchant)
        db.flush()

        customer = Customer(first_name="Test", last_name="P2", normalized_name="test p2")
        phone = PhoneIdentifier(phone="0555111122")
        device = DeviceIdentifier(fingerprint="p2-device")
        db.add_all([customer, phone, device])
        db.flush()

        now = datetime.now(timezone.utc)
        for i in range(3):
            db.add(Order(
                merchant_id=merchant.id, customer_id=customer.id, phone_identifier_id=phone.id,
                device_identifier_id=device.id, external_order_id=f"VEL-{i}", total_amount=5000,
                currency="DZD", first_name="Test", last_name="P2", ip_address="192.0.2.10",
                environment="live", data_origin="real", created_at=now - timedelta(minutes=2 + i),
            ))
        db.flush()

        current = Order(
            merchant_id=merchant.id, customer_id=customer.id, phone_identifier_id=phone.id,
            device_identifier_id=device.id, external_order_id="VEL-CURRENT", total_amount=5000,
            currency="DZD", first_name="Test", last_name="P2", ip_address="192.0.2.10",
            environment="live", data_origin="real", created_at=now,
        )
        db.add(current)
        db.flush()

        result = RiskService(db).assess_order(current)
        event_types = {event.event_type for event in result.events}
        assert RiskEventType.HIGH_CUSTOMER_VELOCITY in event_types
        assert RiskEventType.HIGH_PHONE_VELOCITY in event_types
        assert RiskEventType.HIGH_DEVICE_VELOCITY in event_types
    finally:
        db.rollback()
        db.close()


def test_proxy_does_not_double_count_vpn():
    from app.services.risk_rules import RiskRules
    from app.services.network_intelligence import NetworkIntelResult
    db = SessionLocal()
    try:
        merchant = Merchant(name="Network", email=f"net-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
        db.add(merchant)
        db.flush()
        order = Order(
            merchant_id=merchant.id, external_order_id="NET-1", total_amount=5000, currency="DZD",
            first_name="Test", last_name="Network", environment="live", data_origin="real",
            ip_address="198.51.100.10", created_at=datetime.now(timezone.utc),
        )
        db.add(order)
        db.flush()
        profile = RiskService(db)._get_or_create_profile(merchant.id)
        rules = RiskRules(__import__("app.repositories.order_repository", fromlist=["OrderRepository"]).OrderRepository(db), profile)
        result = rules.evaluate_proxy(order, NetworkIntelResult(ip_address=order.ip_address, vpn=True, proxy=True))
        assert result.score == 0
    finally:
        db.rollback()
        db.close()


def test_calibration_requires_enough_real_outcomes():
    from app.services.risk_evaluation_service import RiskEvaluationService

    result = RiskEvaluationService.recommend_thresholds(
        [
            {"score_bucket": "0-24", "evaluated_orders": 49, "bad_outcomes": 40},
            {"score_bucket": "25-49", "evaluated_orders": 50, "bad_outcomes": 20},
            {"score_bucket": "50-69", "evaluated_orders": 50, "bad_outcomes": 30},
            {"score_bucket": "70-79", "evaluated_orders": 50, "bad_outcomes": 38},
            {"score_bucket": "80-89", "evaluated_orders": 50, "bad_outcomes": 42},
        ]
    )
    assert result["calibration_ready"] is True
    assert result["recommended_review_threshold"] == 25
    assert result["recommended_reject_threshold"] == 70


def test_ipqs_provider_maps_reputation_fields(monkeypatch):
    import httpx
    from app.services.network_intelligence import IPQualityScoreProvider

    class DummyResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "vpn": True,
                "proxy": True,
                "tor": False,
                "bot_status": True,
                "recent_abuse": True,
                "active_vpn": True,
                "active_tor": False,
                "fraud_score": 92,
                "usage_type": "Data Center/Web Hosting/Transit",
            }

    monkeypatch.setattr(httpx, "get", lambda *args, **kwargs: DummyResponse())
    result = IPQualityScoreProvider("test-key").lookup("203.0.113.10")

    assert result.available is True
    assert result.provider == "ipqs"
    assert result.vpn is True
    assert result.bot_status is True
    assert result.fraud_score == 92
    assert result.usage_type.startswith("Data Center")


def test_identity_name_normalization_handles_diacritics_and_punctuation():
    from app.services.identity_service import IdentityService

    normalized = IdentityService._normalize_name("  Élodie!  ", " BEN-Ali ")
    assert normalized == "elodie ben ali"


def test_feature_snapshot_created_without_raw_ip():
    from app.models.risk_feature_snapshot import RiskFeatureSnapshot

    db = SessionLocal()
    try:
        merchant = Merchant(name="Snapshot", email=f"snap-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
        db.add(merchant)
        db.flush()
        order = Order(
            merchant_id=merchant.id,
            external_order_id="SNAP-1",
            total_amount=5000,
            currency="DZD",
            first_name="Snapshot",
            last_name="User",
            ip_address="203.0.113.10",
            environment="live",
            data_origin="real",
            created_at=datetime.now(timezone.utc),
        )
        db.add(order)
        db.flush()
        result = RiskService(db).assess_order(order)
        snapshot = db.scalar(__import__("sqlalchemy", fromlist=["select"]).select(RiskFeatureSnapshot).where(RiskFeatureSnapshot.risk_assessment_id == result.assessment.id))
        assert snapshot is not None
        assert snapshot.schema_version == "features-business-context-v3"
        assert snapshot.features["has_ip"] is True
        assert "203.0.113.10" not in str(snapshot.features)
    finally:
        db.rollback()
        db.close()


def test_global_phone_reputation_requires_evaluated_orders_and_multiple_merchants():
    from app.models.order_outcome import OrderOutcome

    db = SessionLocal()
    try:
        merchants = []
        for i in range(2):
            merchant = Merchant(name=f"Global-{i}", email=f"global-{i}-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
            db.add(merchant)
            db.flush()
            merchants.append(merchant)

        phone = PhoneIdentifier(phone=f"055{uuid4().int % 10**7:07d}")
        db.add(phone)
        db.flush()
        now = datetime.now(timezone.utc)
        for i in range(12):
            customer = Customer(first_name=f"Global{i}", last_name="User", normalized_name=f"global{i} user")
            db.add(customer)
            db.flush()
            order = Order(
                merchant_id=merchants[i % 2].id,
                customer_id=customer.id,
                phone_identifier_id=phone.id,
                external_order_id=f"GLOBAL-{i}",
                status=OrderStatus.CANCELLED if i < 10 else OrderStatus.DELIVERED,
                total_amount=5000,
                currency="DZD",
                first_name=f"Global{i}",
                last_name="User",
                environment="live",
                data_origin="real",
                created_at=now - timedelta(days=2, minutes=i),
            )
            db.add(order)
            db.flush()
            db.add(OrderOutcome(order_id=order.id, outcome_status="cancelled" if i < 10 else "delivered"))
        db.flush()

        current_customer = Customer(first_name="Current", last_name="User", normalized_name="current user")
        db.add(current_customer)
        db.flush()
        current = Order(
            merchant_id=merchants[0].id,
            customer_id=current_customer.id,
            phone_identifier_id=phone.id,
            external_order_id="GLOBAL-CURRENT",
            total_amount=5000,
            currency="DZD",
            first_name="Current",
            last_name="User",
            environment="live",
            data_origin="real",
            created_at=now,
        )
        db.add(current)
        db.flush()

        result = RiskService(db).assess_order(current)
        event_types = {event.event_type for event in result.events}
        assert RiskEventType.GLOBAL_PHONE_REPUTATION in event_types
    finally:
        db.rollback()
        db.close()


def test_global_phone_reputation_requires_bad_evidence_from_multiple_merchants():
    from app.models.order_outcome import OrderOutcome

    db = SessionLocal()
    try:
        merchant_a = Merchant(name="Poison-A", email=f"poison-a-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
        merchant_b = Merchant(name="Poison-B", email=f"poison-b-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
        db.add_all([merchant_a, merchant_b]); db.flush()
        phone = PhoneIdentifier(phone=f"055{uuid4().int % 10**7:07d}"); db.add(phone); db.flush()
        now = datetime.now(timezone.utc)
        for i in range(12):
            customer = Customer(first_name=f"Poison{i}", last_name="User", normalized_name=f"poison{i} user")
            db.add(customer); db.flush()
            order = Order(
                merchant_id=merchant_a.id,
                customer_id=customer.id,
                phone_identifier_id=phone.id,
                external_order_id=f"POISON-{i}",
                total_amount=5000, currency="DZD", first_name=f"Poison{i}", last_name="User",
                environment="live", data_origin="real", created_at=now - timedelta(days=2, minutes=i),
            )
            db.add(order); db.flush()
            db.add(OrderOutcome(order_id=order.id, outcome_status="cancelled" if i < 11 else "delivered"))
        db.flush()
        current = Order(
            merchant_id=merchant_b.id,
            phone_identifier_id=phone.id,
            external_order_id="POISON-CURRENT",
            total_amount=5000, currency="DZD", first_name="Current", last_name="User",
            environment="live", data_origin="real", created_at=now,
        )
        db.add(current); db.flush()
        result = RiskService(db).assess_order(current)
        event_types = {event.event_type for event in result.events}
        assert RiskEventType.GLOBAL_PHONE_REPUTATION not in event_types
    finally:
        db.rollback(); db.close()
