from uuid import uuid4

from app.db.database import SessionLocal
from app.models.enums import MerchantStatus, OrderStatus, RiskEventType
from app.models.merchant import Merchant
from app.models.order import Order
from app.services.network_intelligence import (
    MockNetworkIntelligenceProvider,
)
from app.services.risk_service import RiskService


def test_vpn_detection():
    db = SessionLocal()

    try:
        merchant = Merchant(
            name="VPN Test Merchant",
            email=f"vpn-{uuid4()}@ordium.local",
            status=MerchantStatus.ACTIVE,
        )

        db.add(merchant)
        db.flush()

        order = Order(
            merchant_id=merchant.id,
            external_order_id=f"VPN-{uuid4()}",
            status=OrderStatus.PENDING,
            total_amount=5000,
            currency="DZD",
            first_name="VPN",
            last_name="Test",
            ip_address="10.10.10.10",
            source="test",
        )

        db.add(order)
        db.flush()

        provider = MockNetworkIntelligenceProvider()

        result = RiskService(
            db,
            network_provider=provider,
        ).assess_order(order)

        event = next(
            event
            for event in result.events
            if event.event_type == RiskEventType.VPN_DETECTED
        )

        assert event.score_impact == 15
        assert event.event_data is not None
        assert event.event_data["vpn"] is True

        print()
        print("VPN Detection Test")
        print("------------------")
        print("VPN detected: True")
        print("Score impact: +15")
        print()
        print("VPN detection test passed.")

    finally:
        db.rollback()
        db.close()


def test_proxy_detection():
    db = SessionLocal()

    try:
        merchant = Merchant(
            name="Proxy Test Merchant",
            email=f"proxy-{uuid4()}@ordium.local",
            status=MerchantStatus.ACTIVE,
        )

        db.add(merchant)
        db.flush()

        order = Order(
            merchant_id=merchant.id,
            external_order_id=f"PROXY-{uuid4()}",
            status=OrderStatus.PENDING,
            total_amount=5000,
            currency="DZD",
            first_name="Proxy",
            last_name="Test",
            ip_address="20.20.20.20",
            source="test",
        )

        db.add(order)
        db.flush()

        provider = MockNetworkIntelligenceProvider()

        result = RiskService(
            db,
            network_provider=provider,
        ).assess_order(order)

        event = next(
            event
            for event in result.events
            if event.event_type == RiskEventType.PROXY_DETECTED
        )

        assert event.score_impact == 15
        assert event.event_data is not None
        assert event.event_data["proxy"] is True

        print()
        print("Proxy Detection Test")
        print("--------------------")
        print("Proxy detected: True")
        print("Score impact: +15")
        print()
        print("Proxy detection test passed.")

    finally:
        db.rollback()
        db.close()


if __name__ == "__main__":
    test_vpn_detection()
    test_proxy_detection()