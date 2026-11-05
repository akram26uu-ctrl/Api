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
BODY = {"carrier_code": "sandbox", "display_name": "My sandbox", "credentials": {"api_token": "test_abc"}}


def _setup(environment="test", scopes=("shipping:read", "shipping:write"), unbound=False):
    with SessionLocal() as db:
        merchant = Merchant(name="Ship", email=f"ship-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE,
                            is_shadow_mode_enabled=False)
        db.add(merchant)
        db.flush()
        store = Store(merchant_id=merchant.id, name="S", slug=f"s-{uuid4().hex[:8]}")
        db.add(store)
        db.flush()
        key, raw = ApiKeyService(db).create_key(merchant=merchant, name="k", environment=environment, scopes=list(scopes))
        if unbound:
            key.store_id = None
        db.commit()
        return merchant.id, str(store.id), {"Authorization": f"Bearer {raw}"}


def _link(headers, store_id, body=BODY):
    return client.post(f"/api/v1/shipping/carriers?store_id={store_id}", json=body, headers=headers)


def test_link_sandbox_in_test_env():
    _, store_id, h = _setup()
    r = _link(h, store_id)
    assert r.status_code == 201, r.text
    data = r.json()
    assert "credentials" not in data and "credentials_encrypted" not in data
    assert data["carrier_code"] == "sandbox"
    w = client.get(f"/api/v1/shipping/carriers/{data['id']}/warehouses", headers=h)
    assert w.status_code == 200 and len(w.json()) == 2
    listing = client.get("/api/v1/shipping/carriers", headers=h).json()
    assert len(listing["accounts"]) == 1
    assert listing["available"][0]["code"] == "sandbox"
    assert "credentials" not in str(listing["accounts"])


def test_link_sandbox_in_live_refused():
    _, store_id, h = _setup(environment="live")
    r = _link(h, store_id)
    assert r.status_code == 409 and r.json()["detail"] == "carrier_not_available"


def test_bad_credentials_422():
    _, store_id, h = _setup()
    r = _link(h, store_id, {**BODY, "credentials": {"api_token": "nope"}})
    assert r.status_code == 422 and r.json()["detail"] == "carrier_auth_failed"


def test_store_required_422():
    _, _, h = _setup(unbound=True)
    r = client.post("/api/v1/shipping/carriers", json=BODY, headers=h)
    assert r.status_code == 422 and r.json()["detail"] == "store_id_required"


def test_other_merchant_cannot_see_account():
    _, store_id, h = _setup()
    account_id = _link(h, store_id).json()["id"]
    _, _, other = _setup()
    assert client.get("/api/v1/shipping/carriers", headers=other).json()["accounts"] == []
    assert client.post(f"/api/v1/shipping/carriers/{account_id}/test", headers=other).status_code == 404
    assert client.get(f"/api/v1/shipping/carriers/{account_id}/warehouses", headers=other).status_code == 404
    assert client.delete(f"/api/v1/shipping/carriers/{account_id}", headers=other).status_code == 404


def test_scope_required():
    _, _, h = _setup(scopes=("orders:read",))
    assert client.get("/api/v1/shipping/carriers", headers=h).status_code == 403


def test_test_disable_delete():
    _, store_id, h = _setup()
    account_id = _link(h, store_id).json()["id"]
    assert client.post(f"/api/v1/shipping/carriers/{account_id}/test", headers=h).status_code == 200
    d = client.post(f"/api/v1/shipping/carriers/{account_id}/disable", headers=h)
    assert d.status_code == 200 and d.json()["status"] == "disabled"
    assert client.delete(f"/api/v1/shipping/carriers/{account_id}", headers=h).status_code == 204
    assert client.get("/api/v1/shipping/carriers", headers=h).json()["accounts"] == []


def test_audit_logged_on_link():
    merchant_id, store_id, h = _setup()
    account_id = _link(h, store_id).json()["id"]
    with SessionLocal() as db:
        row = db.query(AuditLog).filter(AuditLog.merchant_id == merchant_id, AuditLog.action == "carrier_account.linked").first()
        assert row is not None and str(row.resource_id) == account_id


def test_test_keeps_disabled_status():
    _, store_id, h = _setup()
    account_id = _link(h, store_id).json()["id"]
    client.post(f"/api/v1/shipping/carriers/{account_id}/disable", headers=h)
    r = client.post(f"/api/v1/shipping/carriers/{account_id}/test", headers=h)
    assert r.status_code == 200 and r.json()["status"] == "disabled"


def test_duplicate_link_409_and_relink_after_disable():
    _, store_id, h = _setup()
    first = _link(h, store_id).json()["id"]
    dup = _link(h, store_id)
    assert dup.status_code == 409 and dup.json()["detail"] == "carrier_already_linked"
    client.post(f"/api/v1/shipping/carriers/{first}/disable", headers=h)
    again = _link(h, store_id, {**BODY, "display_name": "Renamed"})
    assert again.status_code == 201
    assert again.json()["id"] == first and again.json()["status"] == "active"
    assert again.json()["display_name"] == "Renamed"
    assert len(client.get("/api/v1/shipping/carriers", headers=h).json()["accounts"]) == 1


def test_delete_refused_when_shipment_exists():
    from app.models.order import Order
    from app.models.enums import OrderStatus
    from app.models.shipment import Shipment
    merchant_id, store_id, h = _setup()
    account_id = _link(h, store_id).json()["id"]
    with SessionLocal() as db:
        order = Order(merchant_id=merchant_id, external_order_id=f"o-{uuid4()}", status=OrderStatus.PENDING,
                      total_amount=100, currency="DZD", first_name="A", last_name="B",
                      environment="test", data_origin="real")
        db.add(order)
        db.flush()
        db.add(Shipment(merchant_id=merchant_id, order_id=order.id, environment="test",
                        carrier_account_id=UUID(account_id), idempotency_key=str(uuid4())))
        db.commit()
    r = client.delete(f"/api/v1/shipping/carriers/{account_id}", headers=h)
    assert r.status_code == 409 and r.json()["detail"] == "carrier_in_use"
