from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class RiskProfile(Base):
    __tablename__ = "risk_profiles"

    id: Mapped[UUID] = mapped_column(
        primary_key=True,
        default=uuid4,
    )

    merchant_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "merchants.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        unique=True,
        index=True,
    )

    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # ---------------------------------------------------------
    # Customer cancellation
    # ---------------------------------------------------------
    high_cancel_rate_threshold: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.70,
    )

    high_cancel_rate_min_orders: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=5,
    )

    high_cancel_rate_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=35,
    )

    # ---------------------------------------------------------
    # Phone reuse
    # ---------------------------------------------------------
    phone_reuse_threshold: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=10,
    )

    phone_reuse_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=15,
    )

    # ---------------------------------------------------------
    # Device reuse
    # ---------------------------------------------------------
    device_reuse_threshold: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=10,
    )

    device_reuse_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=20,
    )

    # ---------------------------------------------------------
    # Address reuse
    # ---------------------------------------------------------
    address_reuse_threshold: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=10,
    )

    address_reuse_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=15,
    )

    # ---------------------------------------------------------
    # Multiple customers / same phone
    # ---------------------------------------------------------
    multiple_customers_same_phone_threshold: Mapped[int] = (
        mapped_column(
            Integer,
            nullable=False,
            default=2,
        )
    )

    multiple_customers_same_phone_score: Mapped[int] = (
        mapped_column(
            Integer,
            nullable=False,
            default=20,
        )
    )

    # ---------------------------------------------------------
    # Multiple phones / same device
    # ---------------------------------------------------------
    multiple_phones_same_device_threshold: Mapped[int] = (
        mapped_column(
            Integer,
            nullable=False,
            default=2,
        )
    )

    multiple_phones_same_device_score: Mapped[int] = (
        mapped_column(
            Integer,
            nullable=False,
            default=25,
        )
    )

    # ---------------------------------------------------------
    # Order frequency
    # ---------------------------------------------------------
    high_order_frequency_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=5,
    )

    high_order_frequency_window_minutes: Mapped[int] = (
        mapped_column(
            Integer,
            nullable=False,
            default=10,
        )
    )

    high_order_frequency_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=20,
    )

    # ---------------------------------------------------------
    # IP frequency
    # ---------------------------------------------------------
    high_ip_frequency_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=5,
    )

    high_ip_frequency_window_minutes: Mapped[int] = (
        mapped_column(
            Integer,
            nullable=False,
            default=10,
        )
    )

    high_ip_frequency_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=20,
    )

    # ---------------------------------------------------------
    # Multiple customers / same IP
    # ---------------------------------------------------------
    multiple_customers_same_ip_threshold: Mapped[int] = (
        mapped_column(
            Integer,
            nullable=False,
            default=2,
        )
    )

    multiple_customers_same_ip_score: Mapped[int] = (
        mapped_column(
            Integer,
            nullable=False,
            default=20,
        )
    )

    # ---------------------------------------------------------
    # New device
    # ---------------------------------------------------------
    new_device_customer_min_orders: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=2,
    )

    new_device_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=10,
    )

    # ---------------------------------------------------------
    # Network intelligence
    # ---------------------------------------------------------
    vpn_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=15,
    )

    proxy_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=15,
    )

    duplicate_order_window_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=30
    )
    duplicate_order_score: Mapped[int] = mapped_column(
        Integer, nullable=False, default=10
    )
    burst_ip_window_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=10
    )
    burst_ip_customer_threshold: Mapped[int] = mapped_column(
        Integer, nullable=False, default=3
    )
    burst_ip_phone_threshold: Mapped[int] = mapped_column(
        Integer, nullable=False, default=3
    )
    burst_ip_score: Mapped[int] = mapped_column(
        Integer, nullable=False, default=20
    )
    strong_identity_combination_score: Mapped[int] = mapped_column(
        Integer, nullable=False, default=15
    )

    # ---------------------------------------------------------
    # Multi-window velocity
    # ---------------------------------------------------------
    customer_velocity_count: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    customer_velocity_window_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    customer_velocity_score: Mapped[int] = mapped_column(Integer, nullable=False, default=10)

    phone_velocity_count: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    phone_velocity_window_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    phone_velocity_score: Mapped[int] = mapped_column(Integer, nullable=False, default=12)

    device_velocity_count: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    device_velocity_window_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    device_velocity_score: Mapped[int] = mapped_column(Integer, nullable=False, default=12)

    multiple_customers_same_address_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    multiple_customers_same_address_score: Mapped[int] = mapped_column(Integer, nullable=False, default=18)

    multiple_customers_same_device_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    multiple_customers_same_device_score: Mapped[int] = mapped_column(Integer, nullable=False, default=25)

    high_ip_reputation_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=85)
    high_ip_reputation_score: Mapped[int] = mapped_column(Integer, nullable=False, default=20)
    bot_activity_score: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    tor_score: Mapped[int] = mapped_column(Integer, nullable=False, default=20)

    # ---------------------------------------------------------
    # Cross-merchant network reputation
    # ---------------------------------------------------------
    global_phone_min_orders: Mapped[int] = mapped_column(Integer, nullable=False, default=12)
    global_phone_bad_rate_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=0.70)
    global_phone_min_merchants: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    global_reputation_min_bad_merchants: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    global_phone_score: Mapped[int] = mapped_column(Integer, nullable=False, default=20)

    global_device_min_orders: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    global_device_bad_rate_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=0.65)
    global_device_min_merchants: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    global_device_score: Mapped[int] = mapped_column(Integer, nullable=False, default=25)

    global_ip_min_orders: Mapped[int] = mapped_column(Integer, nullable=False, default=20)
    global_ip_bad_rate_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=0.70)
    global_ip_min_merchants: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    global_ip_score: Mapped[int] = mapped_column(Integer, nullable=False, default=20)

    # ---------------------------------------------------------
    # Business / product context
    # ---------------------------------------------------------
    business_context_min_orders: Mapped[int] = mapped_column(Integer, nullable=False, default=20)
    business_context_recent_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    business_context_recent_min_orders: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    business_context_quantity_multiplier: Mapped[float] = mapped_column(Float, nullable=False, default=1.75)
    business_context_value_multiplier: Mapped[float] = mapped_column(Float, nullable=False, default=2.0)
    unusual_quantity_score: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    unusual_value_score: Mapped[int] = mapped_column(Integer, nullable=False, default=10)

    # ---------------------------------------------------------
    # Decision thresholds
    # ---------------------------------------------------------
    review_threshold: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=50,
    )

    reject_threshold: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=80,
    )

    identity_cluster_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=6)
    identity_cluster_score: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    max_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=100,
    )

    # ---------------------------------------------------------
    # Status / timestamps
    # ---------------------------------------------------------
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    merchant: Mapped["Merchant"] = relationship(
        back_populates="risk_profile",
    )