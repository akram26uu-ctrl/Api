from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.audit_log import AuditLog
from app.models.enums import MerchantStatus
from app.models.merchant import Merchant
from app.models.store import Store
from app.services.api_key_service import ApiKeyService

client = TestClient(app)
DEFAULTS = {
    "auto_dispatch": True, "dispatch_trigger": "after_confirmation", "hold_minutes": 15, "retry_max": 5,
    "retry_interval_minutes": 10, "fallback_enabled": True, "out_of_stock_policy": "hold", "low_stock_days": 5,
    "reserve_on_accept": True, "disable_product_when_out": False, "confirmation_timeout_hours": 24,
    "label_size": "a6", "notify_on_hold": True, "notify_on_failure": True, "notify_on_low_stock": True,
}


def _setup(environment="test", unbound=False):
    with SessionLocal() as db:
        merchant = Merchant(name="Ship", email=f"ship-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE,
                            is_shadow_mode_enabled=False)
        db.add(merchant)
        db.flush()
        store = Store(merchant_id=merchant.id, name="S", slug=f"s-{uuid4().hex[:8]}")
        db.add(store)
        db.flush()
        key, raw = ApiKeyService(db).create_key(merchant=merchant, name="k", environment=environment,
                                                scopes=["shipping:read", "shipping:write"])
        if unbound:
            key.store_id = None
        db.commit()
        return merchant.id, str(store.id), {"Authorization": f"Bearer {raw}"}


def _carrier(h, store_id, name="c"):
    r = client.post(f"/api/v1/shipping/carriers?store_id={store_id}", headers=h,
                    json={"carrier_code": "sandbox", "display_name": name, "credentials": {"api_token": "test_abc"}})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_defaults_returned_when_none_saved():
    _, sid, h = _setup()
    r = client.get(f"/api/v1/shipping/settings?store_id={sid}", headers=h)
    assert r.status_code == 200, r.text
    data = r.json()
    for key, value in DEFAULTS.items():
        assert data[key] == value, key


def test_settings_require_store():
    _, _, h = _setup(unbound=True)
    r = client.get("/api/v1/shipping/settings", headers=h)
    assert r.status_code == 422 and r.json()["detail"] == "store_id_required"
    r = client.put("/api/v1/shipping/settings", json={"hold_minutes": 5}, headers=h)
    assert r.status_code == 422 and r.json()["detail"] == "store_id_required"
    assert client.get("/api/v1/shipping/routes", headers=h).json()["detail"] == "store_id_required"


def test_get_or_default_survives_insert_race(monkeypatch):
    from app.models.shipping_settings import ShippingSettings
    from app.services.shipping_settings_service import ShippingSettingsService
    mid, sid, _ = _setup()
    with SessionLocal() as winner:
        winner.add(ShippingSettings(merchant_id=mid, store_id=UUID(sid)))
        winner.commit()
    with SessionLocal() as db:
        real = ShippingSettingsService._find
        calls = {"n": 0}

        def stale(self, store_id):
            calls["n"] += 1
            return None if calls["n"] == 1 else real(self, store_id)

        monkeypatch.setattr(ShippingSettingsService, "_find", stale)
        settings = ShippingSettingsService(db).get_or_default(UUID(sid))
        assert settings.store_id == UUID(sid) and calls["n"] == 2
        db.commit()
        assert db.query(ShippingSettings).filter(ShippingSettings.store_id == UUID(sid)).count() == 1


def test_routes_listed_only_for_key_environment():
    from app.models.carrier_account import CarrierAccount
    from app.models.shipping_settings import ShippingRoute
    mid, sid, h_test = _setup()
    a = _carrier(h_test, sid)
    assert client.post(f"/api/v1/shipping/routes?store_id={sid}", headers=h_test,
                       json={"wilaya_codes": ["16"], "carrier_account_id": a}).status_code == 201
    with SessionLocal() as db:
        from app.models.merchant import Merchant
        merchant = db.get(Merchant, mid)
        _, raw = ApiKeyService(db).create_key(merchant=merchant, name="live", environment="live",
                                              scopes=["shipping:read", "shipping:write"])
        live = CarrierAccount(merchant_id=mid, store_id=UUID(sid), environment="live", carrier_code="x",
                              display_name="L", status="active")
        db.add(live)
        db.flush()
        db.add(ShippingRoute(merchant_id=mid, store_id=UUID(sid), wilaya_codes=["31"], carrier_account_id=live.id))
        db.commit()
    h_live = {"Authorization": f"Bearer {raw}"}
    url = f"/api/v1/shipping/routes?store_id={sid}"
    assert [r["wilaya_codes"] for r in client.get(url, headers=h_live).json()] == [["31"]]
    assert [r["wilaya_codes"] for r in client.get(url, headers=h_test).json()] == [["16"]]


def test_put_updates_and_rejects_invalid():
    _, sid, h = _setup()
    url = f"/api/v1/shipping/settings?store_id={sid}"
    r = client.put(url, json={"hold_minutes": 30, "label_size": "a4_4"}, headers=h)
    assert r.status_code == 200 and r.json()["hold_minutes"] == 30
    assert client.get(url, headers=h).json()["label_size"] == "a4_4"
    for bad in ({"hold_minutes": 1441}, {"retry_max": 21}, {"retry_interval_minutes": 0},
                {"confirmation_timeout_hours": 169}, {"low_stock_days": 61}, {"label_size": "a5"}):
        assert client.put(url, json=bad, headers=h).status_code == 422, bad


