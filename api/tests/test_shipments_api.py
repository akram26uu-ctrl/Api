from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.address_identifier import AddressIdentifier
from app.models.audit_log import AuditLog
from app.models.carrier_account import CarrierAccount
from app.models.carrier_warehouse import CarrierWarehouse
from app.models.enums import MerchantStatus, OrderStatus, RiskDecision, RiskEventType
from app.models.merchant import Merchant
from app.models.phone_identifier import PhoneIdentifier
from app.models.order import Order
from app.models.risk_assessment import RiskAssessment
from app.models.risk_event import RiskEvent
from app.models.shipment import Shipment, ShipmentEvent
from app.models.store import Store
from app.services.api_key_service import ApiKeyService

client = TestClient(app)
API = "/api/v1/shipping"


def _world(environment="test", scopes=("shipping:read", "shipping:write")):
    with SessionLocal() as db:
        merchant = Merchant(name="Ship", email=f"ship-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE,
                            is_shadow_mode_enabled=False)
        db.add(merchant)
        db.flush()
        store = Store(merchant_id=merchant.id, name="S", slug=f"s-{uuid4().hex[:8]}")
        db.add(store)
        db.flush()
        key, raw = ApiKeyService(db).create_key(merchant=merchant, name="k", environment=environment, scopes=list(scopes))
        key.store_id = None
        account = CarrierAccount(merchant_id=merchant.id, store_id=store.id, environment=environment,
                                 carrier_code="sandbox", display_name="sb", status="active",
                                 created_at=datetime.now(timezone.utc) - timedelta(hours=1))
        db.add(account)
        db.flush()
        warehouse = CarrierWarehouse(carrier_account_id=account.id, external_id="ORN", name="ORN")
        db.add(warehouse)
        db.commit()
        return {"merchant": merchant.id, "store": store.id, "account": account.id, "warehouse": warehouse.id,
                "env": environment, "h": {"Authorization": f"Bearer {raw}"}}


def _order(w, decision=RiskDecision.ALLOW, events=(), wilaya="Alger", env=None):
    with SessionLocal() as db:
        address = AddressIdentifier(normalized_address=f"a-{uuid4()}", wilaya=wilaya, commune="c",
                                    address_hash=uuid4().hex + uuid4().hex)
        phone = PhoneIdentifier(phone=f"05{uuid4().int % 10**8:08d}")
        db.add_all([address, phone])
        db.flush()
        order = Order(merchant_id=w["merchant"], store_id=w["store"], external_order_id=f"o-{uuid4()}",
                      status=OrderStatus.PENDING, total_amount=Decimal("100"), currency="DZD", first_name="Ali",
                      last_name="Ben", environment=env or w["env"], data_origin="real",
                      address_identifier_id=address.id, phone_identifier_id=phone.id)
        db.add(order)
        db.flush()
        assessment = RiskAssessment(order_id=order.id, score=70, decision=decision, model_version="m",
                                    rules_version="r")
        db.add(assessment)
        db.flush()
        for etype, impact in events:
            db.add(RiskEvent(risk_assessment_id=assessment.id, event_type=etype, score_impact=impact))
        db.commit()
        return order.id


def _shipment(w, order_id=None, status="pending_dispatch", hold=None, fulfillment="carrier", account=True, env=None,
              merchant=None, **extra):
    order_id = order_id or _order(w)
    with SessionLocal() as db:
        sid = uuid4()
        db.add(Shipment(id=sid, merchant_id=merchant or w["merchant"], store_id=w["store"], order_id=order_id,
                        environment=env or w["env"], status=status, hold_reason=hold, idempotency_key=str(sid),
                        carrier_account_id=w["account"] if account else None, fulfillment=fulfillment,
                        cod_amount=Decimal("100"), **{"allocations": [], "meta": {}, **extra}))
        db.commit()
        return sid


