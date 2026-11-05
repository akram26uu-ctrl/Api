import json
from datetime import datetime, timezone
from typing import Callable
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.secret_crypto import fernet
from app.models.carrier_account import CarrierAccount
from app.models.carrier_warehouse import CarrierWarehouse
from app.services.carriers.base import CarrierAdapter, CarrierAuthError, CarrierError
from app.services.carriers.registry import get_adapter

def _import_stock_on_link(db: Session, account: CarrierAccount, adapter: CarrierAdapter) -> None:
    from app.services.inventory_service import InventoryService
    InventoryService(db).import_for_account(account, adapter)


# hook(db, account, adapter) called at the end of link; default imports carrier stock.
on_linked: Callable[[Session, CarrierAccount, CarrierAdapter], None] = _import_stock_on_link


class CarrierAlreadyLinked(Exception):
    pass


class CarrierInUse(Exception):
    pass


class CarrierAccountService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def encrypt_credentials(credentials: dict) -> str:
        return fernet().encrypt(json.dumps(credentials).encode("utf-8")).decode("utf-8")

    @staticmethod
    def decrypt_credentials(account: CarrierAccount) -> dict:
        if not account.credentials_encrypted:
            return {}
        return json.loads(fernet().decrypt(account.credentials_encrypted.encode("utf-8")).decode("utf-8"))

    def adapter_for(self, account: CarrierAccount) -> CarrierAdapter:
        return get_adapter(account.carrier_code, self.decrypt_credentials(account), account.environment)

    def _sync_warehouses(self, account: CarrierAccount, adapter: CarrierAdapter) -> None:
        existing = {w.external_id: w for w in self.db.query(CarrierWarehouse).filter(CarrierWarehouse.carrier_account_id == account.id)}
        seen = set()
        for info in adapter.list_warehouses():
            seen.add(info.external_id)
            row = existing.get(info.external_id)
            if row is None:
                row = CarrierWarehouse(carrier_account_id=account.id, external_id=info.external_id, name=info.name)
                self.db.add(row)
            row.name, row.wilaya_code, row.commune, row.is_active = info.name, info.wilaya_code, info.commune, True
        for external_id, row in existing.items():
            if external_id not in seen:
                row.is_active = False

    def link(self, merchant_id: UUID, store_id: UUID, environment: str, carrier_code: str,
             display_name: str, credentials: dict) -> CarrierAccount:
        # Raises CarrierNotAvailable / CarrierAuthError before anything is stored.
        adapter = get_adapter(carrier_code, credentials, environment)
        adapter.validate_credentials()
        existing = self.db.query(CarrierAccount).filter(
            CarrierAccount.store_id == store_id, CarrierAccount.environment == environment,
            CarrierAccount.carrier_code == carrier_code,
        ).order_by(CarrierAccount.created_at.desc()).all()
        if any(a.status != "disabled" for a in existing):
            raise CarrierAlreadyLinked(carrier_code)
        encrypted = self.encrypt_credentials(credentials)
        now = datetime.now(timezone.utc)
        if existing:
            account = existing[0]
            account.display_name, account.credentials_encrypted = display_name, encrypted
            account.status, account.last_error, account.last_sync_at = "active", None, now
        else:
            account = CarrierAccount(
                merchant_id=merchant_id, store_id=store_id, environment=environment, carrier_code=carrier_code,
                display_name=display_name, credentials_encrypted=encrypted, status="active", last_sync_at=now,
            )
            self.db.add(account)
        self.db.flush()
        self._sync_warehouses(account, adapter)
        on_linked(self.db, account, adapter)
        self.db.flush()
        return account

    def test(self, account: CarrierAccount) -> None:
        try:
            adapter = self.adapter_for(account)
            adapter.validate_credentials()
        except CarrierError as exc:
            if account.status != "disabled":
                account.status = "error"
            account.last_error = str(exc)[:500]
            self.db.flush()
            raise
        if account.status != "disabled":
            account.status = "active"
        account.last_error = None
        account.last_sync_at = datetime.now(timezone.utc)
        self.db.flush()

    def disable(self, account: CarrierAccount) -> None:
        account.status = "disabled"
        self.db.flush()

    def delete(self, account: CarrierAccount) -> None:
        from app.models.shipment import Shipment
        if self.db.query(Shipment.id).filter(Shipment.carrier_account_id == account.id).first() is not None:
            raise CarrierInUse(str(account.id))
        self.db.query(CarrierWarehouse).filter(CarrierWarehouse.carrier_account_id == account.id).delete()
        self.db.delete(account)
        self.db.flush()

    def first_linked_at(self, store_id: UUID, environment: str) -> datetime | None:
        return self.db.query(func.min(CarrierAccount.created_at)).filter(
            CarrierAccount.store_id == store_id, CarrierAccount.environment == environment
        ).scalar()
