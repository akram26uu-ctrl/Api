from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.db.database import SessionLocal
from app.models.enums import MerchantStatus, OrderStatus, RiskEventType
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.order_item import OrderItem
from app.services.risk_service import RiskService


def _add_order(db, merchant, external_id, quantity, unit_price, category, created_at):
    order = Order(
        merchant_id=merchant.id,
        external_order_id=external_id,
        status=OrderStatus.DELIVERED,
        total_amount=quantity * unit_price,
        currency="DZD",
        first_name="History",
        last_name="Customer",
        environment="live",
        data_origin="real",
        created_at=created_at,
    )
    db.add(order); db.flush()
    db.add(OrderItem(
        order_id=order.id,
        product_name="Historical product",
        product_category=category,
        product_category_normalized=category,
        quantity=quantity,
        unit_price=unit_price,
    ))
    db.flush()
    return order


def test_business_context_distinguishes_quantity_by_category():
    db = SessionLocal()
    try:
        merchant = Merchant(
            name="Appliances", email=f"bc-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE,
            primary_business_category="home_appliances",
        )
        db.add(merchant); db.flush()
        now = datetime.now(timezone.utc)
        for i in range(20):
            _add_order(db, merchant, f"H-{i}", 1, 1000, "refrigerators", now - timedelta(days=i + 1))

        current = Order(
            merchant_id=merchant.id, external_order_id="CURRENT", status=OrderStatus.PENDING,
            total_amount=5000, currency="DZD", first_name="Current", last_name="Customer",
            environment="live", data_origin="real", created_at=now,
        )
        db.add(current); db.flush()
        db.add(OrderItem(
            order_id=current.id, product_name="Refrigerator", product_category="refrigerators",
            product_category_normalized="refrigerators", quantity=5, unit_price=1000,
        ))
        db.flush()

        result = RiskService(db).assess_order(current)
        assert any(e.event_type == RiskEventType.UNUSUAL_ORDER_QUANTITY for e in result.events)
    finally:
        db.rollback(); db.close()



def test_business_context_flags_three_refrigerators_when_one_is_normal():
    db = SessionLocal()
    try:
        merchant = Merchant(
            name="Three Refrigerators", email=f"bc-3-fridges-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE,
            primary_business_category="home_appliances",
        )
        db.add(merchant); db.flush()
        now = datetime.now(timezone.utc)
        for i in range(20):
            _add_order(db, merchant, f"R-{i}", 1, 1000, "refrigerators", now - timedelta(days=i + 1))

        current = Order(
            merchant_id=merchant.id, external_order_id="CURRENT-3-FRIDGES", status=OrderStatus.PENDING,
            total_amount=3000, currency="DZD", first_name="Current", last_name="Customer",
            environment="live", data_origin="real", created_at=now,
        )
        db.add(current); db.flush()
        db.add(OrderItem(
            order_id=current.id, product_name="Refrigerator", product_category="refrigerators",
            product_category_normalized="refrigerators", quantity=3, unit_price=1000,
        ))
        db.flush()

        result = RiskService(db).assess_order(current)
        event = next(e for e in result.events if e.event_type == RiskEventType.UNUSUAL_ORDER_QUANTITY)
        assert event.event_data["baseline_median"] == 1.0
        assert event.event_data["current_total_quantity"] == 3
        assert event.event_data["baseline_scope"] == "product_category"
    finally:
        db.rollback(); db.close()

def test_business_context_does_not_treat_same_quantity_as_anomaly_when_category_norm_is_high():
    db = SessionLocal()
    try:
        merchant = Merchant(
            name="Fashion", email=f"bc2-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE,
            primary_business_category="fashion",
        )
        db.add(merchant); db.flush()
        now = datetime.now(timezone.utc)
        for i in range(20):
            _add_order(db, merchant, f"F-{i}", 5, 100, "shirts", now - timedelta(days=i + 1))
        current = Order(
            merchant_id=merchant.id, external_order_id="CURRENT-F", status=OrderStatus.PENDING,
            total_amount=500, currency="DZD", first_name="Current", last_name="Customer",
            environment="live", data_origin="real", created_at=now,
        )
        db.add(current); db.flush()
        db.add(OrderItem(
            order_id=current.id, product_name="T-shirt", product_category="shirts",
            product_category_normalized="shirts", quantity=5, unit_price=100,
        ))
        db.flush()
        result = RiskService(db).assess_order(current)
        assert not any(e.event_type == RiskEventType.UNUSUAL_ORDER_QUANTITY for e in result.events)
    finally:
        db.rollback(); db.close()


