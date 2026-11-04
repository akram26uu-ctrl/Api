from datetime import timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.risk_config import SHARED_IP_WINDOW_DAYS, is_mobile_network
from app.models.order import Order


class IdentityGraphService:
    """Relational identity graph over the existing PostgreSQL schema."""

    def __init__(self, db: Session):
        self.db = db

    def summarize_order(self, order: Order, network_result=None) -> dict:
        nodes = {
            "customer": bool(order.customer_id),
            "phone": bool(order.phone_identifier_id),
            "device": bool(order.device_identifier_id),
            "address": bool(order.address_identifier_id),
            "ip_present": bool(order.ip_address),
        }
        counts: dict[str, int] = {}
        connected_customers: set[UUID] = set()

        for key, column_name, value in (
            ("phone_customers", "phone_identifier_id", order.phone_identifier_id),
            ("device_customers", "device_identifier_id", order.device_identifier_id),
            ("address_customers", "address_identifier_id", order.address_identifier_id),
        ):
            if value:
                customer_ids = self._customer_ids(column_name, value, order)
                counts[key] = len(customer_ids)
                connected_customers.update(customer_ids)

        # A mobile-carrier IP joins unrelated subscribers; it is not an
        # identity link.
        ip_is_link = bool(order.ip_address) and not is_mobile_network(network_result)
        if ip_is_link:
            customer_ids = self._ip_customer_ids(order)
            counts["ip_customers"] = len(customer_ids)
            connected_customers.update(customer_ids)

        return {
            "nodes": nodes,
            "counts": counts,
            # Count unique connected customers, not the sum of overlapping
            # relationship counts. This avoids inflating clusters when the
            # same customer appears through several identifiers.
            # The buyer's own past orders are history, not other identities.
            "identity_cluster_size": len(connected_customers),
        }

    def _customer_ids(self, column_name: str, value, order: Order) -> set[UUID]:
        column = getattr(Order, column_name)
        statement = select(func.distinct(Order.customer_id)).where(
            Order.merchant_id == order.merchant_id,
            Order.environment == order.environment,
            column == value,
            Order.customer_id.is_not(None),
            Order.id != order.id,
            # The buyer's own past orders are history, not other identities.
            Order.customer_id.is_distinct_from(order.customer_id),
        )
        return {customer_id for customer_id in self.db.scalars(statement).all() if customer_id is not None}

    def _ip_customer_ids(self, order: Order) -> set[UUID]:
        statement = select(func.distinct(Order.customer_id)).where(
            Order.merchant_id == order.merchant_id,
            Order.environment == order.environment,
            Order.ip_address == order.ip_address,
            Order.customer_id.is_not(None),
            Order.id != order.id,
            Order.customer_id.is_distinct_from(order.customer_id),
        )
        created_at = getattr(order, "created_at", None)
        if created_at is not None:
            statement = statement.where(Order.created_at >= created_at - timedelta(days=SHARED_IP_WINDOW_DAYS))
        return {customer_id for customer_id in self.db.scalars(statement).all() if customer_id is not None}
