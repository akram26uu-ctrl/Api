"""F5 shadow mode keeps the engine decision; F9 network provider resilience."""
from uuid import uuid4

import httpx

from app.db.database import SessionLocal
from app.models.enums import MerchantStatus, RiskDecision
from app.models.merchant import Merchant
from app.schemas.order import OrderCreate
from app.services import network_intelligence as ni
from app.services.order_service import OrderService
from app.services.risk_service import RiskResult
from app.services.api_key_service import ApiKeyService


def test_shadow_mode_records_engine_decision(monkeypatch):
    db = SessionLocal()
    try:
        merchant = Merchant(name="Shadow", email=f"shadow-{uuid4()}@ordium.local",
                            status=MerchantStatus.ACTIVE, is_shadow_mode_enabled=True)
        db.add(merchant)
        db.flush()
        api_key, _ = ApiKeyService(db).create_key(merchant=merchant, name="s", environment="live")
        db.commit()

        service = OrderService(db)
        original = service.risk_service.assess_order

        def forced_reject(order, network_result=None, **kwargs):
            result = original(order, network_result=network_result, **kwargs)
            result.assessment.decision = RiskDecision.REJECT
            return RiskResult(score=95, decision=RiskDecision.REJECT, assessment=result.assessment, events=result.events)

        monkeypatch.setattr(service.risk_service, "assess_order", forced_reject)
        data = OrderCreate(
            external_order_id=f"sh-{uuid4()}", first_name="Shadow", last_name="Buyer", phone="0555123456",
            wilaya="Algiers", commune="Bab Ezzouar", address="1 Street", total_amount="5000.00",
        )
        result = service.create_order(merchant_id=merchant.id, data=data, api_key=api_key, store_id=api_key.store_id)
        assert result.risk_result.decision is RiskDecision.REVIEW
        assert result.response_body["risk"]["engine_decision"] == "reject"
        assert result.response_body["risk"]["shadow_mode"] is True
        snapshot = result.risk_result.assessment.feature_snapshot
        assert snapshot.features["engine_decision"] == "reject"
    finally:
        db.close()


class _Resp:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


def test_ipqs_unsuccessful_payload_is_unavailable(monkeypatch):
    monkeypatch.setattr(ni.httpx, "get", lambda *a, **k: _Resp({"success": False, "message": "quota"}))
    provider = ni.IPQualityScoreProvider(api_key="k")
    assert provider.lookup("41.1.1.1").available is False


def test_ipqs_failure_is_negative_cached(monkeypatch):
    calls = {"n": 0}

    def failing(*a, **k):
        calls["n"] += 1
        raise httpx.ConnectTimeout("timeout")

    monkeypatch.setattr(ni.httpx, "get", failing)
    provider = ni.IPQualityScoreProvider(api_key="k")
    assert provider.lookup("41.1.1.2").available is False
    assert provider.lookup("41.1.1.2").available is False
    assert calls["n"] == 1