def test_counts_match_status_groups():
    w = _world()
    for status, hold in [("pending_dispatch", None), ("accepted", None), ("picked_up", None), ("in_transit", None),
                         ("out_for_delivery", None), ("delivery_attempt_failed", None), ("delivered", None),
                         ("returning", None), ("returned", None), ("dispatch_failed", None),
                         ("pending_dispatch", "review"), ("cancelled", None)]:
        _shipment(w, status=status, hold=hold)
    r = client.get(f"{API}/shipments", headers=w["h"])
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["counts"] == {"all": 10, "ready": 2, "transit": 2, "out": 2, "done": 1, "ret": 2, "fail": 1}
    assert body["pagination"] == {"total": 10, "page": 1, "limit": 20, "total_pages": 1}
    assert len(body["data"]) == 10
    ready = client.get(f"{API}/shipments?status=ready", headers=w["h"]).json()
    assert {s["status"] for s in ready["data"]} == {"pending_dispatch", "accepted"}
    assert all(s["hold_reason"] is None for s in ready["data"])
    assert ready["pagination"]["total"] == 2 and ready["counts"]["all"] == 10
    exact = client.get(f"{API}/shipments?status=delivered", headers=w["h"]).json()
    assert exact["pagination"]["total"] == 1


def test_shipments_isolated_by_env_store_merchant():
    w = _world()
    mine = _shipment(w, status="accepted")
    other = _world()
    theirs = _shipment(other, status="accepted")
    live = _world(environment="live")
    _shipment(live, status="accepted")
    ids = {s["id"] for s in client.get(f"{API}/shipments", headers=w["h"]).json()["data"]}
    assert ids == {str(mine)}
    assert client.get(f"{API}/shipments/{theirs}", headers=w["h"]).status_code == 404
    assert client.post(f"{API}/shipments/{theirs}/cancel", headers=w["h"]).status_code == 404
    # store scoping: a different store of the same merchant is not visible when selected
    with SessionLocal() as db:
        s2 = Store(merchant_id=w["merchant"], name="S2", slug=f"s-{uuid4().hex[:8]}")
        db.add(s2)
        db.commit()
        s2id = s2.id
    assert client.get(f"{API}/shipments?store_id={s2id}", headers=w["h"]).json()["data"] == []
    assert len(client.get(f"{API}/shipments?store_id={w['store']}", headers=w["h"]).json()["data"]) == 1
    # a test key never sees the live env's rows even with the same merchant
    with SessionLocal() as db:
        db.add(Shipment(merchant_id=w["merchant"], store_id=w["store"], order_id=_order(w, env="live"),
                        environment="live", status="accepted", idempotency_key="x", cod_amount=1,
                        allocations=[], meta={}))
        db.commit()
    assert len(client.get(f"{API}/shipments", headers=w["h"]).json()["data"]) == 1


def test_scopes_enforced():
    w = _world(scopes=("shipping:read",))
    assert client.get(f"{API}/shipments", headers=w["h"]).status_code == 200
    sid = _shipment(w, status="accepted")
    assert client.post(f"{API}/shipments/{sid}/cancel", headers=w["h"]).status_code == 403


def test_detail_has_events_order_and_allocations():
    w = _world()
    sid = _shipment(w, status="in_transit", allocations=[{"product_id": str(uuid4()), "warehouse_id": None, "quantity": 2}])
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        for i, st in enumerate(("accepted", "picked_up", "in_transit")):
            db.add(ShipmentEvent(shipment_id=sid, status=st, occurred_at=now + timedelta(minutes=i),
                                 source="webhook", dedupe_key=f"{sid}:{st}"))
        db.commit()
    d = client.get(f"{API}/shipments/{sid}", headers=w["h"]).json()
    assert [e["status"] for e in d["events"]] == ["in_transit", "picked_up", "accepted"]
    assert d["order"]["customer_name"] == "Ali Ben" and d["order"]["wilaya"] == "Alger"
    assert d["allocations"][0]["quantity"] == 2


