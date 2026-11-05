import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.services.carriers import registry, sandbox
from app.services.carriers.base import (
    STATUS_RANK,
    CarrierAuthError,
    CarrierUnavailable,
    CarrierValidationError,
    Recipient,
    ShipmentLine,
    ShipmentRequest,
)
from app.services.carriers.registry import CarrierNotAvailable
from app.services.carriers.sandbox import SandboxCarrier

CREDS = {"api_id": "x", "api_token": "test_ok"}
T0 = datetime(2026, 1, 1, 8, 0, tzinfo=timezone.utc)


def _req(key="k1", address="1 rue Didouche"):
    return ShipmentRequest(
        idempotency_key=key,
        recipient=Recipient("A", "B", "0550000000", "31", "Oran", address),
        delivery_type="home",
        stop_desk_id=None,
        cod_amount=Decimal("4500"),
        lines=[ShipmentLine("SNK-BLK-41", "Sneaker", 1)],
        warehouse_external_id="ORN",
    )


@pytest.fixture
def clock(monkeypatch):
    state = {"now": T0}
    monkeypatch.setattr(sandbox, "SANDBOX_CLOCK", lambda: state["now"])
    monkeypatch.setattr(sandbox, "_STATE", {})
    return state


def test_sandbox_rejects_non_test_credentials():
    with pytest.raises(CarrierAuthError):
        SandboxCarrier({"api_id": "x", "api_token": "live_1"}).validate_credentials()
    SandboxCarrier(CREDS).validate_credentials()


def test_sandbox_lists_two_warehouses():
    got = {w.external_id: w.wilaya_code for w in SandboxCarrier(CREDS).list_warehouses()}
    assert got == {"ORN": "31", "ALG": "16"}


def test_sandbox_stock_has_skus():
    rows = SandboxCarrier(CREDS).list_stock()
    skus = {r.sku for r in rows}
    assert {"SNK-BLK-41", "SNK-BLK-42", "WAT-SLV-02"} <= skus
    assert all(r.on_hand >= 0 for r in rows)


def test_sandbox_create_is_idempotent(clock):
    c = SandboxCarrier(CREDS)
    a = c.create_shipment(_req())
    b = c.create_shipment(_req())
    assert a.tracking_number == b.tracking_number
    assert a.tracking_number.startswith("SBX-")
    assert c.create_shipment(_req("k2")).tracking_number != a.tracking_number


def test_sandbox_address_fail_raises_validation(clock):
    c = SandboxCarrier(CREDS)
    with pytest.raises(CarrierValidationError):
        c.create_shipment(_req(address="FAIL street"))
    with pytest.raises(CarrierUnavailable):
        c.create_shipment(_req(address="DOWN street"))


def _statuses(c, tracking):
    return [e.status for e in c.get_tracking(tracking)]


def test_sandbox_progresses_with_clock(clock):
    c = SandboxCarrier(CREDS)
    tn = c.create_shipment(_req()).tracking_number
    assert _statuses(c, tn) == ["accepted"]
    clock["now"] = T0 + timedelta(hours=2)
    assert "picked_up" in _statuses(c, tn)
    clock["now"] = T0 + timedelta(hours=26)
    assert "in_transit" in _statuses(c, tn)
    clock["now"] = T0 + timedelta(hours=50)
    sts = _statuses(c, tn)
    assert sts[-1] == "delivered"
    ranks = [STATUS_RANK[s] for s in sts]
    assert ranks == sorted(ranks)


def test_sandbox_return_path(clock):
    c = SandboxCarrier(CREDS)
    tn = c.create_shipment(_req("r", address="RETURN road")).tracking_number
    clock["now"] = T0 + timedelta(hours=50)
    events = c.get_tracking(tn)
    sts = [e.status for e in events]
    assert sts[-1] == "returned"
    assert "delivery_attempt_failed" in sts and "returning" in sts
    assert "delivered" not in sts
    assert [STATUS_RANK[s] for s in sts] == sorted(STATUS_RANK[s] for s in sts)
    assert events[-1].dedupe_key == f"{tn}:returned"


def test_status_rank_ordering():
    r = STATUS_RANK
    assert r["returning"] > r["delivery_attempt_failed"] > r["out_for_delivery"]
    assert min(r["delivered"], r["returned"], r["cancelled"]) > r["returning"]


def test_registry_refuses_sandbox_in_live():
    with pytest.raises(CarrierNotAvailable):
        registry.get_adapter("sandbox", CREDS, "live")
    assert registry.available_carriers("live") == []
    assert registry.available_carriers("test")[0]["code"] == "sandbox"
    assert isinstance(registry.get_adapter("sandbox", CREDS, "test"), SandboxCarrier)
    with pytest.raises(CarrierNotAvailable):
        registry.get_adapter("nope", CREDS, "test")


def test_sandbox_webhook_signature():
    c = SandboxCarrier(CREDS)
    body = json.dumps(
        {"events": [{"tracking": "SBX-1", "status": "delivered",
                     "occurred_at": "2026-01-03T08:00:00+00:00"}]}
    ).encode()
    sig = hmac.new(b"test_ok", body, hashlib.sha256).hexdigest()
    out = c.parse_webhook({"X-Sandbox-Signature": sig}, body)
    assert out[0][0] == "SBX-1" and out[0][1].status == "delivered"
    with pytest.raises(CarrierAuthError):
        c.parse_webhook({"X-Sandbox-Signature": "bad"}, body)


def test_sandbox_cancel_stops_timeline(clock):
    c = SandboxCarrier(CREDS)
    tn = c.create_shipment(_req()).tracking_number
    clock["now"] = T0 + timedelta(hours=3)
    c.cancel_shipment(tn)
    clock["now"] = T0 + timedelta(hours=60)
    events = c.get_tracking(tn)
    assert [e.status for e in events] == ["accepted", "picked_up", "cancelled"]
    assert events[-1].occurred_at == T0 + timedelta(hours=3)


def _signed(c, payload):
    body = json.dumps(payload).encode()
    sig = hmac.new(b"test_ok", body, hashlib.sha256).hexdigest()
    return {"X-Sandbox-Signature": sig}, body


def test_sandbox_webhook_rejects_unknown_status():
    c = SandboxCarrier(CREDS)
    headers, body = _signed(c, {"events": [{"tracking": "SBX-1", "status": "bogus",
                                            "occurred_at": "2026-01-03T08:00:00+00:00"}]})
    with pytest.raises(CarrierValidationError):
        c.parse_webhook(headers, body)


def test_sandbox_webhook_naive_datetime_is_utc():
    c = SandboxCarrier(CREDS)
    headers, body = _signed(c, {"events": [{"tracking": "SBX-1", "status": "delivered",
                                            "occurred_at": "2026-01-03T08:00:00"}]})
    assert c.parse_webhook(headers, body)[0][1].occurred_at.tzinfo == timezone.utc


def test_sandbox_webhook_non_ascii_signature_is_auth_error():
    with pytest.raises(CarrierAuthError):
        SandboxCarrier(CREDS).parse_webhook({"X-Sandbox-Signature": "é"}, b"{}")
