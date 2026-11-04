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

        # Quiet normal traffic: about one order per day at this time of day
        # gives a baseline, so 5 orders in 10 minutes is a real spike.
        for day in range(1, 6):
            db.add(Order(
                merchant_id=merchant.id, external_order_id=f"FREQ-BASE-{uuid4()}",
                status=OrderStatus.DELIVERED, total_amount=5000, currency="DZD",
                first_name="Frequency", last_name="Base", source="test",
                created_at=now - timedelta(days=day, minutes=3),
            ))

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

def _freq_order(merchant, created_at, label="X"):
    return Order(
        merchant_id=merchant.id, external_order_id=f"FREQ-{label}-{uuid4()}",
        status=OrderStatus.CONFIRMED, total_amount=5000, currency="DZD",
        first_name="Frequency", last_name="Test", source="test", created_at=created_at,
    )


def _has_frequency_event(db, merchant, now):
    current = _freq_order(merchant, now, "CURRENT")
    db.add(current)
    db.flush()
    result = RiskService(db).assess_order(current)
    return any(e.event_type == RiskEventType.HIGH_ORDER_FREQUENCY for e in result.events)


def test_busy_merchant_normal_traffic_is_not_a_spike():
    """F4: a store that normally takes ~1 order/minute must not get +20 on every order."""
    db = SessionLocal()
    try:
        merchant = Merchant(name="Busy", email=f"busy-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
        db.add(merchant)
        db.flush()
        now = datetime.now(timezone.utc)
        for minute in range(0, 7 * 24 * 60, 2):  # one order every 2 minutes for a week
            db.add(_freq_order(merchant, now - timedelta(minutes=11 + minute), "BASE"))
        for index in range(6):  # 6 orders in the current 10-minute window (normal rate)
            db.add(_freq_order(merchant, now - timedelta(minutes=index)))
        db.flush()
        assert not _has_frequency_event(db, merchant, now)
    finally:
        db.rollback()
        db.close()


def test_merchant_without_history_is_not_flagged():
    db = SessionLocal()
    try:
        merchant = Merchant(name="New", email=f"new-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
        db.add(merchant)
        db.flush()
        now = datetime.now(timezone.utc)
        for index in range(6):
            db.add(_freq_order(merchant, now - timedelta(minutes=index)))
        db.flush()
        assert not _has_frequency_event(db, merchant, now)
    finally:
        db.rollback()
        db.close()
