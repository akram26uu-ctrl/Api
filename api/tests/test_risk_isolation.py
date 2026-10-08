from uuid import uuid4

from app.db.database import SessionLocal
from app.models.address_identifier import AddressIdentifier
from app.models.customer import Customer
from app.models.device_identifier import DeviceIdentifier
from app.models.enums import MerchantStatus, OrderStatus
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.phone_identifier import PhoneIdentifier
from app.services.risk_service import RiskService


def test_risk_history_is_merchant_scoped():
    db = SessionLocal()

    try:
        # ---------------------------------------------------------
        # 1. Create two merchants
        # ---------------------------------------------------------
        merchant_a = Merchant(
            name="Merchant A",
            email=f"merchant-a-{uuid4()}@ordium.local",
            status=MerchantStatus.ACTIVE,
        )

        merchant_b = Merchant(
            name="Merchant B",
            email=f"merchant-b-{uuid4()}@ordium.local",
            status=MerchantStatus.ACTIVE,
        )

        db.add_all(
            [
                merchant_a,
                merchant_b,
            ]
        )

        db.flush()

        # ---------------------------------------------------------
        # 2. Create one customer
        # ---------------------------------------------------------
        customer = Customer(
            first_name="Test",
            last_name="Customer",
            normalized_name="test customer",
        )

        db.add(customer)
        db.flush()

        # IMPORTANT:
        # Always use customer.id after the Customer was flushed.
        customer_id = customer.id

        # ---------------------------------------------------------
        # 3. Merchant A historical orders
        #
        # All 10 orders belong to Merchant A.
        # They should NOT affect Merchant B.
        # ---------------------------------------------------------
        for i in range(10):
            historical_order = Order(
                merchant_id=merchant_a.id,
                customer_id=customer_id,
                external_order_id=f"A-HIST-{i}",
                status=OrderStatus.CANCELLED,
                total_amount=5000,
                currency="DZD",
                first_name="Test",
                last_name="Customer",
                source="test",
            )

            db.add(historical_order)

        db.flush()

        # ---------------------------------------------------------
        # 4. New order for Merchant B
        # ---------------------------------------------------------
        current_order = Order(
            merchant_id=merchant_b.id,
            customer_id=customer_id,
            external_order_id=f"B-CURRENT-{uuid4()}",
            status=OrderStatus.PENDING,
            total_amount=5000,
            currency="DZD",
            first_name="Test",
            last_name="Customer",
            source="test",
        )

        db.add(current_order)
        db.flush()

        # ---------------------------------------------------------
        # 5. Run Risk Engine for Merchant B
        # ---------------------------------------------------------
        risk_service = RiskService(db)

        result = risk_service.assess_order(current_order)

        # ---------------------------------------------------------
        # 6. Merchant B must NOT inherit Merchant A history
        # ---------------------------------------------------------
        assert result.score == 0

        print()
        print("Risk Isolation Test")
        print("-------------------")
        print(f"Merchant A: {merchant_a.id}")
        print(f"Merchant B: {merchant_b.id}")
        print(f"Customer:   {customer.id}")
        print(f"Score:      {result.score}")
        print(f"Decision:   {result.decision.value}")
        print()
        print("Risk isolation test passed.")

    finally:
        db.rollback()
        db.close()


if __name__ == "__main__":
    test_risk_history_is_merchant_scoped()