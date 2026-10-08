from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.db.database import SessionLocal
from app.models.address_identifier import AddressIdentifier
from app.models.customer import Customer
from app.models.device_identifier import DeviceIdentifier
from app.models.enums import (
    MerchantStatus,
    OrderStatus,
    RiskDecision,
    RiskEventType,
)
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.phone_identifier import PhoneIdentifier
from app.repositories.risk_event_repository import (
    RiskEventRepository,
)
from app.services.risk_service import RiskService


def test_risk_assessment_and_events():
    db = SessionLocal()

    try:
        # =========================================================
        # 1. Merchant
        # =========================================================
        merchant = Merchant(
            name="Risk Events Test Merchant",
            email=f"risk-events-{uuid4()}@ordium.local",
            status=MerchantStatus.ACTIVE,
        )

        db.add(merchant)
        db.flush()

        # =========================================================
        # 2. Shared identifiers
        # =========================================================
        customer = Customer(
            first_name="Risk",
            last_name="Events",
            normalized_name="risk events",
        )

        phone = PhoneIdentifier(
            phone=f"055{str(uuid4().int)[-7:]}",
        )

        device = DeviceIdentifier(
            fingerprint=f"events-device-{uuid4().hex}",
        )

        address = AddressIdentifier(
            normalized_address=(
                "events test address, "
                "test commune, "
                "test wilaya"
            ),
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

        # =========================================================
        # 3. Historical orders
        #
        # IMPORTANT:
        # Keep them outside the 10-minute frequency window.
        #
        # 8 cancelled
        # 2 delivered
        # =========================================================
        historical_time = (
            datetime.now(timezone.utc)
            - timedelta(hours=1)
        )

        for index in range(10):
            historical_order = Order(
                merchant_id=merchant.id,
                customer_id=customer.id,
                phone_identifier_id=phone.id,
                device_identifier_id=device.id,
                address_identifier_id=address.id,
                external_order_id=f"EVENT-HIST-{index}",
                status=(
                    OrderStatus.CANCELLED
                    if index < 8
                    else OrderStatus.DELIVERED
                ),
                total_amount=5000,
                currency="DZD",
                first_name="Risk",
                last_name="Events",
                ip_address="127.0.0.1",
                user_agent="risk-events-test",
                source="test",
                created_at=historical_time,
            )

            db.add(historical_order)

        db.flush()

        # =========================================================
        # 4. Current order
        # =========================================================
        current_order = Order(
            merchant_id=merchant.id,
            customer_id=customer.id,
            phone_identifier_id=phone.id,
            device_identifier_id=device.id,
            address_identifier_id=address.id,
            external_order_id=f"EVENT-CURRENT-{uuid4()}",
            status=OrderStatus.PENDING,
            total_amount=5000,
            currency="DZD",
            first_name="Risk",
            last_name="Events",
            ip_address="127.0.0.1",
            user_agent="risk-events-test",
            source="test",
            created_at=datetime.now(timezone.utc),
        )

        db.add(current_order)
        db.flush()

        # =========================================================
        # 5. Run Risk Engine
        # =========================================================
        risk_service = RiskService(db)

        result = risk_service.assess_order(
            current_order,
        )

        # =========================================================
        # 6. Verify score and decision
        #
        # High cancel rate  +35
        # Phone reuse       +15
        # Device reuse      +20
        # Address reuse     +15
        #
        # Total = 85
        #
        # High frequency = 0 because historical orders
        # are outside the 10-minute window.
        # =========================================================
        assert result.score == 100
        assert result.decision == RiskDecision.REJECT

        assert result.assessment.order_id == current_order.id
        assert (
            result.assessment.model_version
            == "rules-v4"
        )

        # =========================================================
        # 7. Load persisted events
        # =========================================================
        event_repository = RiskEventRepository(db)

        events = event_repository.get_for_assessment(
            result.assessment.id,
        )

        assert len(events) == 5

        # =========================================================
        # 8. Verify event types
        # =========================================================
        event_types = {
            event.event_type
            for event in events
        }

        assert (
            RiskEventType.HIGH_CANCEL_RATE
            in event_types
        )

        assert (
            RiskEventType.PHONE_REUSED
            in event_types
        )

        assert (
            RiskEventType.DEVICE_REUSED
            in event_types
        )

        assert (
            RiskEventType.ADDRESS_REUSED
            in event_types
        )

        assert (
            RiskEventType.HIGH_ORDER_FREQUENCY
            not in event_types
        )

        # =========================================================
        # 9. Verify score impacts
        # =========================================================
        score_impacts = sorted(
            event.score_impact
            for event in events
        )

        assert score_impacts == [
            15,
            15,
            15,
            20,
            35,
        ]

        # =========================================================
        # 10. Verify cancellation event
        # =========================================================
        cancel_event = next(
            event
            for event in events
            if event.event_type
            == RiskEventType.HIGH_CANCEL_RATE
        )

        assert cancel_event.event_data is not None

        assert (
            cancel_event.event_data["previous_orders"]
            == 10
        )

        assert (
            cancel_event.event_data["cancelled_orders"]
            == 8
        )

        assert (
            cancel_event.event_data["cancellation_rate"]
            == 0.8
        )

        # =========================================================
        # 11. Verify phone event
        # =========================================================
        phone_event = next(
            event
            for event in events
            if event.event_type
            == RiskEventType.PHONE_REUSED
        )

        assert phone_event.score_impact == 15

        assert phone_event.event_data is not None

        assert (
            phone_event.event_data["previous_orders"]
            == 10
        )

        # =========================================================
        # 12. Verify device event
        # =========================================================
        device_event = next(
            event
            for event in events
            if event.event_type
            == RiskEventType.DEVICE_REUSED
        )

        assert device_event.score_impact == 20

        assert device_event.event_data is not None

        assert (
            device_event.event_data["previous_orders"]
            == 10
        )

        # =========================================================
        # 13. Verify address event
        # =========================================================
        address_event = next(
            event
            for event in events
            if event.event_type
            == RiskEventType.ADDRESS_REUSED
        )

        assert address_event.score_impact == 15

        assert address_event.event_data is not None

        assert (
            address_event.event_data["previous_orders"]
            == 10
        )

        # =========================================================
        # 14. Output
        # =========================================================
        print()
        print("Risk Assessment & Events Test")
        print("-----------------------------")
        print(f"Score: {result.score}")
        print(f"Decision: {result.decision.value}")
        print(
            f"Model: "
            f"{result.assessment.model_version}"
        )
        print(f"Events: {len(events)}")
        print()

        for event in events:
            print(
                f"- {event.event_type.value}: "
                f"+{event.score_impact}"
            )

        print()
        print(
            "Risk assessment and events test passed."
        )

    finally:
        db.rollback()
        db.close()


if __name__ == "__main__":
    test_risk_assessment_and_events()