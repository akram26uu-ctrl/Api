"""The paid IP lookup runs only for requests that will actually be scored."""
from uuid import uuid4

import pytest

from app.db.database import SessionLocal
from app.models.enums import MerchantStatus
from app.models.merchant import Merchant
from app.schemas.order import OrderCreate
from app.services.api_key_service import ApiKeyService
from app.services.network_intelligence import NetworkIntelResult
from app.services.order_service import OrderService


class _CountingProvider:
    def __init__(self):
        self.calls = 0

    def lookup(self, ip_address):
        self.calls += 1
        return NetworkIntelResult(ip_address=ip_address, provider="test")


def _setup(db):
    merchant = Merchant(name="Lookup", email=f"lookup-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
    db.add(merchant)
    db.flush()
    api_key, _ = ApiKeyService(db).create_key(merchant=merchant, name="l", environment="live")
    db.commit()
    service = OrderService(db)
    provider = _CountingProvider()
    service.risk_service.network_provider = provider
    return merchant, api_key, service, provider


def _data(external_id):
    return OrderCreate(
        external_order_id=external_id, first_name="Look", last_name="Up", phone="0555123499",
        wilaya="Algiers", commune="Bab Ezzouar", address="1 Street", total_amount="5000.00",
    )


def test_idempotent_replay_does_not_pay_for_a_lookup():
    db = SessionLocal()
    try:
        merchant, api_key, service, provider = _setup(db)
        data, key = _data(f"lk-{uuid4()}"), f"idem-{uuid4()}"
        first = service.create_order(merchant_id=merchant.id, data=data, api_key=api_key,
                                     store_id=api_key.store_id, idempotency_key=key, ip_address="41.100.1.1")
        assert provider.calls == 1
        replay = service.create_order(merchant_id=merchant.id, data=data, api_key=api_key,
                                      store_id=api_key.store_id, idempotency_key=key, ip_address="41.100.1.1")
        assert replay.replayed and replay.order.id == first.order.id
        assert provider.calls == 1
    finally:
        db.close()


def test_duplicate_order_number_does_not_pay_for_a_lookup():
    db = SessionLocal()
    try:
        merchant, api_key, service, provider = _setup(db)
        data = _data(f"lk-{uuid4()}")
        service.create_order(merchant_id=merchant.id, data=data, api_key=api_key,
                             store_id=api_key.store_id, ip_address="41.100.1.2")
        with pytest.raises(ValueError, match="already exists"):
            service.create_order(merchant_id=merchant.id, data=data, api_key=api_key,
                                 store_id=api_key.store_id, ip_address="41.100.1.2")
        assert provider.calls == 1
    finally:
        db.close()
