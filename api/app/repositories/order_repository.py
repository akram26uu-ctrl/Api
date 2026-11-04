from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.orm import Session

from app.core.outcomes import BAD_OUTCOME_STATUSES, NON_BAD_REASONS
from app.models.enums import MerchantStatus, OrderStatus
from app.models.merchant import Merchant
from app.models.order import Order
from app.models.order_outcome import OrderOutcome

# Minimum merchant age before its outcomes may influence cross-merchant
# (global) reputation. Blocks fresh throw-away accounts from poisoning the
# network reputation of an arbitrary phone/device/IP.
GLOBAL_REPUTATION_MIN_MERCHANT_AGE_DAYS = 14


def _bad_outcome_condition():
    """SQL form of app.core.outcomes.is_bad_outcome for an OrderOutcome join."""
    return and_(
        OrderOutcome.outcome_status.in_(tuple(BAD_OUTCOME_STATUSES)),
        or_(OrderOutcome.reason.is_(None), OrderOutcome.reason.not_in(tuple(NON_BAD_REASONS))),
    )


def _trusted_merchant_scope(statement):
    cutoff = datetime.now(timezone.utc) - timedelta(days=GLOBAL_REPUTATION_MIN_MERCHANT_AGE_DAYS)
    return statement.join(Merchant, Merchant.id == Order.merchant_id).where(
        Merchant.status == MerchantStatus.ACTIVE,
        Merchant.created_at <= cutoff,
    )


class OrderRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(
        self,
        order_id: UUID,
    ) -> Order | None:
        statement = select(Order).where(
            Order.id == order_id,
        )

        return self.db.scalar(statement)

    def get_by_context(
        self,
        order_id: UUID,
        *,
        merchant_id: UUID,
        environment: str,
    ) -> Order | None:
        statement = select(Order).where(
            Order.id == order_id,
            Order.merchant_id == merchant_id,
            Order.environment == environment,
        )
        return self.db.scalar(statement)

    def get_by_external_id(
        self,
        merchant_id: UUID,
        external_order_id: str,
        environment: str = "live",
        store_id: UUID | None = None,
    ) -> Order | None:
        statement = select(Order).where(
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            Order.external_order_id == external_order_id,
            Order.store_id == store_id,
        )

        return self.db.scalar(statement)

    def count_customer_orders(
        self,
        merchant_id: UUID,
        customer_id: UUID,
        exclude_order_id: UUID | None = None,
        environment: str = "live",
    ) -> int:
        statement = select(
            func.count(Order.id),
        ).where(
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            Order.customer_id == customer_id,
        )

        if exclude_order_id is not None:
            statement = statement.where(
                Order.id != exclude_order_id,
            )

        return self.db.scalar(statement) or 0

    def count_customer_cancelled_orders(
        self,
        merchant_id: UUID,
        customer_id: UUID,
        exclude_order_id: UUID | None = None,
        environment: str = "live",
    ) -> int:
        """Count the customer's *bad* orders: cancelled or returned (COD refusal),
        excluding cancellations explained by stock or by Ordium's own decision."""
        non_bad = exists().where(
            OrderOutcome.order_id == Order.id,
            OrderOutcome.reason.in_(tuple(NON_BAD_REASONS)),
        )
        statement = select(
            func.count(Order.id),
        ).where(
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            Order.customer_id == customer_id,
            Order.status.in_((OrderStatus.CANCELLED, OrderStatus.RETURNED)),
            ~non_bad,
        )

        if exclude_order_id is not None:
            statement = statement.where(
                Order.id != exclude_order_id,
            )

        return self.db.scalar(statement) or 0

    def count_phone_orders(
        self,
        merchant_id: UUID,
        phone_identifier_id: UUID,
        exclude_order_id: UUID | None = None,
        environment: str = "live",
    ) -> int:
        statement = select(
            func.count(Order.id),
        ).where(
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            Order.phone_identifier_id == phone_identifier_id,
        )

        if exclude_order_id is not None:
            statement = statement.where(
                Order.id != exclude_order_id,
            )

        return self.db.scalar(statement) or 0

    def count_device_orders(
        self,
        merchant_id: UUID,
        device_identifier_id: UUID,
        exclude_order_id: UUID | None = None,
        environment: str = "live",
    ) -> int:
        statement = select(
            func.count(Order.id),
        ).where(
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            Order.device_identifier_id == device_identifier_id,
        )

        if exclude_order_id is not None:
            statement = statement.where(
                Order.id != exclude_order_id,
            )

        return self.db.scalar(statement) or 0

    def count_address_orders(
        self,
        merchant_id: UUID,
        address_identifier_id: UUID,
        exclude_order_id: UUID | None = None,
        environment: str = "live",
    ) -> int:
        statement = select(
            func.count(Order.id),
        ).where(
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            Order.address_identifier_id == address_identifier_id,
        )

        if exclude_order_id is not None:
            statement = statement.where(
                Order.id != exclude_order_id,
            )

        return self.db.scalar(statement) or 0

    def count_distinct_customers_for_phone(
        self,
        merchant_id: UUID,
        phone_identifier_id: UUID,
        exclude_order_id: UUID | None = None,
        environment: str = "live",
        exclude_customer_id: UUID | None = None,
    ) -> int:
        statement = select(
            func.count(
                func.distinct(Order.customer_id),
            )
        ).where(
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            Order.phone_identifier_id == phone_identifier_id,
            Order.customer_id.is_not(None),
        )

        if exclude_order_id is not None:
            statement = statement.where(
                Order.id != exclude_order_id,
            )

        if exclude_customer_id is not None:
            statement = statement.where(Order.customer_id.is_distinct_from(exclude_customer_id))
        return self.db.scalar(statement) or 0

    def count_distinct_phones_for_device(
        self,
        merchant_id: UUID,
        device_identifier_id: UUID,
        exclude_order_id: UUID | None = None,
        environment: str = "live",
        exclude_phone_identifier_id: UUID | None = None,
    ) -> int:
        statement = select(
            func.count(
                func.distinct(Order.phone_identifier_id),
            )
        ).where(
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            Order.device_identifier_id == device_identifier_id,
            Order.phone_identifier_id.is_not(None),
        )

        if exclude_order_id is not None:
            statement = statement.where(
                Order.id != exclude_order_id,
            )

        if exclude_phone_identifier_id is not None:
            statement = statement.where(Order.phone_identifier_id.is_distinct_from(exclude_phone_identifier_id))
        return self.db.scalar(statement) or 0

    def count_orders_since(
        self,
        merchant_id: UUID,
        since: datetime,
        exclude_order_id: UUID | None = None,
        environment: str = "live",
    ) -> int:
        statement = select(
            func.count(Order.id),
        ).where(
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            Order.created_at >= since,
        )

        if exclude_order_id is not None:
            statement = statement.where(
                Order.id != exclude_order_id,
            )

        return self.db.scalar(statement) or 0

    def count_orders_in_ranges(
        self,
        merchant_id: UUID,
        ranges: list[tuple[datetime, datetime]],
        environment: str = "live",
    ) -> int:
        if not ranges:
            return 0
        statement = select(func.count(Order.id)).where(
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            or_(*(and_(Order.created_at >= start, Order.created_at < end) for start, end in ranges)),
        )
        return self.db.scalar(statement) or 0

    def count_customer_orders_with_device(
        self,
        merchant_id: UUID,
        customer_id: UUID,
        device_identifier_id: UUID,
        exclude_order_id: UUID | None = None,
        environment: str = "live",
    ) -> int:
        statement = select(
            func.count(Order.id),
        ).where(
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            Order.customer_id == customer_id,
            Order.device_identifier_id == device_identifier_id,
        )

        if exclude_order_id is not None:
            statement = statement.where(
                Order.id != exclude_order_id,
            )

        return self.db.scalar(statement) or 0

    def count_distinct_customers_for_ip(
        self,
        merchant_id: UUID,
        ip_address: str,
        exclude_order_id: UUID | None = None,
        environment: str = "live",
        since: datetime | None = None,
        exclude_customer_id: UUID | None = None,
    ) -> int:
        statement = select(
            func.count(
                func.distinct(Order.customer_id),
            )
        ).where(
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            Order.ip_address == ip_address,
            Order.customer_id.is_not(None),
        )

        if since is not None:
            statement = statement.where(Order.created_at >= since)

        if exclude_order_id is not None:
            statement = statement.where(
                Order.id != exclude_order_id,
            )

        if exclude_customer_id is not None:
            statement = statement.where(Order.customer_id.is_distinct_from(exclude_customer_id))
        return self.db.scalar(statement) or 0

    def count_orders_for_ip_since(
        self,
        merchant_id: UUID,
        ip_address: str,
        since: datetime,
        exclude_order_id: UUID | None = None,
        environment: str = "live",
    ) -> int:
        statement = select(
            func.count(Order.id),
        ).where(
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            Order.ip_address == ip_address,
            Order.created_at >= since,
        )

        if exclude_order_id is not None:
            statement = statement.where(
                Order.id != exclude_order_id,
            )

        return self.db.scalar(statement) or 0


    def count_recent_similar_orders(
        self,
        merchant_id: UUID,
        environment: str,
        phone_identifier_id: UUID | None,
        address_identifier_id: UUID | None,
        total_amount,
        since: datetime,
        exclude_order_id: UUID | None = None,
    ) -> int:
        conditions = [
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            Order.phone_identifier_id == phone_identifier_id,
            Order.address_identifier_id == address_identifier_id,
            Order.total_amount == total_amount,
            Order.created_at >= since,
        ]

        statement = select(func.count(Order.id)).where(*conditions)

        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)

        return self.db.scalar(statement) or 0

    def count_distinct_phones_for_ip_since(
        self,
        merchant_id: UUID,
        ip_address: str,
        since: datetime,
        environment: str = "live",
        exclude_order_id: UUID | None = None,
        exclude_phone_identifier_id: UUID | None = None,
    ) -> int:
        statement = select(
            func.count(func.distinct(Order.phone_identifier_id))
        ).where(
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            Order.ip_address == ip_address,
            Order.created_at >= since,
            Order.phone_identifier_id.is_not(None),
        )

        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)

        if exclude_phone_identifier_id is not None:
            statement = statement.where(Order.phone_identifier_id.is_distinct_from(exclude_phone_identifier_id))
        return self.db.scalar(statement) or 0

    def count_customer_orders_since(
        self, merchant_id: UUID, customer_id: UUID, since: datetime,
        exclude_order_id: UUID | None = None, environment: str = "live",
    ) -> int:
        statement = select(func.count(Order.id)).where(
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            Order.customer_id == customer_id,
            Order.created_at >= since,
        )
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_phone_orders_since(
        self, merchant_id: UUID, phone_identifier_id: UUID, since: datetime,
        exclude_order_id: UUID | None = None, environment: str = "live",
    ) -> int:
        statement = select(func.count(Order.id)).where(
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            Order.phone_identifier_id == phone_identifier_id,
            Order.created_at >= since,
        )
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_device_orders_since(
        self, merchant_id: UUID, device_identifier_id: UUID, since: datetime,
        exclude_order_id: UUID | None = None, environment: str = "live",
    ) -> int:
        statement = select(func.count(Order.id)).where(
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            Order.device_identifier_id == device_identifier_id,
            Order.created_at >= since,
        )
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_distinct_customers_for_address(
        self, merchant_id: UUID, address_identifier_id: UUID,
        exclude_order_id: UUID | None = None, environment: str = "live",
        exclude_customer_id: UUID | None = None,
    ) -> int:
        statement = select(func.count(func.distinct(Order.customer_id))).where(
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            Order.address_identifier_id == address_identifier_id,
            Order.customer_id.is_not(None),
        )
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        if exclude_customer_id is not None:
            statement = statement.where(Order.customer_id.is_distinct_from(exclude_customer_id))
        return self.db.scalar(statement) or 0

    def count_distinct_customers_for_device(
        self, merchant_id: UUID, device_identifier_id: UUID,
        exclude_order_id: UUID | None = None, environment: str = "live",
        exclude_customer_id: UUID | None = None,
    ) -> int:
        statement = select(func.count(func.distinct(Order.customer_id))).where(
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            Order.device_identifier_id == device_identifier_id,
            Order.customer_id.is_not(None),
        )
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        if exclude_customer_id is not None:
            statement = statement.where(Order.customer_id.is_distinct_from(exclude_customer_id))
        return self.db.scalar(statement) or 0

    def create(
        self,
        order: Order,
    ) -> Order:
        self.db.add(order)
        self.db.flush()

        return order

    def count_global_orders_for_phone(self, phone_identifier_id: UUID, exclude_order_id: UUID | None = None) -> int:
        statement = select(func.count(Order.id)).where(
            Order.phone_identifier_id == phone_identifier_id,
            Order.environment == "live",
            Order.data_origin == "real",
        )
        statement = _trusted_merchant_scope(statement)
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_global_evaluated_orders_for_phone(self, phone_identifier_id: UUID, exclude_order_id: UUID | None = None) -> int:
        statement = (
            select(func.count(Order.id))
            .join(OrderOutcome, OrderOutcome.order_id == Order.id)
            .where(
                Order.phone_identifier_id == phone_identifier_id,
                Order.environment == "live",
                Order.data_origin == "real",
            )
        )
        statement = _trusted_merchant_scope(statement)
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_global_bad_merchants_for_phone(self, phone_identifier_id: UUID, exclude_order_id: UUID | None = None) -> int:
        statement = (
            select(func.count(func.distinct(Order.merchant_id)))
            .join(OrderOutcome, OrderOutcome.order_id == Order.id)
            .where(
                Order.phone_identifier_id == phone_identifier_id,
                Order.environment == "live",
                Order.data_origin == "real",
                _bad_outcome_condition(),
            )
        )
        statement = _trusted_merchant_scope(statement)
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_global_bad_orders_for_phone(self, phone_identifier_id: UUID, exclude_order_id: UUID | None = None) -> int:
        statement = (
            select(func.count(Order.id))
            .join(OrderOutcome, OrderOutcome.order_id == Order.id)
            .where(
                Order.phone_identifier_id == phone_identifier_id,
                Order.environment == "live",
                Order.data_origin == "real",
                _bad_outcome_condition(),
            )
        )
        statement = _trusted_merchant_scope(statement)
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_global_merchants_for_phone(self, phone_identifier_id: UUID, exclude_order_id: UUID | None = None) -> int:
        statement = select(func.count(func.distinct(Order.merchant_id))).where(
            Order.phone_identifier_id == phone_identifier_id,
            Order.environment == "live",
            Order.data_origin == "real",
        )
        statement = _trusted_merchant_scope(statement)
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_global_orders_for_device(self, device_identifier_id: UUID, exclude_order_id: UUID | None = None) -> int:
        statement = select(func.count(Order.id)).where(
            Order.device_identifier_id == device_identifier_id,
            Order.environment == "live",
            Order.data_origin == "real",
        )
        statement = _trusted_merchant_scope(statement)
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_global_evaluated_orders_for_device(self, device_identifier_id: UUID, exclude_order_id: UUID | None = None) -> int:
        statement = (
            select(func.count(Order.id))
            .join(OrderOutcome, OrderOutcome.order_id == Order.id)
            .where(
                Order.device_identifier_id == device_identifier_id,
                Order.environment == "live",
                Order.data_origin == "real",
            )
        )
        statement = _trusted_merchant_scope(statement)
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_global_bad_merchants_for_device(self, device_identifier_id: UUID, exclude_order_id: UUID | None = None) -> int:
        statement = (
            select(func.count(func.distinct(Order.merchant_id)))
            .join(OrderOutcome, OrderOutcome.order_id == Order.id)
            .where(
                Order.device_identifier_id == device_identifier_id,
                Order.environment == "live",
                Order.data_origin == "real",
                _bad_outcome_condition(),
            )
        )
        statement = _trusted_merchant_scope(statement)
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_global_bad_orders_for_device(self, device_identifier_id: UUID, exclude_order_id: UUID | None = None) -> int:
        statement = (
            select(func.count(Order.id))
            .join(OrderOutcome, OrderOutcome.order_id == Order.id)
            .where(
                Order.device_identifier_id == device_identifier_id,
                Order.environment == "live",
                Order.data_origin == "real",
                _bad_outcome_condition(),
            )
        )
        statement = _trusted_merchant_scope(statement)
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_global_merchants_for_device(self, device_identifier_id: UUID, exclude_order_id: UUID | None = None) -> int:
        statement = select(func.count(func.distinct(Order.merchant_id))).where(
            Order.device_identifier_id == device_identifier_id,
            Order.environment == "live",
            Order.data_origin == "real",
        )
        statement = _trusted_merchant_scope(statement)
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_global_orders_for_ip(self, ip_address: str, exclude_order_id: UUID | None = None) -> int:
        statement = select(func.count(Order.id)).where(
            Order.ip_address == ip_address,
            Order.environment == "live",
            Order.data_origin == "real",
        )
        statement = _trusted_merchant_scope(statement)
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_global_evaluated_orders_for_ip(self, ip_address: str, exclude_order_id: UUID | None = None) -> int:
        statement = (
            select(func.count(Order.id))
            .join(OrderOutcome, OrderOutcome.order_id == Order.id)
            .where(
                Order.ip_address == ip_address,
                Order.environment == "live",
                Order.data_origin == "real",
            )
        )
        statement = _trusted_merchant_scope(statement)
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_global_bad_merchants_for_ip(self, ip_address: str, exclude_order_id: UUID | None = None) -> int:
        statement = (
            select(func.count(func.distinct(Order.merchant_id)))
            .join(OrderOutcome, OrderOutcome.order_id == Order.id)
            .where(
                Order.ip_address == ip_address,
                Order.environment == "live",
                Order.data_origin == "real",
                _bad_outcome_condition(),
            )
        )
        statement = _trusted_merchant_scope(statement)
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_global_bad_orders_for_ip(self, ip_address: str, exclude_order_id: UUID | None = None) -> int:
        statement = (
            select(func.count(Order.id))
            .join(OrderOutcome, OrderOutcome.order_id == Order.id)
            .where(
                Order.ip_address == ip_address,
                Order.environment == "live",
                Order.data_origin == "real",
                _bad_outcome_condition(),
            )
        )
        statement = _trusted_merchant_scope(statement)
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_global_merchants_for_ip(self, ip_address: str, exclude_order_id: UUID | None = None) -> int:
        statement = select(func.count(func.distinct(Order.merchant_id))).where(
            Order.ip_address == ip_address,
            Order.environment == "live",
            Order.data_origin == "real",
        )
        statement = _trusted_merchant_scope(statement)
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0
