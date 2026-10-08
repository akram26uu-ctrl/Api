from uuid import uuid4

from app.db.database import SessionLocal
from app.models.enums import MerchantStatus, RiskDecision
from app.models.merchant import Merchant
from app.models.order import Order
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


def create_order(
    db,
    merchant_id,
    *,
    customer_id=None,
    phone_identifier_id=None,
    device_identifier_id=None,
    address_identifier_id=None,
    external_order_id=None,
):
    order = Order(
        merchant_id=merchant_id,
        customer_id=customer_id,
        phone_identifier_id=phone_identifier_id,
        device_identifier_id=device_identifier_id,
        address_identifier_id=address_identifier_id,
        external_order_id=external_order_id or str(uuid4()),
        status="pending",
        total_amount=5000,
        currency="DZD",
        first_name="Risk",
        last_name="Test",
        source="test",
    )

    db.add(order)
    db.flush()

    return order


def test_risk_decision_thresholds():
    db = SessionLocal()

    try:
        risk_service = RiskService(db)

        # =========================================================
        # LOW RISK
        # =========================================================
        low_merchant = create_merchant(
            db,
            "Low Risk Merchant",
        )

        low_order = create_order(
            db,
            low_merchant.id,
        )

        low_result = risk_service.assess_order(
            low_order,
        )

        assert low_result.score == 0
        assert low_result.decision == RiskDecision.ALLOW

        # =========================================================
        # MEDIUM RISK
        #
        # We use a controlled score by testing the decision
        # boundary directly.
        # =========================================================
        assert (
            risk_service._get_decision(49)
            == RiskDecision.ALLOW
        )

        assert (
            risk_service._get_decision(50)
            == RiskDecision.REVIEW
        )

        assert (
            risk_service._get_decision(79)
            == RiskDecision.REVIEW
        )

        # =========================================================
        # HIGH RISK
        # =========================================================
        assert (
            risk_service._get_decision(80)
            == RiskDecision.REJECT
        )

        assert (
            risk_service._get_decision(100)
            == RiskDecision.REJECT
        )

        print()
        print("Risk Scoring Threshold Test")
        print("---------------------------")
        print("0  -> ALLOW")
        print("49 -> ALLOW")
        print("50 -> REVIEW")
        print("79 -> REVIEW")
        print("80 -> REJECT")
        print("100 -> REJECT")
        print()
        print("Risk scoring threshold test passed.")

    finally:
        db.rollback()
        db.close()


if __name__ == "__main__":
    test_risk_decision_thresholds()