from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.db.database import SessionLocal
from app.models.address_identifier import AddressIdentifier
from app.models.customer import Customer
from app.models.device_identifier import DeviceIdentifier
from app.models.enums import MerchantStatus, OrderStatus, RiskEventType
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.phone_identifier import PhoneIdentifier
from app.schemas.order import OrderCreate
from app.services.order_service import OrderService
from app.services.risk_service import RiskService


def test_duplicate_order_pattern():
    db = SessionLocal()
    try:
        merchant = Merchant(name="Duplicate", email=f"dup-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
        customer = Customer(first_name="Test", last_name="User", normalized_name="test user")
        phone = PhoneIdentifier(phone="0555123456")
        address = AddressIdentifier(normalized_address="1 test, algiers, algiers", wilaya="Algiers", commune="Algiers", address_hash=uuid4().hex * 2)
        db.add_all([merchant, customer, phone, address])
        db.flush()

        previous = Order(
            merchant_id=merchant.id, customer_id=customer.id, phone_identifier_id=phone.id,
            address_identifier_id=address.id, external_order_id="DUP-1", status=OrderStatus.PENDING,
            total_amount=5000, currency="DZD", first_name="Test", last_name="User",
            environment="live", data_origin="real", created_at=datetime.now(timezone.utc) - timedelta(minutes=5),
        )
        current = Order(
            merchant_id=merchant.id, customer_id=customer.id, phone_identifier_id=phone.id,
            address_identifier_id=address.id, external_order_id="DUP-2", status=OrderStatus.PENDING,
            total_amount=5000, currency="DZD", first_name="Test", last_name="User",
            environment="live", data_origin="real", created_at=datetime.now(timezone.utc),
        )
        db.add_all([previous, current])
        db.flush()

        result = RiskService(db).assess_order(current)
        assert any(e.event_type == RiskEventType.DUPLICATE_ORDER_PATTERN for e in result.events)
        assert result.score >= 10
    finally:
        db.rollback()
        db.close()


def test_burst_network_activity():
    db = SessionLocal()
    try:
        merchant = Merchant(name="Burst", email=f"burst-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
        db.add(merchant)
        db.flush()

        now = datetime.now(timezone.utc)
        for i in range(3):
            customer = Customer(first_name=f"User{i}", last_name="Burst", normalized_name=f"user{i} burst")
            phone = PhoneIdentifier(phone=f"05550000{i + 20:02d}")
            db.add_all([customer, phone])
            db.flush()
            db.add(
                Order(
                    merchant_id=merchant.id, customer_id=customer.id, phone_identifier_id=phone.id,
                    external_order_id=f"BURST-{i}", status=OrderStatus.PENDING, total_amount=5000,
                    currency="DZD", first_name=f"User{i}", last_name="Burst", ip_address="10.0.0.9",
                    environment="live", data_origin="real", created_at=now - timedelta(minutes=2, seconds=i),
                )
            )
        db.flush()

        current_customer = Customer(first_name="Current", last_name="Burst", normalized_name="current burst")
        current_phone = PhoneIdentifier(phone="0555000030")
        db.add_all([current_customer, current_phone])
        db.flush()
        current = Order(
            merchant_id=merchant.id, customer_id=current_customer.id, phone_identifier_id=current_phone.id,
            external_order_id="BURST-CURRENT", status=OrderStatus.PENDING, total_amount=5000, currency="DZD",
            first_name="Current", last_name="Burst", ip_address="10.0.0.9", environment="live", data_origin="real",
            created_at=now,
        )
        db.add(current)
        db.flush()

        result = RiskService(db).assess_order(current)
        assert any(e.event_type == RiskEventType.BURST_NETWORK_ACTIVITY for e in result.events)
        assert result.score >= 20
    finally:
        db.rollback()
        db.close()


def test_order_service_normalizes_test_environment_metadata():
    db = SessionLocal()
    try:
        merchant = Merchant(name="Sandbox", email=f"sandbox-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
        db.add(merchant)
        db.flush()
        from app.services.api_key_service import ApiKeyService
        key, _ = ApiKeyService(db).create_key(merchant, "Sandbox", environment="test")
        db.commit()

        result = OrderService(db).create_order(
            merchant.id,
            OrderCreate(
                external_order_id="SANDBOX-1", first_name="Test", last_name="User", phone="00213 555 000 031",
                wilaya="Algiers", commune="Algiers", address="1 Test St", total_amount=5000, currency="DZD"
            ),
            api_key=key, idempotency_key="sandbox-1",
        )
        assert result.order.environment == "test"
        assert result.order.data_origin == "test"
        assert result.order.api_key_id == key.id
    finally:
        db.rollback()
        db.close()


def test_risk_evaluation_metrics_are_calculated_from_confusion_matrix():
    from app.services.risk_evaluation_service import RiskEvaluationService

    metrics = RiskEvaluationService.metrics(
        {
            "true_positive": 8,
            "false_positive": 2,
            "true_negative": 18,
            "false_negative": 2,
        }
    )

    assert metrics["evaluated_orders"] == 30
    assert metrics["precision"] == 0.8
    assert metrics["recall"] == 0.8
    assert metrics["detection_rate"] == 0.8
    assert metrics["false_positive_rate"] == 0.1
    assert metrics["false_negative_rate"] == 0.2
