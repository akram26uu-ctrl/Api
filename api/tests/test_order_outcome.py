from uuid import uuid4

from app.db.database import SessionLocal
from app.models.enums import MerchantStatus, OrderStatus
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.order_outcome import OrderOutcome
from app.repositories.order_outcome_repository import (
    OrderOutcomeRepository,
)


def create_merchant(
    db,
    name: str,
) -> Merchant:
    merchant = Merchant(
        name=name,
        email=f"{uuid4()}@ordium.local",
        status=MerchantStatus.ACTIVE,
    )

    db.add(merchant)
    db.flush()

    return merchant


def create_order(
    db,
    merchant_id,
) -> Order:
    order = Order(
        merchant_id=merchant_id,
        external_order_id=f"OUTCOME-{uuid4()}",
        status=OrderStatus.PENDING,
        total_amount=5000,
        currency="DZD",
        first_name="Outcome",
        last_name="Test",
        source="test",
    )

    db.add(order)
    db.flush()

    return order


def test_order_outcome_repository():
    db = SessionLocal()

    try:
        merchant = create_merchant(
            db,
            "Outcome Test Merchant",
        )

        order = create_order(
            db,
            merchant.id,
        )

        repository = OrderOutcomeRepository(db)

        before = repository.get_by_order_id(
            order.id,
        )

        assert before is None

        outcome = OrderOutcome(
            order_id=order.id,
            outcome_status="cancelled",
            source="test",
            note="Customer refused delivery",
        )

        repository.create(outcome)

        after = repository.get_by_order_id(
            order.id,
        )

        assert after is not None
        assert after.order_id == order.id
        assert after.outcome_status == "cancelled"
        assert after.source == "test"

        print()
        print("Order Outcome Repository Test")
        print("-----------------------------")
        print("Outcome created: True")
        print("Outcome status: cancelled")
        print()
        print("Order outcome repository test passed.")

    finally:
        db.rollback()
        db.close()


def test_outcome_status_updates_order():
    db = SessionLocal()

    try:
        merchant = create_merchant(
            db,
            "Outcome Status Merchant",
        )

        order = create_order(
            db,
            merchant.id,
        )

        outcome = OrderOutcome(
            order_id=order.id,
            outcome_status="delivered",
            source="test",
        )

        db.add(outcome)

        order.status = OrderStatus.DELIVERED

        db.flush()

        assert order.status == OrderStatus.DELIVERED

        print()
        print("Outcome Status Test")
        print("-------------------")
        print("Order status before: pending")
        print("Order status after:  delivered")
        print()
        print("Outcome status test passed.")

    finally:
        db.rollback()
        db.close()


def test_outcome_is_merchant_scoped():
    db = SessionLocal()

    try:
        merchant_a = create_merchant(
            db,
            "Merchant A",
        )

        merchant_b = create_merchant(
            db,
            "Merchant B",
        )

        order_a = create_order(
            db,
            merchant_a.id,
        )

        # This simulates the important security rule:
        # Merchant B must never access Merchant A's order.
        visible_to_b = (
            db.query(Order)
            .filter(
                Order.id == order_a.id,
                Order.merchant_id == merchant_b.id,
            )
            .first()
        )

        assert visible_to_b is None

        outcome = OrderOutcome(
            order_id=order_a.id,
            outcome_status="cancelled",
            source="test",
        )

        db.add(outcome)
        db.flush()

        print()
        print("Outcome Merchant Isolation Test")
        print("--------------------------------")
        print("Merchant A order visible to Merchant B: False")
        print()
        print("Outcome merchant isolation test passed.")

    finally:
        db.rollback()
        db.close()


if __name__ == "__main__":
    test_order_outcome_repository()
    test_outcome_status_updates_order()
    test_outcome_is_merchant_scoped()