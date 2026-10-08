from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.db.database import SessionLocal
from app.models.enums import MerchantStatus, OrderStatus, RiskEventType
from app.models.merchant import Merchant
from app.models.order import Order
from app.services.risk_service import RiskService


def test_high_order_frequency():
    db = SessionLocal()

    try:
        merchant = Merchant(
            name="Frequency Test Merchant",
            email=f"frequency-{uuid4()}@ordium.local",
            status=MerchantStatus.ACTIVE,
        )

        db.add(merchant)
        db.flush()

        now = datetime.now(timezone.utc)

        # ---------------------------------------------------------
        # 5 previous orders inside the 10-minute window.
        # ---------------------------------------------------------
        for index in range(5):
            historical_order = Order(
                merchant_id=merchant.id,
                external_order_id=f"FREQ-{uuid4()}",
                status=OrderStatus.CONFIRMED,
                total_amount=5000,
                currency="DZD",
                first_name="Frequency",
                last_name="Test",
                source="test",
                created_at=(
                    now - timedelta(minutes=index)
                ),
            )

            db.add(historical_order)

        db.flush()

        # ---------------------------------------------------------
        # Current order
        # ---------------------------------------------------------
        current_order = Order(
            merchant_id=merchant.id,
            external_order_id=f"FREQ-CURRENT-{uuid4()}",
            status=OrderStatus.PENDING,
            total_amount=5000,
            currency="DZD",
            first_name="Frequency",
            last_name="Test",
            source="test",
            created_at=now,
        )

        db.add(current_order)
        db.flush()

        # ---------------------------------------------------------
        # Evaluate
        # ---------------------------------------------------------
        risk_service = RiskService(db)

        result = risk_service.assess_order(
            current_order,
        )

        assert any(
            event.event_type
            == RiskEventType.HIGH_ORDER_FREQUENCY
            for event in result.events
        )

        frequency_event = next(
            event
            for event in result.events
            if event.event_type
            == RiskEventType.HIGH_ORDER_FREQUENCY
        )

        assert frequency_event.score_impact == 20

        assert frequency_event.event_data is not None

        assert (
            frequency_event.event_data[
                "previous_orders_in_window"
            ]
            == 5
        )

        print()
        print("High Order Frequency Test")
        print("-------------------------")
        print(
            "Previous orders in window: 5"
        )
        print("Window: 10 minutes")
        print("Score impact: +20")
        print()
        print(
            "High order frequency test passed."
        )

    finally:
        db.rollback()
        db.close()


if __name__ == "__main__":
    test_high_order_frequency()