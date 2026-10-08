from uuid import uuid4

from app.db.database import SessionLocal
from app.models.customer import Customer
from app.models.device_identifier import DeviceIdentifier
from app.models.enums import MerchantStatus, OrderStatus
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.phone_identifier import PhoneIdentifier
from app.services.risk_service import RiskService


def test_multiple_identity_relationships():
    db = SessionLocal()

    try:
        merchant = Merchant(
            name="Identity Risk Test Merchant",
            email=f"identity-risk-{uuid4()}@ordium.local",
            status=MerchantStatus.ACTIVE,
        )

        db.add(merchant)
        db.flush()

        customer_a = Customer(
            first_name="Customer",
            last_name="A",
            normalized_name="customer a",
        )

        customer_b = Customer(
            first_name="Customer",
            last_name="B",
            normalized_name="customer b",
        )

        phone = PhoneIdentifier(
            phone=f"055{str(uuid4().int)[-7:]}",
        )

        phone_b = PhoneIdentifier(
            phone=f"056{str(uuid4().int)[-7:]}",
        )

        device = DeviceIdentifier(
            fingerprint=f"identity-device-{uuid4().hex}",
        )

        db.add_all(
            [
                customer_a,
                customer_b,
                phone,
                phone_b,
                device,
            ]
        )

        db.flush()

        # ---------------------------------------------------------
        # Same phone -> two different customers
        # ---------------------------------------------------------
        order_a = Order(
            merchant_id=merchant.id,
            customer_id=customer_a.id,
            phone_identifier_id=phone.id,
            external_order_id=f"PHONE-A-{uuid4()}",
            status=OrderStatus.DELIVERED,
            total_amount=5000,
            currency="DZD",
            first_name="Customer",
            last_name="A",
            source="test",
        )

        order_b = Order(
            merchant_id=merchant.id,
            customer_id=customer_b.id,
            phone_identifier_id=phone.id,
            external_order_id=f"PHONE-B-{uuid4()}",
            status=OrderStatus.DELIVERED,
            total_amount=5000,
            currency="DZD",
            first_name="Customer",
            last_name="B",
            source="test",
        )

        # ---------------------------------------------------------
        # Same device -> two different phones
        # ---------------------------------------------------------
        order_c = Order(
            merchant_id=merchant.id,
            customer_id=customer_a.id,
            phone_identifier_id=phone.id,
            device_identifier_id=device.id,
            external_order_id=f"DEVICE-A-{uuid4()}",
            status=OrderStatus.DELIVERED,
            total_amount=5000,
            currency="DZD",
            first_name="Customer",
            last_name="A",
            source="test",
        )

        order_d = Order(
            merchant_id=merchant.id,
            customer_id=customer_b.id,
            phone_identifier_id=phone_b.id,
            device_identifier_id=device.id,
            external_order_id=f"DEVICE-B-{uuid4()}",
            status=OrderStatus.DELIVERED,
            total_amount=5000,
            currency="DZD",
            first_name="Customer",
            last_name="B",
            source="test",
        )

        db.add_all(
            [
                order_a,
                order_b,
                order_c,
                order_d,
            ]
        )

        db.flush()

        # ---------------------------------------------------------
        # Current order
        # ---------------------------------------------------------
        current_order = Order(
            merchant_id=merchant.id,
            customer_id=customer_a.id,
            phone_identifier_id=phone.id,
            device_identifier_id=device.id,
            external_order_id=f"CURRENT-{uuid4()}",
            status=OrderStatus.PENDING,
            total_amount=5000,
            currency="DZD",
            first_name="Customer",
            last_name="A",
            source="test",
        )

        db.add(current_order)
        db.flush()

        risk_service = RiskService(db)

        result = risk_service.assess_order(
            current_order,
        )

        event_types = {
            event.event_type
            for event in result.events
        }

        assert (
            "multiple_customers_same_phone"
            in {
                event.value
                for event in event_types
            }
        )

        assert (
            "multiple_phones_same_device"
            in {
                event.value
                for event in event_types
            }
        )

        print()
        print("Identity Risk Rules Test")
        print("------------------------")
        print(f"Score: {result.score}")
        print(f"Decision: {result.decision.value}")

        for event in result.events:
            print(
                f"- {event.event_type.value}: "
                f"+{event.score_impact}"
            )

        print()
        print("Identity risk rules test passed.")

    finally:
        db.rollback()
        db.close()


if __name__ == "__main__":
    test_multiple_identity_relationships()