def test_manual_dispatch_refused_for_review_hold():
    w = _world()
    # review decision, no shipment yet: refused and nothing is created
    review_order = _order(w, decision=RiskDecision.REVIEW)
    r = client.post(f"{API}/shipments", json={"order_id": str(review_order)}, headers=w["h"])
    assert r.status_code == 409 and r.json()["detail"] == "order_needs_decision"
    # existing shipments held for review / rejected: refused and never dispatched
    for hold in ("review", "rejected"):
        oid = _order(w, decision=RiskDecision.REVIEW if hold == "review" else RiskDecision.REJECT)
        sid = _shipment(w, order_id=oid, hold=hold)
        r = client.post(f"{API}/shipments", json={"order_id": str(oid)}, headers=w["h"])
        assert r.status_code == 409 and r.json()["detail"] == "order_needs_decision"
        with SessionLocal() as db:
            s = db.get(Shipment, sid)
            assert s.status == "pending_dispatch" and s.tracking_number is None
    with SessionLocal() as db:
        assert db.query(Shipment).filter(Shipment.order_id == review_order).count() == 0
    # other holds report the hold reason
    oid = _order(w)
    _shipment(w, order_id=oid, hold="out_of_stock")
    r = client.post(f"{API}/shipments", json={"order_id": str(oid)}, headers=w["h"])
    assert r.status_code == 409 and r.json()["detail"] == "out_of_stock"


def test_manual_dispatch_creates_and_dispatches_allowed_order():
    w = _world()
    oid = _order(w)
    r = client.post(f"{API}/shipments", json={"order_id": str(oid)}, headers=w["h"])
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["outcome"] == "dispatched"
    assert body["shipment"]["status"] == "accepted" and body["shipment"]["tracking_number"]
    # idempotent: second call reuses the active shipment
    again = client.post(f"{API}/shipments", json={"order_id": str(oid)}, headers=w["h"])
    assert again.status_code == 200 and again.json()["shipment"]["id"] == body["shipment"]["id"]
    assert client.post(f"{API}/shipments", json={"order_id": str(uuid4())}, headers=w["h"]).status_code == 404


def test_retry_failed_creates_new_shipment_and_cancel():
    w = _world()
    oid = _order(w)
    old = _shipment(w, order_id=oid, status="dispatch_failed")
    r = client.post(f"{API}/shipments/{old}/retry", headers=w["h"])
    assert r.status_code == 200, r.text
    new = r.json()
    assert new["shipment"]["id"] != str(old) and new["shipment"]["status"] == "accepted"
    with SessionLocal() as db:
        assert db.get(Shipment, old).status == "dispatch_failed"
    assert client.post(f"{API}/shipments/{old}/retry", headers=w["h"]).status_code == 409  # active one exists
    assert client.post(f"{API}/shipments/{new['shipment']['id']}/retry", headers=w["h"]).status_code == 409
    c = client.post(f"{API}/shipments/{new['shipment']['id']}/cancel", headers=w["h"])
    assert c.status_code == 200 and c.json()["status"] == "cancelled"
    with SessionLocal() as db:
        assert db.query(AuditLog).filter(AuditLog.action == "shipment.cancel", AuditLog.merchant_id == w["merchant"]).count() == 1
    assert client.post(f"{API}/shipments/{new['shipment']['id']}/cancel", headers=w["h"]).status_code == 409


def test_retry_refused_when_order_needs_decision():
    w = _world()
    oid = _order(w, decision=RiskDecision.REVIEW)
    old = _shipment(w, order_id=oid, status="dispatch_failed")
    r = client.post(f"{API}/shipments/{old}/retry", headers=w["h"])
    assert r.status_code == 409 and r.json()["detail"] == "order_needs_decision"


def test_next_pickups_counts_by_fulfillment():
    w = _world()
    _shipment(w, status="accepted")
    _shipment(w, status="accepted")
    _shipment(w, status="accepted", fulfillment="merchant")
    _shipment(w, status="picked_up")
    r = client.get(f"{API}/next-pickups", headers=w["h"]).json()
    assert len(r["data"]) == 1
    row = r["data"][0]
    assert row["carrier_account_id"] == str(w["account"]) and row["carrier_code"] == "sandbox"
    assert row["pickup_time"] == "14:00" and row["warehouse_parcels"] == 2 and row["merchant_parcels"] == 1