def test_put_rejects_unknown_policy():
    _, sid, h = _setup()
    r = client.put(f"/api/v1/shipping/settings?store_id={sid}", json={"out_of_stock_policy": "burn"}, headers=h)
    assert r.status_code == 422
    r = client.put(f"/api/v1/shipping/settings?store_id={sid}", json={"dispatch_trigger": "never"}, headers=h)
    assert r.status_code == 422


def test_route_resolution_specific_then_default():
    from app.services.shipping_settings_service import ShippingSettingsService
    mid, sid, h = _setup()
    a = _carrier(h, sid, "A")
    # second account needs a different carrier code: reuse sandbox via direct insert
    from app.models.carrier_account import CarrierAccount
    with SessionLocal() as db:
        acc = CarrierAccount(merchant_id=mid, store_id=UUID(sid), environment="test", carrier_code="sandbox2",
                             display_name="B", status="active")
        db.add(acc)
        db.commit()
        b = str(acc.id)
    ra = client.post(f"/api/v1/shipping/routes?store_id={sid}", headers=h, json={"wilaya_codes": ["16"], "carrier_account_id": a})
    assert ra.status_code == 201, ra.text
    rb = client.post(f"/api/v1/shipping/routes?store_id={sid}", headers=h, json={"wilaya_codes": [], "carrier_account_id": b})
    assert rb.status_code == 201, rb.text
    assert len(client.get(f"/api/v1/shipping/routes?store_id={sid}", headers=h).json()) == 2
    with SessionLocal() as db:
        svc = ShippingSettingsService(db)
        p, f = svc.resolve_route(UUID(sid), "test", "16")
        assert str(p.id) == a and f is None
        p, _ = svc.resolve_route(UUID(sid), "test", "31")
        assert str(p.id) == b


def test_resolve_only_active_account_fallback():
    from app.services.shipping_settings_service import ShippingSettingsService
    _, sid, h = _setup()
    a = _carrier(h, sid)
    with SessionLocal() as db:
        p, _ = ShippingSettingsService(db).resolve_route(UUID(sid), "test", "31")
        assert str(p.id) == a
    client.post(f"/api/v1/shipping/carriers/{a}/disable?store_id={sid}", headers=h)
    with SessionLocal() as db:
        assert ShippingSettingsService(db).resolve_route(UUID(sid), "test", "31") == (None, None)


def test_route_validation():
    _, sid, h = _setup()
    a = _carrier(h, sid)
    url = f"/api/v1/shipping/routes?store_id={sid}"
    for codes in (["59"], ["00"], ["1"], ["ab"]):
        assert client.post(url, headers=h, json={"wilaya_codes": codes, "carrier_account_id": a}).status_code == 422, codes
    assert client.post(url, headers=h, json={"wilaya_codes": ["58", "01"], "carrier_account_id": a}).status_code == 201
    assert client.post(url, headers=h, json={"wilaya_codes": ["16"], "carrier_account_id": a,
                                             "fallback_carrier_account_id": a}).status_code == 422


def test_route_rejects_foreign_carrier():
    _, sid, h = _setup()
    _, sid2, h2 = _setup()
    foreign = _carrier(h2, sid2)
    r = client.post(f"/api/v1/shipping/routes?store_id={sid}", headers=h,
                    json={"wilaya_codes": ["16"], "carrier_account_id": foreign})
    assert r.status_code == 422


def test_route_update_delete():
    _, sid, h = _setup()
    a = _carrier(h, sid)
    rid = client.post(f"/api/v1/shipping/routes?store_id={sid}", headers=h,
                      json={"wilaya_codes": ["16"], "carrier_account_id": a}).json()["id"]
    r = client.put(f"/api/v1/shipping/routes/{rid}?store_id={sid}", headers=h,
                   json={"wilaya_codes": ["31"], "carrier_account_id": a, "priority": 5})
    assert r.status_code == 200 and r.json()["wilaya_codes"] == ["31"] and r.json()["priority"] == 5
    assert client.delete(f"/api/v1/shipping/routes/{rid}?store_id={sid}", headers=h).status_code == 204
    assert client.delete(f"/api/v1/shipping/routes/{rid}?store_id={sid}", headers=h).status_code == 404


def test_settings_audit_logged():
    mid, sid, h = _setup()
    client.put(f"/api/v1/shipping/settings?store_id={sid}", json={"hold_minutes": 20}, headers=h)
    a = _carrier(h, sid)
    client.post(f"/api/v1/shipping/routes?store_id={sid}", headers=h, json={"wilaya_codes": [], "carrier_account_id": a})
    with SessionLocal() as db:
        actions = {x.action for x in db.query(AuditLog).filter(AuditLog.merchant_id == mid)}
    assert {"shipping_settings.updated", "shipping_route.created"} <= actions


def test_route_update_delete_scoped_to_key_environment():
    from app.models.merchant import Merchant
    mid, sid, h_test = _setup()
    a = _carrier(h_test, sid)
    rid = client.post(f"/api/v1/shipping/routes?store_id={sid}", headers=h_test,
                      json={"wilaya_codes": ["16"], "carrier_account_id": a}).json()["id"]
    with SessionLocal() as db:
        _, raw = ApiKeyService(db).create_key(merchant=db.get(Merchant, mid), name="live", environment="live",
                                              scopes=["shipping:read", "shipping:write"])
        db.commit()
    h_live = {"Authorization": f"Bearer {raw}"}
    url = f"/api/v1/shipping/routes/{rid}?store_id={sid}"
    assert client.put(url, headers=h_live, json={"wilaya_codes": ["31"], "carrier_account_id": a}).status_code == 404
    assert client.delete(url, headers=h_live).status_code == 404
    assert client.delete(url, headers=h_test).status_code == 204