def test_business_context_requires_sufficient_history():
    db = SessionLocal()
    try:
        merchant = Merchant(
            name="Small", email=f"bc3-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE,
            primary_business_category="electronics",
        )
        db.add(merchant); db.flush()
        now = datetime.now(timezone.utc)
        for i in range(3):
            _add_order(db, merchant, f"S-{i}", 1, 100, "phones", now - timedelta(days=i + 1))
        current = Order(
            merchant_id=merchant.id, external_order_id="CURRENT-S", status=OrderStatus.PENDING,
            total_amount=5000, currency="DZD", first_name="Current", last_name="Customer",
            environment="live", data_origin="real", created_at=now,
        )
        db.add(current); db.flush()
        db.add(OrderItem(
            order_id=current.id, product_name="Phone", product_category="phones",
            product_category_normalized="phones", quantity=20, unit_price=250,
        ))
        db.flush()
        result = RiskService(db).assess_order(current)
        assert not any(e.event_type in {RiskEventType.UNUSUAL_ORDER_QUANTITY, RiskEventType.UNUSUAL_ORDER_VALUE} for e in result.events)
    finally:
        db.rollback(); db.close()


def test_business_context_prefers_sku_baseline_when_available():
    db = SessionLocal()
    try:
        merchant = Merchant(
            name="SKU Baseline", email=f"bc-sku-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE,
            primary_business_category="home_appliances",
        )
        db.add(merchant); db.flush()
        now = datetime.now(timezone.utc)
        for i in range(20):
            _add_order(db, merchant, f"SKU-{i}", 1, 1000, "refrigerators", now - timedelta(days=i + 1))
            db.query(OrderItem).filter(OrderItem.order_id == db.query(Order).filter(Order.external_order_id == f"SKU-{i}").one().id).update({"sku": "FRIDGE-A"})
        db.flush()

        current = Order(
            merchant_id=merchant.id, external_order_id="CURRENT-SKU", status=OrderStatus.PENDING,
            total_amount=3000, currency="DZD", first_name="Current", last_name="Customer",
            environment="live", data_origin="real", created_at=now,
        )
        db.add(current); db.flush()
        db.add(OrderItem(
            order_id=current.id, product_name="Refrigerator A", sku="fridge-a",
            product_category="refrigerators", product_category_normalized="refrigerators", quantity=3, unit_price=1000,
        ))
        db.flush()

        context = RiskService(db).business_context_service.build(current, min_samples=20)
        assert context["baseline_scope"] == "sku"
        assert context["baseline_key"] == "fridge-a"
        assert context["quantity_baseline"]["sample_size"] == 20
    finally:
        db.rollback(); db.close()


def test_business_context_ignores_cancelled_history():
    db = SessionLocal()
    try:
        merchant = Merchant(
            name="Trusted History", email=f"bc-status-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE,
            primary_business_category="home_appliances",
        )
        db.add(merchant); db.flush()
        now = datetime.now(timezone.utc)
        for i in range(20):
            order = _add_order(db, merchant, f"D-{i}", 1, 1000, "refrigerators", now - timedelta(days=i + 1))
            order.status = OrderStatus.CANCELLED
        for i in range(20):
            _add_order(db, merchant, f"L-{i}", 1, 1000, "refrigerators", now - timedelta(days=i + 31))
        db.flush()

        current = Order(
            merchant_id=merchant.id, external_order_id="CURRENT-STATUS", status=OrderStatus.PENDING,
            total_amount=5000, currency="DZD", first_name="Current", last_name="Customer",
            environment="live", data_origin="real", created_at=now,
        )
        db.add(current); db.flush()
        db.add(OrderItem(
            order_id=current.id, product_name="Refrigerator", product_category="refrigerators",
            product_category_normalized="refrigerators", quantity=5, unit_price=1000,
        ))
        db.flush()

        context = RiskService(db).business_context_service.build(current, min_samples=20)
        assert context["baseline_scope"] == "product_category"
        assert context["quantity_baseline"]["sample_size"] == 20
    finally:
        db.rollback(); db.close()


def test_business_context_recent_baseline_prevents_false_positive_during_recent_shift():
    db = SessionLocal()
    try:
        merchant = Merchant(
            name="Recent Shift", email=f"bc-recent-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE,
            primary_business_category="home_appliances",
        )
        db.add(merchant); db.flush()
        now = datetime.now(timezone.utc)
        # Long-term normal behavior: one refrigerator/order.
        for i in range(20):
            _add_order(db, merchant, f"H-{i}", 1, 1000, "refrigerators", now - timedelta(days=60 + i))
        # Recent campaign behavior: five refrigerators/order.
        for i in range(10):
            _add_order(db, merchant, f"R-{i}", 5, 1000, "refrigerators", now - timedelta(days=1 + i))

        current = Order(
            merchant_id=merchant.id, external_order_id="CURRENT-RECENT", status=OrderStatus.PENDING,
            total_amount=6000, currency="DZD", first_name="Current", last_name="Customer",
            environment="live", data_origin="real", created_at=now,
        )
        db.add(current); db.flush()
        db.add(OrderItem(
            order_id=current.id, product_name="Refrigerator", product_category="refrigerators",
            product_category_normalized="refrigerators", quantity=6, unit_price=1000,
        ))
        db.flush()

        result = RiskService(db).assess_order(current)
        assert not any(e.event_type == RiskEventType.UNUSUAL_ORDER_QUANTITY for e in result.events)

        context = RiskService(db).business_context_service.build(
            current, min_samples=20, recent_days=30, recent_min_samples=10
        )
        assert context["quantity_baseline"]["sample_size"] == 30
        assert context["quantity_baseline"]["recent"]["sample_size"] == 10
        assert context["quantity_baseline"]["recent"]["median"] == 5.0
    finally:
        db.rollback(); db.close()