def test_pending_lists_by_reason_with_risk_reasons():
    w = _world()
    ev = [(RiskEventType.VPN_DETECTED, 10), (RiskEventType.PHONE_REUSED, 30), (RiskEventType.NEW_DEVICE, 5),
          (RiskEventType.HIGH_CANCEL_RATE, 20)]
    review = _shipment(w, order_id=_order(w, RiskDecision.REVIEW, ev), hold="review")
    mixed = _shipment(w, hold="mixed_source")
    stock = _shipment(w, hold="out_of_stock")
    rejected = _shipment(w, order_id=_order(w, RiskDecision.REJECT), hold="rejected")
    _shipment(w, hold="awaiting_confirmation")
    _shipment(w, status="accepted")
    body = client.get(f"{API}/pending", headers=w["h"]).json()
    assert body["counts"] == {"review": 2, "stock": 1, "rejected": 1}
    assert len(body["data"]) == 4
    rv = client.get(f"{API}/pending?reason=review", headers=w["h"]).json()
    assert {i["shipment_id"] for i in rv["data"]} == {str(review), str(mixed)}
    item = next(i for i in rv["data"] if i["shipment_id"] == str(review))
    assert item["hold_reason"] == "review" and item["risk_decision"] == "review" and item["risk_score"] == 70
    assert item["reasons"] == ["phone_reused", "high_cancel_rate", "vpn_detected"]
    assert item["customer_name"] == "Ali Ben" and item["wilaya"] == "Alger"
    assert item["cod_amount"] is not None and item["currency"] == "DZD" and item["external_order_id"]
    st = client.get(f"{API}/pending?reason=stock", headers=w["h"]).json()
    assert [i["shipment_id"] for i in st["data"]] == [str(stock)] and "available_warehouses" in st["data"][0]
    rj = client.get(f"{API}/pending?reason=rejected", headers=w["h"]).json()
    assert [i["shipment_id"] for i in rj["data"]] == [str(rejected)]
    assert rv["pagination"]["total"] == 2 and rv["counts"] == body["counts"]


def test_approve_makes_due_and_reject_cancels():
    w = _world()
    review = _shipment(w, order_id=_order(w, RiskDecision.REVIEW), hold="review")
    r = client.post(f"{API}/pending/{review}/approve", headers=w["h"])
    assert r.status_code == 200, r.text
    assert r.json()["hold_reason"] is None and r.json()["next_attempt_at"] is not None
    assert client.post(f"{API}/pending/{review}/approve", headers=w["h"]).status_code == 409
    oid = _order(w, RiskDecision.REVIEW)
    rej = _shipment(w, order_id=oid, hold="review")
    r = client.post(f"{API}/pending/{rej}/reject", headers=w["h"])
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    # rejected hold: restore reopens it, archive cancels without outcome
    rejected = _shipment(w, order_id=_order(w, RiskDecision.REJECT), hold="rejected")
    assert client.post(f"{API}/pending/{rejected}/restore", headers=w["h"]).json()["hold_reason"] is None
    arch = _shipment(w, order_id=_order(w, RiskDecision.REJECT), hold="rejected")
    a = client.post(f"{API}/pending/{arch}/archive", headers=w["h"])
    assert a.status_code == 200 and a.json()["status"] == "cancelled"
    assert client.post(f"{API}/pending/{uuid4()}/approve", headers=w["h"]).status_code == 404


def test_dispatch_from_refuses_risk_hold_and_validates_warehouse():
    w = _world()
    held = _shipment(w, order_id=_order(w, RiskDecision.REVIEW), hold="review")
    r = client.post(f"{API}/pending/{held}/dispatch-from", json={"warehouse_id": str(w["warehouse"])}, headers=w["h"])
    assert r.status_code == 409
    with SessionLocal() as db:
        assert db.get(Shipment, held).hold_reason == "review"
    stock = _shipment(w, hold="out_of_stock")
    r = client.post(f"{API}/pending/{stock}/dispatch-from", json={"warehouse_id": "nope"}, headers=w["h"])
    assert r.status_code == 422
