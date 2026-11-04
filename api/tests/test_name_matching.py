"""Same buyer, different spelling of the name, on the same phone."""
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.name_matching import names_match
from app.db.database import SessionLocal
from app.main import app
from app.models.enums import MerchantStatus, RiskEventType
from app.models.merchant import Merchant
from app.models.order import Order
from app.services.api_key_service import ApiKeyService

client = TestClient(app)


@pytest.mark.parametrize("a,b", [
    ("أمينة بن علي", "Amina Benali"),
    ("Amina Benali", "BENALI Amina"),
    ("amina ben ali", "Amina Benali"),
    ("Mohamed Benali", "محمد بن علي"),
    ("Mohamed Benali", "Mohammed Ben Ali"),
    ("Abdelkader Saidi", "عبد القادر سعيدي"),
    ("Abd el Kader Saidi", "Abdelkader Saidi"),
    ("Fatima Zohra Mansouri", "فاطمة الزهراء منصوري"),
    ("Djamel Khelifi", "جمال خليفي"),
    ("Nour El Houda", "نور الهدى"),
    ("Amina", "Amina Benali"),
])
def test_same_person(a, b):
    assert names_match(a, b)


@pytest.mark.parametrize("a,b", [
    ("Mohamed Benali", "Ahmed Benali"),
    ("Amina Benali", "Karim Benali"),
    ("Sara Haddad", "Samir Haddad"),
    ("Yacine Amrani", "Nassim Amrani"),
    ("Ali Benali", "Ali Mansouri"),
    ("Ali", "Ali Benali Karim"),
    ("", "Amina"),
])
def test_different_people(a, b):
    assert not names_match(a, b)


def _key(db):
    merchant = Merchant(name="Names", email=f"names-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
    db.add(merchant)
    db.flush()
    _, raw = ApiKeyService(db).create_key(merchant=merchant, name="names", environment="live")
    db.commit()
    return {"Authorization": f"Bearer {raw}"}


def _post(headers, first, last, phone):
    body = {
        "external_order_id": f"n-{uuid4()}", "first_name": first, "last_name": last, "phone": phone,
        "wilaya": "Oran", "commune": "Bir El Djir", "address": "12 Rue Test", "total_amount": "4500.00", "currency": "DZD",
    }
    response = client.post("/api/v1/orders", json=body, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_rewritten_name_on_same_phone_is_one_customer():
    db = SessionLocal()
    try:
        headers = _key(db)
        phone = f"0661{uuid4().int % 10**6:06d}"
        first = _post(headers, "Amina", "Benali", phone)
        second = _post(headers, "أمينة", "بن علي", phone)

        events = {e["event_type"] for e in second["risk"]["events"]}
        assert RiskEventType.MULTIPLE_CUSTOMERS_SAME_PHONE.value not in events
        assert "similar_name" in second["risk"]["explanation"]["identity_match_reasons"]
        a, b = db.get(Order, UUID(first["order_id"])), db.get(Order, UUID(second["order_id"]))
        assert a.customer_id == b.customer_id
    finally:
        db.close()


def test_different_person_on_same_phone_still_flagged():
    db = SessionLocal()
    try:
        headers = _key(db)
        phone = f"0662{uuid4().int % 10**6:06d}"
        _post(headers, "Amina", "Benali", phone)
        second = _post(headers, "Karim", "Saidi", phone)

        events = {e["event_type"] for e in second["risk"]["events"]}
        assert RiskEventType.MULTIPLE_CUSTOMERS_SAME_PHONE.value in events
    finally:
        db.close()
