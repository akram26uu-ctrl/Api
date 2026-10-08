from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.db.database import SessionLocal
from app.models.address_identifier import AddressIdentifier
from app.models.customer import Customer
from app.models.device_identifier import DeviceIdentifier
from app.models.enums import MerchantStatus, OrderStatus, RiskDecision
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.phone_identifier import PhoneIdentifier
from app.services.risk_service import RiskService


def test_risk_engine_high_risk_order():
    db = SessionLocal()

    try:
        # ---------------------------------------------------------
        # 1. Create test merchant
        # ---------------------------------------------------------
        merchant = Merchant(
            name="Risk Test Merchant",
            email=f"risk-test-{uuid4()}@ordium.local",
            status=MerchantStatus.ACTIVE,
        )

        db.add(merchant)
        db.flush()

        # ---------------------------------------------------------
        # 2. Create shared customer identifiers
        # ---------------------------------------------------------
        customer = Customer(
            first_name="Risk",
            last_name="Test",
            normalized_name="risk test",
        )

        phone = PhoneIdentifier(
            phone="0555555555",
        )

        device = DeviceIdentifier(
            fingerprint=f"risk-device-{uuid4()}",
        )

        address = AddressIdentifier(
            normalized_address="test address, test commune, test wilaya",
            wilaya="Test Wilaya",
            commune="Test Commune",
            address_hash=uuid4().hex * 2,
        )

        db.add_all(
            [
                customer,
                phone,
                device,
                address,
            ]
        )

        db.flush()

        # ---------------------------------------------------------
        # 3. Create historical orders
        #
        # 10 previous orders:
        # - 8 cancelled
        # - 2 delivered
        # ---------------------------------------------------------
        historical_created_at = datetime.now(timezone.utc) - timedelta(hours=1)

        for i in range(10):
            historical_order = Order(
                merchant_id=merchant.id,
                customer_id=customer.id,
                phone_identifier_id=phone.id,
                device_identifier_id=device.id,
                address_identifier_id=address.id,
                external_order_id=f"RISK-HIST-{i}",
                status=(
                    OrderStatus.CANCELLED
                    if i < 8
                    else OrderStatus.DELIVERED
                ),
                total_amount=5000,
                currency="DZD",
                first_name="Risk",
                last_name="Test",
                ip_address="127.0.0.1",
                user_agent="risk-test",
                source="test",
                created_at=historical_created_at + timedelta(seconds=i),
            )

            db.add(historical_order)

        db.flush()

        # ---------------------------------------------------------
        # 4. Create the current order
        # ---------------------------------------------------------
        current_order = Order(
            merchant_id=merchant.id,
            customer_id=customer.id,
            phone_identifier_id=phone.id,
            device_identifier_id=device.id,
            address_identifier_id=address.id,
            external_order_id=f"RISK-CURRENT-{uuid4()}",
            status=OrderStatus.PENDING,
            total_amount=5000,
            currency="DZD",
            first_name="Risk",
            last_name="Test",
            ip_address="127.0.0.1",
            user_agent="risk-test",
            source="test",
        )

        db.add(current_order)
        db.flush()

        # ---------------------------------------------------------
        # 5. Run Risk Engine
        # ---------------------------------------------------------
        risk_service = RiskService(db)

        result = risk_service.assess_order(current_order)

        # ---------------------------------------------------------
        # 6. Display result
        # ---------------------------------------------------------
        print()
        print("Risk Engine Test")
        print("----------------")
        print(f"Score: {result.score}")
        print(f"Decision: {result.decision.value}")
        print(f"Assessment ID: {result.assessment.id}")
        print()

        # ---------------------------------------------------------
        # 7. Assertions
        # ---------------------------------------------------------
        assert result.score == 100
        assert result.decision == RiskDecision.REJECT

        print("Risk Engine test passed.")

    finally:
        # Keep database clean after the test.
        db.rollback()
        db.close()


if __name__ == "__main__":
    test_risk_engine_high_risk_order()