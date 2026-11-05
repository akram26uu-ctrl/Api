from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.carrier_account import CarrierAccount
from app.models.shipping_settings import ShippingRoute, ShippingSettings
from app.models.store import Store


class ShippingSettingsService:
    def __init__(self, db: Session):
        self.db = db

    def _find(self, store_id: UUID) -> ShippingSettings | None:
        return self.db.query(ShippingSettings).filter(ShippingSettings.store_id == store_id).first()

    def get_or_default(self, store_id: UUID) -> ShippingSettings:
        settings = self._find(store_id)
        if settings is not None:
            return settings
        merchant_id = self.db.query(Store.merchant_id).filter(Store.id == store_id).scalar()
        settings = ShippingSettings(
            merchant_id=merchant_id, store_id=store_id, auto_dispatch=True, dispatch_trigger="after_confirmation",
            hold_minutes=15, retry_max=5, retry_interval_minutes=10, fallback_enabled=True,
            out_of_stock_policy="hold", low_stock_days=5, reserve_on_accept=True, disable_product_when_out=False,
            confirmation_timeout_hours=24, label_size="a6", notify_on_hold=True, notify_on_failure=True,
            notify_on_low_stock=True,
        )
        try:
            with self.db.begin_nested():
                self.db.add(settings)
        except IntegrityError:
            # Lost the race on the unique store_id: use the row the winner created.
            existing = self._find(store_id)
            if existing is None:
                raise
            return existing
        return settings

    def update(self, store_id: UUID, changes: dict) -> ShippingSettings:
        settings = self.get_or_default(store_id)
        for key, value in changes.items():
            if value is None and key not in ("pickup_name", "pickup_wilaya", "pickup_commune", "pickup_phone"):
                continue
            setattr(settings, key, value)
        self.db.flush()
        return settings

    def resolve_route(self, store_id: UUID, environment: str, wilaya_code: str):
        """Return (primary, fallback) active accounts for a wilaya."""
        active = {
            a.id: a for a in self.db.query(CarrierAccount).filter(
                CarrierAccount.store_id == store_id, CarrierAccount.environment == environment,
                CarrierAccount.status == "active")
        }
        routes = self.db.query(ShippingRoute).filter(ShippingRoute.store_id == store_id).order_by(
            ShippingRoute.priority.asc(), ShippingRoute.id.asc()).all()
        specific = [r for r in routes if r.wilaya_codes and wilaya_code in r.wilaya_codes]
        defaults = [r for r in routes if not r.wilaya_codes]
        for route in specific + defaults:
            primary = active.get(route.carrier_account_id)
            if primary is None:
                continue
            fallback = active.get(route.fallback_carrier_account_id) if route.fallback_carrier_account_id else None
            return primary, fallback
        if len(active) == 1:
            return next(iter(active.values())), None
        return None, None
