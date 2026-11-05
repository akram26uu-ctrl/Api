from uuid import UUID, uuid4

from sqlalchemy import Boolean, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CarrierWarehouse(Base):
    __tablename__ = "carrier_warehouses"
    __table_args__ = (
        Index("uq_carrier_warehouses_external", "carrier_account_id", "external_id", unique=True),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    carrier_account_id: Mapped[UUID] = mapped_column(ForeignKey("carrier_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    external_id: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    wilaya_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    commune: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