def test_business_context_recent_shift_still_flags_extreme_order():
    db = SessionLocal()
    try:
        merchant = Merchant(
            name="Recent Extreme", email=f"bc-recent-extreme-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE,
            primary_business_category="home_appliances",
        )
        db.add(merchant); db.flush()
        now = datetime.now(timezone.utc)
        for i in range(20):
            _add_order(db, merchant, f"EH-{i}", 1, 1000, "refrigerators", now - timedelta(days=60 + i))
        for i in range(10):
            _add_order(db, merchant, f"ER-{i}", 5, 1000, "refrigerators", now - timedelta(days=1 + i))

        current = Order(
            merchant_id=merchant.id, external_order_id="CURRENT-EXTREME", status=OrderStatus.PENDING,
            total_amount=12000, currency="DZD", first_name="Current", last_name="Customer",
            environment="live", data_origin="real", created_at=now,
        )
        db.add(current); db.flush()
        db.add(OrderItem(
            order_id=current.id, product_name="Refrigerator", product_category="refrigerators",
            product_category_normalized="refrigerators", quantity=12, unit_price=1000,
        ))
        db.flush()

        result = RiskService(db).assess_order(current)
        event = next(e for e in result.events if e.event_type == RiskEventType.UNUSUAL_ORDER_QUANTITY)
        assert event.event_data["recent_threshold"] is not None
        assert event.event_data["recent_sample_size"] == 10
    finally:
        db.rollback(); db.close()


def test_business_context_time_behavior_uses_trusted_merchant_activity():
    db = SessionLocal()
    try:
        merchant = Merchant(
            name="Time Behavior", email=f"bc-time-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE,
            primary_business_category="electronics",
        )
        db.add(merchant); db.flush()
        now = datetime(2026, 9, 28, 10, 30, tzinfo=timezone.utc)  # Monday, 10:30 UTC

        for i in range(12):
            _add_order(
                db, merchant, f"TB-{i}", 1, 1000, "phones",
                now - timedelta(days=7 * (i + 1), hours=0),
            )
        for i in range(8):
            _add_order(
                db, merchant, f"TB-OTHER-{i}", 1, 1000, "phones",
                now - timedelta(days=1 + i, hours=5),
            )

        current = Order(
            merchant_id=merchant.id, external_order_id="CURRENT-TIME", status=OrderStatus.PENDING,
            total_amount=1000, currency="DZD", first_name="Current", last_name="Customer",
            environment="live", data_origin="real", created_at=now,
        )
        db.add(current); db.flush()
        db.add(OrderItem(
            order_id=current.id, product_name="Phone", product_category="phones",
            product_category_normalized="phones", quantity=1, unit_price=1000,
        ))
        db.flush()

        context = RiskService(db).business_context_service.build(current, min_samples=20)
        time_behavior = context["time_behavior"]
        assert time_behavior["timezone"] == "UTC"
        assert time_behavior["same_weekday_bucket_sample_size"] == 12
        assert time_behavior["confidence"] == "medium"
        assert time_behavior["same_weekday_share"] is not None
    finally:
        db.rollback(); db.close()


def test_business_context_time_behavior_is_insufficient_without_bucket_history():
    db = SessionLocal()
    try:
        merchant = Merchant(
            name="Sparse Time Behavior", email=f"bc-time-sparse-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE,
            primary_business_category="electronics",
        )
        db.add(merchant); db.flush()
        now = datetime(2026, 9, 28, 10, 30, tzinfo=timezone.utc)
        for i in range(8):
            _add_order(
                db, merchant, f"TS-{i}", 1, 1000, "phones",
                now - timedelta(days=1 + i),
            )

        current = Order(
            merchant_id=merchant.id, external_order_id="CURRENT-TIME-SPARSE", status=OrderStatus.PENDING,
            total_amount=1000, currency="DZD", first_name="Current", last_name="Customer",
            environment="live", data_origin="real", created_at=now,
        )
        db.add(current); db.flush()
        db.add(OrderItem(
            order_id=current.id, product_name="Phone", product_category="phones",
            product_category_normalized="phones", quantity=1, unit_price=1000,
        ))
        db.flush()

        context = RiskService(db).business_context_service.build(current, min_samples=20)
        time_behavior = context["time_behavior"]
        assert time_behavior["sample_size"] == 8
        assert time_behavior["same_weekday_bucket_sample_size"] < 10
        assert time_behavior["confidence"] == "insufficient"
    finally:
        db.rollback(); db.close()
