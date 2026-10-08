from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.db.database import SessionLocal
from app.models.customer import Customer
from app.models.enums import (
    MerchantStatus,
    OrderStatus,
    RiskEventType,
)
from app.models.merchant import Merchant
from app.models.order import Order
from app.services.risk_service import RiskService


def test_multiple_customers_same_ip():
    db = SessionLocal()

    try:
        merchant = Merchant(
            name="IP Customer Test Merchant",
            email=f"ip-customers-{uuid4()}@ordium.local",
            status=MerchantStatus.ACTIVE,
        )

        customer_a = Customer(
            first_name="Customer",
            last_name="A",
            normalized_name=f"customer a {uuid4().hex}",
        )

        customer_b = Customer(
            first_name="Customer",
            last_name="B",
            normalized_name=f"customer b {uuid4().hex}",
        )

        db.add_all(
            [
                merchant,
                customer_a,
                customer_b,
            ]
        )

        db.flush()

        shared_ip = "41.100.200.50"

        db.add_all(
            [
                Order(
                    merchant_id=merchant.id,
                    customer_id=customer_a.id,
                    external_order_id=f"IP-A-{uuid4()}",
                    status=OrderStatus.DELIVERED,
                    total_amount=5000,
                    currency="DZD",
                    first_name="Customer",
                    last_name="A",
                    ip_address=shared_ip,
                    source="test",
                ),
                Order(
                    merchant_id=merchant.id,
                    customer_id=customer_b.id,
                    external_order_id=f"IP-B-{uuid4()}",
                    status=OrderStatus.DELIVERED,
                    total_amount=5000,
                    currency="DZD",
                    first_name="Customer",
                    last_name="B",
                    ip_address=shared_ip,
                    source="test",
                ),
            ]
        )

        db.flush()

        current_order = Order(
            merchant_id=merchant.id,
            customer_id=customer_a.id,
            external_order_id=f"IP-CURRENT-{uuid4()}",
            status=OrderStatus.PENDING,
            total_amount=5000,
            currency="DZD",
            first_name="Customer",
            last_name="A",
            ip_address=shared_ip,
            source="test",
        )

        db.add(current_order)
        db.flush()

        result = RiskService(db).assess_order(
            current_order,
        )

        event = next(
            event
            for event in result.events
            if event.event_type
            == RiskEventType.MULTIPLE_CUSTOMERS_SAME_IP
        )

        assert event.score_impact == 20

        assert event.event_data is not None

        assert (
            event.event_data["distinct_customers"]
            == 2
        )

        print()
        print("Multiple Customers Same IP Test")
        print("--------------------------------")
        print("Distinct customers: 2")
        print("Score impact: +20")
        print()
        print(
            "Multiple customers same IP test passed."
        )

    finally:
        db.rollback()
        db.close()


def test_high_ip_frequency():
    db = SessionLocal()

    try:
        merchant = Merchant(
            name="IP Frequency Test Merchant",
            email=f"ip-frequency-{uuid4()}@ordium.local",
            status=MerchantStatus.ACTIVE,
        )

        db.add(merchant)
        db.flush()

        now = datetime.now(timezone.utc)

        shared_ip = "41.100.200.60"

        for index in range(5):
            order = Order(
                merchant_id=merchant.id,
                external_order_id=f"IP-FREQ-{uuid4()}",
                status=OrderStatus.CONFIRMED,
                total_amount=5000,
                currency="DZD",
                first_name="Frequency",
                last_name="Test",
                ip_address=shared_ip,
                source="test",
                created_at=(
                    now - timedelta(minutes=index)
                ),
            )

            db.add(order)

        db.flush()

        current_order = Order(
            merchant_id=merchant.id,
            external_order_id=f"IP-FREQ-CURRENT-{uuid4()}",
            status=OrderStatus.PENDING,
            total_amount=5000,
            currency="DZD",
            first_name="Frequency",
            last_name="Test",
            ip_address=shared_ip,
            source="test",
            created_at=now,
        )

        db.add(current_order)
        db.flush()

        result = RiskService(db).assess_order(
            current_order,
        )

        event = next(
            event
            for event in result.events
            if event.event_type
            == RiskEventType.HIGH_IP_FREQUENCY
        )

        assert event.score_impact == 20

        assert event.event_data is not None

        assert (
            event.event_data[
                "previous_orders_in_window"
            ]
            == 5
        )

        print()
        print("High IP Frequency Test")
        print("----------------------")
        print("Previous orders: 5")
        print("Window: 10 minutes")
        print("Score impact: +20")
        print()
        print(
            "High IP frequency test passed."
        )

    finally:
        db.rollback()
        db.close()


if __name__ == "__main__":
    test_multiple_customers_same_ip()
    test_high_ip_frequency()