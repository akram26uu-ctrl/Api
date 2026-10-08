from uuid import uuid4

from app.db.database import SessionLocal
from app.models.enums import MerchantStatus, OrderStatus
from app.models.merchant import Merchant
from app.models.order import Order
from app.repositories.risk_profile_repository import (
    RiskProfileRepository,
)
from app.services.risk_service import RiskService


def test_risk_profile_auto_creation():
    db = SessionLocal()

    try:
        merchant = Merchant(
            name="Risk Profile Test Merchant",
            email=f"risk-profile-{uuid4()}@ordium.local",
            status=MerchantStatus.ACTIVE,
        )

        db.add(merchant)
        db.flush()

        profile_repository = RiskProfileRepository(db)

        # ---------------------------------------------------------
        # Before risk assessment, profile should not exist.
        # ---------------------------------------------------------
        profile_before = (
            profile_repository.get_by_merchant_id(
                merchant.id,
            )
        )

        assert profile_before is None

        # ---------------------------------------------------------
        # Create test order.
        # ---------------------------------------------------------
        order = Order(
            merchant_id=merchant.id,
            external_order_id=f"PROFILE-TEST-{uuid4()}",
            status=OrderStatus.PENDING,
            total_amount=5000,
            currency="DZD",
            first_name="Test",
            last_name="Customer",
            source="test",
        )

        db.add(order)
        db.flush()

        # ---------------------------------------------------------
        # Run RiskService.
        # ---------------------------------------------------------
        risk_service = RiskService(db)

        result = risk_service.assess_order(order)

        assert result.score == 0

        # ---------------------------------------------------------
        # Profile should now exist.
        # ---------------------------------------------------------
        profile_after = (
            profile_repository.get_by_merchant_id(
                merchant.id,
            )
        )

        assert profile_after is not None

        # ---------------------------------------------------------
        # Verify default values.
        # ---------------------------------------------------------
        assert (
            profile_after.high_cancel_rate_threshold
            == 0.70
        )

        assert (
            profile_after.high_cancel_rate_min_orders
            == 5
        )

        assert (
            profile_after.high_cancel_rate_score
            == 35
        )

        assert (
            profile_after.phone_reuse_threshold
            == 10
        )

        assert (
            profile_after.phone_reuse_score
            == 15
        )

        assert (
            profile_after.device_reuse_threshold
            == 10
        )

        assert (
            profile_after.device_reuse_score
            == 20
        )

        assert (
            profile_after.address_reuse_threshold
            == 10
        )

        assert (
            profile_after.address_reuse_score
            == 15
        )

        assert (
            profile_after.review_threshold
            == 50
        )

        assert (
            profile_after.reject_threshold
            == 80
        )

        assert (
            profile_after.max_score
            == 100
        )

        assert profile_after.is_active is True

        print()
        print("Risk Profile Auto Creation Test")
        print("--------------------------------")
        print("Profile before assessment: None")
        print("Profile after assessment:  Created")
        print()
        print("Default profile values verified.")
        print()
        print("Risk profile test passed.")

    finally:
        db.rollback()
        db.close()


if __name__ == "__main__":
    test_risk_profile_auto_creation()