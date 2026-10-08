from uuid import uuid4

from app.db.database import SessionLocal
from app.models.customer import Customer
from app.models.device_identifier import DeviceIdentifier
from app.models.enums import MerchantStatus, OrderStatus
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.phone_identifier import PhoneIdentifier
from app.models.enums import RiskEventType
from app.services.risk_service import RiskService


def test_new_device():
    db = SessionLocal()

    try:
        merchant = Merchant(
            name="New Device Test Merchant",
            email=f"new-device-{uuid4()}@ordium.local",
            status=MerchantStatus.ACTIVE,
        )

        customer = Customer(
            first_name="Test",
            last_name="Customer",
            normalized_name=f"test customer {uuid4().hex[:8]}",
        )

        phone = PhoneIdentifier(
            phone=f"055{str(uuid4().int)[-7:]}",
        )

        old_device = DeviceIdentifier(
            fingerprint=f"old-device-{uuid4().hex}",
        )

        new_device = DeviceIdentifier(
            fingerprint=f"new-device-{uuid4().hex}",
        )

        db.add_all(
            [
                merchant,
                customer,
                phone,
                old_device,
                new_device,
            ]
        )

        db.flush()

        # ---------------------------------------------------------
        # Customer has previous history using old device.
        # ---------------------------------------------------------
        for index in range(2):
            order = Order(
                merchant_id=merchant.id,
                customer_id=customer.id,
                phone_identifier_id=phone.id,
                device_identifier_id=old_device.id,
                external_order_id=f"OLD-DEVICE-{index}",
                status=OrderStatus.DELIVERED,
                total_amount=5000,
                currency="DZD",
                first_name="Test",
                last_name="Customer",
                source="test",
            )

            db.add(order)

        db.flush()

        # ---------------------------------------------------------
        # Current order uses a new device.
        # ---------------------------------------------------------
        current_order = Order(
            merchant_id=merchant.id,
            customer_id=customer.id,
            phone_identifier_id=phone.id,
            device_identifier_id=new_device.id,
            external_order_id=f"NEW-DEVICE-{uuid4()}",
            status=OrderStatus.PENDING,
            total_amount=5000,
            currency="DZD",
            first_name="Test",
            last_name="Customer",
            source="test",
        )

        db.add(current_order)
        db.flush()

        risk_service = RiskService(db)

        result = risk_service.assess_order(
            current_order,
        )

        assert any(
            event.event_type == RiskEventType.NEW_DEVICE
            for event in result.events
        )

        new_device_event = next(
            event
            for event in result.events
            if event.event_type == RiskEventType.NEW_DEVICE
        )

        assert new_device_event.score_impact == 10

        assert new_device_event.event_data is not None

        assert (
            new_device_event.event_data["customer_previous_orders"]
            == 2
        )

        assert (
            new_device_event.event_data["customer_device_orders"]
            == 0
        )

        print()
        print("New Device Test")
        print("----------------")
        print("Customer previous orders: 2")
        print("Previous orders on device: 0")
        print("Signal: NEW_DEVICE")
        print("Score impact: +10")
        print()
        print("New device test passed.")

    finally:
        db.rollback()
        db.close()


if __name__ == "__main__":
    test_new_device()