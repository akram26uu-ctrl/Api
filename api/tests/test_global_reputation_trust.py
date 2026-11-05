"""F2/F8: global reputation must ignore fresh merchant accounts and
cancellations explained by stock or by Ordium's own decision."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.db.database import SessionLocal
from app.models.customer import Customer
from app.models.enums import MerchantStatus, OrderStatus, RiskEventType
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.order_outcome import OrderOutcome
from app.models.phone_identifier import PhoneIdentifier
from app.services.risk_service import RiskService


def _global_phone_flagged(merchant_age_days: int, reason: str | None) -> bool:
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        merchants = []
        for i in range(2):
            m = Merchant(
                name=f"Trust-{i}", email=f"trust-{i}-{uuid4()}@ordium.local",
                status=MerchantStatus.ACTIVE, created_at=now - timedelta(days=merchant_age_days),
            )
            db.add(m)
            db.flush()
            merchants.append(m)
        phone = PhoneIdentifier(phone=f"066{uuid4().int % 10**7:07d}")
        db.add(phone)
        db.flush()
        for i in range(12):
            c = Customer(first_name=f"T{i}", last_name="User", normalized_name=f"t{i} user {uuid4().hex}")
            db.add(c)
            db.flush()
            bad = i < 10
            o = Order(
                merchant_id=merchants[i % 2].id, customer_id=c.id, phone_identifier_id=phone.id,
                external_order_id=f"TRUST-{uuid4()}",
                status=OrderStatus.CANCELLED if bad else OrderStatus.DELIVERED,
                total_amount=5000, currency="DZD", first_name=f"T{i}", last_name="User",
                environment="live", data_origin="real", created_at=now - timedelta(days=2, minutes=i),
            )
            db.add(o)
            db.flush()
            db.add(OrderOutcome(order_id=o.id, outcome_status="cancelled" if bad else "delivered", reason=reason if bad else None))
        db.flush()
        cc = Customer(first_name="Cur", last_name="User", normalized_name=f"cur {uuid4().hex}")
        db.add(cc)
        db.flush()
        current = Order(
            merchant_id=merchants[0].id, customer_id=cc.id, phone_identifier_id=phone.id,
            external_order_id=f"TRUST-CUR-{uuid4()}", total_amount=5000, currency="DZD",
            first_name="Cur", last_name="User", environment="live", data_origin="real", created_at=now,
        )
        db.add(current)
        db.flush()
        result = RiskService(db).assess_order(current)
        return RiskEventType.GLOBAL_PHONE_REPUTATION in {e.event_type for e in result.events}
    finally:
        db.rollback()
        db.close()


def test_established_merchants_build_global_reputation():
    assert _global_phone_flagged(merchant_age_days=30, reason=None)
    assert _global_phone_flagged(merchant_age_days=30, reason="customer_refused")


def test_fresh_merchant_accounts_cannot_poison_global_reputation():
    assert not _global_phone_flagged(merchant_age_days=1, reason=None)


def test_risk_decision_and_stock_cancellations_are_not_bad_evidence():
    assert not _global_phone_flagged(merchant_age_days=30, reason="risk_decision")
    assert not _global_phone_flagged(merchant_age_days=30, reason="out_of_stock")
