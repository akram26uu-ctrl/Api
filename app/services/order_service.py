from uuid import UUID

from sqlalchemy.orm import Session

from app.models.address_identifier import AddressIdentifier
from app.models.enums import OrderStatus
from app.models.device_identifier import DeviceIdentifier
from app.models.order import Order
from app.repositories.address_identifier_repository import (
    AddressIdentifierRepository,
)
from app.repositories.device_identifier_repository import (
    DeviceIdentifierRepository,
)
from app.repositories.order_repository import OrderRepository
from app.schemas.order import OrderCreate
from app.services.identity_service import IdentityService


class OrderService:
    def __init__(self, db: Session):
        self.db = db

        self.order_repository = OrderRepository(db)
        self.identity_service = IdentityService(db)
        self.device_repository = DeviceIdentifierRepository(db)
        self.address_repository = AddressIdentifierRepository(db)

    def create_order(
        self,
        merchant_id: UUID,
        data: OrderCreate,
        device_fingerprint: str | None = None,
    ) -> Order:

        try:
            existing_order = self.order_repository.get_by_external_id(
                merchant_id=merchant_id,
                external_order_id=data.external_order_id,
            )

            if existing_order is not None:
                raise ValueError("Order already exists")

            identity = self.identity_service.resolve_customer(
                merchant_id=merchant_id,
                first_name=data.first_name,
                last_name=data.last_name,
                phone=data.phone,
            )

            device_identifier_id = None

            if device_fingerprint:
                device = self.device_repository.get_by_fingerprint(
                    device_fingerprint,
                )

                if device is None:
                    device = DeviceIdentifier(
                        fingerprint=device_fingerprint,
                    )

                    self.device_repository.create(device)

                device_identifier_id = device.id

            normalized_address = self._normalize_address(
                address=data.address,
                commune=data.commune,
                wilaya=data.wilaya,
            )

            address_hash = self._hash_address(
                normalized_address,
            )

            address = self.address_repository.get_by_hash(
                address_hash,
            )

            if address is None:
                address = AddressIdentifier(
                    normalized_address=normalized_address,
                    wilaya=data.wilaya,
                    commune=data.commune,
                    address_hash=address_hash,
                )

                self.address_repository.create(address)

            order = Order(
                merchant_id=merchant_id,
                customer_id=identity.customer.id,
                phone_identifier_id=identity.phone_identifier.id,
                device_identifier_id=device_identifier_id,
                address_identifier_id=address.id,
                external_order_id=data.external_order_id,
                status=OrderStatus.PENDING,
                total_amount=data.total_amount,
                currency=data.currency,
                first_name=data.first_name,
                last_name=data.last_name,
                ip_address=None,
                user_agent=None,
                source="api",
            )

            self.order_repository.create(order)

            self.db.commit()
            self.db.refresh(order)

            return order

        except Exception:
            self.db.rollback()
            raise

    @staticmethod
    def _normalize_address(
        address: str,
        commune: str,
        wilaya: str,
    ) -> str:
        return " ".join(
            f"{address}, {commune}, {wilaya}"
            .lower()
            .split()
        )

    @staticmethod
    def _hash_address(value: str) -> str:
        import hashlib

        return hashlib.sha256(
            value.encode("utf-8"),
        ).hexdigest()