from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.db.database import SessionLocal
from app.models.address_identifier import AddressIdentifier
from app.models.customer import Customer
from app.models.device_identifier import DeviceIdentifier
from app.models.enums import (
    MerchantStatus,
    OrderStatus,
    RiskDecision,
)
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.phone_identifier import PhoneIdentifier
from app.services.risk_service import RiskService


def create_merchant(db, name: str) -> Merchant:
    merchant = Merchant(
        name=name,
        email=f"{uuid4()}@ordium.local",
        status=MerchantStatus.ACTIVE,
    )

    db.add(merchant)
    db.flush()

    return merchant


def create_customer(db) -> Customer:
    customer = Customer(
        first_name="Test",
        last_name="Customer",
        normalized_name=f"test customer {uuid4().hex[:8]}",
    )

    db.add(customer)
    db.flush()

    return customer


def create_phone(db) -> PhoneIdentifier:
    phone = PhoneIdentifier(
        phone=f"055{str(uuid4().int)[-7:]}",
    )

    db.add(phone)
    db.flush()

    return phone


def create_device(db) -> DeviceIdentifier:
    device = DeviceIdentifier(
        fingerprint=f"device-{uuid4().hex}",
    )

    db.add(device)
    db.flush()

    return device


def create_address(db) -> AddressIdentifier:
    normalized_address = (
        f"{uuid4().hex[:8]} rue test, "
        "Bab El Oued, Alger"
    )

    address = AddressIdentifier(
        normalized_address=normalized_address,
        wilaya="Alger",
        commune="Bab El Oued",
        address_hash=uuid4().hex * 2,
    )

    db.add(address)
    db.flush()

    return address


def create_order(
    db,
    merchant_id,
    *,
    customer_id=None,
    phone_identifier_id=None,
    device_identifier_id=None,
    address_identifier_id=None,
    status=OrderStatus.PENDING,
    external_order_id=None,
    created_at=None,
):
    order = Order(
        merchant_id=merchant_id,
        customer_id=customer_id,
        phone_identifier_id=phone_identifier_id,
        device_identifier_id=device_identifier_id,
        address_identifier_id=address_identifier_id,
        external_order_id=external_order_id or str(uuid4()),
        status=status,
        total_amount=7500,
        currency="DZD",
        first_name="Test",
        last_name="Customer",
        source="test",
    )

    if created_at is not None:
        order.created_at = created_at

    db.add(order)
    db.flush()

    return order


def test_medium_risk_combination():
    db = SessionLocal()

    try:
        merchant = create_merchant(
            db,
            "Medium Risk Merchant",
        )

        customer = create_customer(db)
        phone = create_phone(db)
        device = create_device(db)
        address = create_address(db)

        # Keep historical orders outside the
        # 10-minute high-frequency window.
        historical_time = (
            datetime.now(timezone.utc)
            - timedelta(hours=1)
        )

        for index in range(10):
            create_order(
                db,
                merchant.id,
                customer_id=customer.id,
                phone_identifier_id=phone.id,
                device_identifier_id=device.id,
                address_identifier_id=None,
                status=OrderStatus.DELIVERED,
                external_order_id=f"MEDIUM-HIST-{index}",
                created_at=historical_time,
            )

        current_order = create_order(
            db,
            merchant.id,
            customer_id=customer.id,
            phone_identifier_id=phone.id,
            device_identifier_id=device.id,
            address_identifier_id=address.id,
            external_order_id=f"MEDIUM-CURRENT-{uuid4()}",
            created_at=datetime.now(timezone.utc),
        )

        risk_service = RiskService(db)

        result = risk_service.assess_order(
            current_order,
        )

        assert result.score == 35
        assert result.decision == RiskDecision.ALLOW

        event_types = {
            event.event_type.value
            for event in result.events
        }

        assert "phone_reused" in event_types
        assert "device_reused" in event_types

        assert "high_order_frequency" not in event_types

        print()
        print("Medium Risk Combination")
        print("-----------------------")
        print("Phone reuse:       +15")
        print("Device reuse:      +20")
        print("High frequency:     +0")
        print(f"Total:              {result.score}")
        print(f"Decision:           {result.decision.value}")
        print()
        print("Medium risk combination test passed.")

    finally:
        db.rollback()
        db.close()


def test_high_risk_combination():
    db = SessionLocal()

    try:
        merchant = create_merchant(
            db,
            "High Risk Merchant",
        )

        customer = create_customer(db)
        phone = create_phone(db)
        device = create_device(db)
        address = create_address(db)

        # ---------------------------------------------------------
        # Historical orders
        #
        # 8 cancelled
        # 2 delivered
        #
        # All historical orders are outside the frequency window.
        # ---------------------------------------------------------
        historical_time = (
            datetime.now(timezone.utc)
            - timedelta(hours=1)
        )

        for index in range(10):
            create_order(
                db,
                merchant.id,
                customer_id=customer.id,
                phone_identifier_id=phone.id,
                device_identifier_id=device.id,
                address_identifier_id=address.id,
                status=(
                    OrderStatus.CANCELLED
                    if index < 8
                    else OrderStatus.DELIVERED
                ),
                external_order_id=f"HIGH-HIST-{index}",
                created_at=historical_time,
            )

        # ---------------------------------------------------------
        # Current order
        #
        # High cancel rate  +35
        # Phone reused      +15
        # Device reused     +20
        # Address reused    +15
        #
        # Expected = 85
        # ---------------------------------------------------------
        current_order = create_order(
            db,
            merchant.id,
            customer_id=customer.id,
            phone_identifier_id=phone.id,
            device_identifier_id=device.id,
            address_identifier_id=address.id,
            external_order_id=f"HIGH-CURRENT-{uuid4()}",
            created_at=datetime.now(timezone.utc),
        )

        risk_service = RiskService(db)

        result = risk_service.assess_order(
            current_order,
        )

        assert result.score == 100
        assert result.decision == RiskDecision.REJECT
        assert any(event.event_type.value == "strong_identity_combination" for event in result.events)

        event_scores = sorted(
            event.score_impact
            for event in result.events
        )

        assert event_scores == [15, 15, 15, 20, 35]

        event_types = {
            event.event_type.value
            for event in result.events
        }

        assert "high_cancel_rate" in event_types
        assert "phone_reused" in event_types
        assert "device_reused" in event_types
        assert "address_reused" in event_types

        assert "high_order_frequency" not in event_types

        print()
        print("High Risk Combination")
        print("---------------------")
        print("High cancel rate: +35")
        print("Phone reuse:      +15")
        print("Device reuse:     +20")
        print("Address reuse:    +15")
        print("High frequency:    +0")
        print(f"Total:            {result.score}")
        print(f"Decision:         {result.decision.value}")
        print()
        print("High risk combination test passed.")

    finally:
        db.rollback()
        db.close()


if __name__ == "__main__":
    test_medium_risk_combination()
    test_high_risk_combination()