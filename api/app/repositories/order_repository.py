from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.enums import OrderStatus
from app.models.order import Order
from app.models.order_outcome import OrderOutcome


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
        statement = select(
            func.count(Order.id),
        ).where(
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            Order.customer_id == customer_id,
            Order.status == OrderStatus.CANCELLED,
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

        return self.db.scalar(statement) or 0

    def count_distinct_phones_for_device(
        self,
        merchant_id: UUID,
        device_identifier_id: UUID,
        exclude_order_id: UUID | None = None,
        environment: str = "live",
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
    ) -> int:
        statement = select(func.count(func.distinct(Order.customer_id))).where(
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            Order.address_identifier_id == address_identifier_id,
            Order.customer_id.is_not(None),
        )
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_distinct_customers_for_device(
        self, merchant_id: UUID, device_identifier_id: UUID,
        exclude_order_id: UUID | None = None, environment: str = "live",
    ) -> int:
        statement = select(func.count(func.distinct(Order.customer_id))).where(
            Order.merchant_id == merchant_id,
            Order.environment == environment,
            Order.device_identifier_id == device_identifier_id,
            Order.customer_id.is_not(None),
        )
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
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
                OrderOutcome.outcome_status.in_(("cancelled", "returned")),
            )
        )
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
                OrderOutcome.outcome_status.in_(("cancelled", "returned")),
            )
        )
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_global_merchants_for_phone(self, phone_identifier_id: UUID, exclude_order_id: UUID | None = None) -> int:
        statement = select(func.count(func.distinct(Order.merchant_id))).where(
            Order.phone_identifier_id == phone_identifier_id,
            Order.environment == "live",
            Order.data_origin == "real",
        )
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_global_orders_for_device(self, device_identifier_id: UUID, exclude_order_id: UUID | None = None) -> int:
        statement = select(func.count(Order.id)).where(
            Order.device_identifier_id == device_identifier_id,
            Order.environment == "live",
            Order.data_origin == "real",
        )
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
                OrderOutcome.outcome_status.in_(("cancelled", "returned")),
            )
        )
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
                OrderOutcome.outcome_status.in_(("cancelled", "returned")),
            )
        )
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_global_merchants_for_device(self, device_identifier_id: UUID, exclude_order_id: UUID | None = None) -> int:
        statement = select(func.count(func.distinct(Order.merchant_id))).where(
            Order.device_identifier_id == device_identifier_id,
            Order.environment == "live",
            Order.data_origin == "real",
        )
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_global_orders_for_ip(self, ip_address: str, exclude_order_id: UUID | None = None) -> int:
        statement = select(func.count(Order.id)).where(
            Order.ip_address == ip_address,
            Order.environment == "live",
            Order.data_origin == "real",
        )
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
                OrderOutcome.outcome_status.in_(("cancelled", "returned")),
            )
        )
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
                OrderOutcome.outcome_status.in_(("cancelled", "returned")),
            )
        )
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0

    def count_global_merchants_for_ip(self, ip_address: str, exclude_order_id: UUID | None = None) -> int:
        statement = select(func.count(func.distinct(Order.merchant_id))).where(
            Order.ip_address == ip_address,
            Order.environment == "live",
            Order.data_origin == "real",
        )
        if exclude_order_id is not None:
            statement = statement.where(Order.id != exclude_order_id)
        return self.db.scalar(statement) or 0
