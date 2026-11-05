"""First-order signals: junk identity, fake-looking phone, wilaya/commune mismatch."""
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.algeria_geo import commune_wilayas, location_mismatch, resolve_wilaya
from app.core.order_quality import identity_quality_issues, phone_issues
from app.core.risk_config import DEFAULT_RISK_PROFILE
from app.db.database import SessionLocal
from app.main import app
from app.models.enums import MerchantStatus, RiskEventType
from app.models.merchant import Merchant
from app.services.api_key_service import ApiKeyService

client = TestClient(app)
pytestmark = pytest.mark.first_order_checks


@pytest.mark.parametrize("first,last,address", [
    ("Amina", "Benali", "12 Rue Didouche Mourad"),
    ("محمد", "بن علي", "حي 500 مسكن عمارة 12"),
    ("Mhd", "Saidi", "Cite 20 aout bt 5"),
    ("Lynda", "Hadj", "Hai El Badr"),
    ("Yasmine", "Ould Ali", "Lot 45 n 3"),
    ("Ali", "Ali", "Lot 5"),
])
def test_real_identities_are_clean(first, last, address):
    assert identity_quality_issues(first, last, address) == []


@pytest.mark.parametrize("first,last,address,expected", [
    ("test", "test", "test", {"placeholder_name", "placeholder_address"}),
    ("dfghj", "qsdfg", "zzzzz", {"gibberish_name", "gibberish_address"}),
    ("Amina", "2024", "12", {"digits_in_name", "address_without_text"}),
    ("تجربة", "اختبار", "الجزائر", {"placeholder_name"}),
])
def test_junk_identities_are_flagged(first, last, address, expected):
    assert expected <= set(identity_quality_issues(first, last, address))


def test_no_address_is_not_judged():
    assert identity_quality_issues("Amina", "Benali", None) == []


@pytest.mark.parametrize("phone,expected", [
    ("0555123456", []), ("0661234507", []), ("0770981234", []),
    ("0555555555", ["repeated_digits"]), ("0700000000", ["repeated_digits"]),
    ("0612345678", ["sequential_digits"]), ("0212345690", ["not_a_mobile_prefix"]),
])
def test_phone_patterns(phone, expected):
    assert phone_issues(phone) == expected


@pytest.mark.parametrize("text,code", [
    ("16", "16"), ("16 - Alger", "16"), ("Alger", "16"), ("Algiers", "16"), ("الجزائر", "16"),
    ("Wilaya d'Alger", "16"), ("ولاية وهران", "31"), ("Béjaïa", "06"), ("Bejaia", "06"),
    ("Tizi-Ouzou", "15"), ("تيزي وزو", "15"), ("Sétif", "19"), ("Timimoun", "49"),
    ("nowhere", None), ("99", None), ("", None),
])
def test_resolve_wilaya(text, code):
    assert resolve_wilaya(text) == code


def test_commune_lookup_across_scripts():
    assert commune_wilayas("Bab Ezzouar") == {"16"} == commune_wilayas("باب الزوار")
    assert commune_wilayas("Bir El Djir") == {"31"} == commune_wilayas("بئر الجير")
    assert commune_wilayas("Hai inconnu") == set()


def test_location_mismatch_is_conservative():
    assert location_mismatch("Alger", "Bab Ezzouar") is None
    assert location_mismatch("Oran", "Bab Ezzouar") == {"wilaya_code": "31", "commune_wilaya_codes": ["16"]}
    assert location_mismatch("Adrar", "Timimoun") is None  # 2019 wilaya under its parent
    assert location_mismatch("Alger", "Hai inconnu") is None  # unknown commune: no evidence
    assert location_mismatch("???", "Kouba") is None  # unknown wilaya: no evidence


def test_production_defaults_are_on():
    assert DEFAULT_RISK_PROFILE.low_quality_identity_score > 0
    assert DEFAULT_RISK_PROFILE.suspicious_phone_score > 0
    assert DEFAULT_RISK_PROFILE.address_location_mismatch_score > 0


def _headers(db, scopes=None):
    merchant = Merchant(name="Quality", email=f"quality-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
    db.add(merchant)
    db.flush()
    _, raw = ApiKeyService(db).create_key(merchant=merchant, name="q", environment="live", scopes=scopes)
    db.commit()
    return {"Authorization": f"Bearer {raw}"}


def _post(headers, **overrides):
    body = {
        "external_order_id": f"q-{uuid4()}", "first_name": "Amina", "last_name": "Benali",
        "phone": f"0661{uuid4().int % 10**6:06d}", "wilaya": "Alger", "commune": "Bab Ezzouar",
        "address": "12 Rue Didouche Mourad", "total_amount": "4500.00", "currency": "DZD",
    }
    body.update(overrides)
    response = client.post("/api/v1/orders", json=body, headers=headers)
    assert response.status_code == 201, response.text
    return {e["event_type"]: e for e in response.json()["risk"]["events"]}


def test_clean_order_has_no_first_order_signals():
    db = SessionLocal()
    try:
        events = _post(_headers(db))
        assert not {
            RiskEventType.LOW_QUALITY_IDENTITY.value,
            RiskEventType.SUSPICIOUS_PHONE_NUMBER.value,
            RiskEventType.ADDRESS_LOCATION_MISMATCH.value,
        } & set(events)
    finally:
        db.close()


def test_hurried_fake_order_is_explained():
    db = SessionLocal()
    try:
        events = _post(_headers(db), first_name="test", last_name="test", phone="0544444444",
                       wilaya="Oran", commune="Bab Ezzouar", address="test")
        assert set(events[RiskEventType.LOW_QUALITY_IDENTITY.value]["event_data"]["issues"]) >= {"placeholder_name", "placeholder_address"}
        assert events[RiskEventType.SUSPICIOUS_PHONE_NUMBER.value]["event_data"]["issues"] == ["repeated_digits"]
        assert events[RiskEventType.ADDRESS_LOCATION_MISMATCH.value]["event_data"]["wilaya_code"] == "31"
    finally:
        db.close()


def test_merchant_can_switch_a_signal_off():
    db = SessionLocal()
    try:
        headers = _headers(db, scopes=["orders:write", "risk_profile:write"])
        response = client.patch("/api/v1/risk-profile", json={"suspicious_phone_score": 0}, headers=headers)
        assert response.status_code == 200, response.text
        assert response.json()["suspicious_phone_score"] == 0
        events = _post(headers, phone="0744444444")
        assert RiskEventType.SUSPICIOUS_PHONE_NUMBER.value not in events
    finally:
        db.close()


# --- second review: false positives and edge cases ---------------------------

@pytest.mark.parametrize("wilaya,commune", [
    ("Alger", "Saoula"),     # dataset spells it Sehaoula; skeleton "sl" is shared
    ("Alger", "Ville"),      # "fl" collides with communes elsewhere
    ("Oran", "Centre"),
])
def test_short_or_ambiguous_commune_names_are_not_evidence(wilaya, commune):
    assert location_mismatch(wilaya, commune) is None


@pytest.mark.parametrize("first,last,address", [
    ("Mo7amed", "Sa3idi", "12 Rue Larbi Ben Mhidi"),   # Arabizi
    ("3abdelkader", "Benali", "Cite 5 juillet"),
    ("Nan", "Haddad", "Rue sans nom"),
    ("Amina", "Benali", "حي 5"),
])
def test_more_real_identities_are_clean(first, last, address):
    assert identity_quality_issues(first, last, address) == []


def test_digit_only_name_is_flagged():
    assert "digits_in_name" in identity_quality_issues("Amina", "12345", "12 Rue Didouche Mourad")


@pytest.mark.parametrize("phone", ["0770770770", "0550505050", "0661161616"])
def test_vanity_numbers_are_not_suspicious(phone):
    assert phone_issues(phone) == []


def test_punctuation_only_address_is_judged_on_what_was_typed():
    db = SessionLocal()
    try:
        events = _post(_headers(db), address="...")
        assert "address_without_text" in events[RiskEventType.LOW_QUALITY_IDENTITY.value]["event_data"]["issues"]
    finally:
        db.close()


def test_merchant_weight_above_group_cap_is_not_cut():
    db = SessionLocal()
    try:
        headers = _headers(db, scopes=["orders:write", "risk_profile:write"])
        assert client.patch("/api/v1/risk-profile", json={"low_quality_identity_score": 60}, headers=headers).status_code == 200
        body = {
            "external_order_id": f"q-{uuid4()}", "first_name": "test", "last_name": "Benali",
            "phone": f"0661{uuid4().int % 10**6:06d}", "wilaya": "Alger", "commune": "Bab Ezzouar",
            "address": "12 Rue Didouche Mourad", "total_amount": "4500.00",
        }
        response = client.post("/api/v1/orders", json=body, headers=headers)
        assert response.status_code == 201, response.text
        assert response.json()["risk"]["score"] >= 60
    finally:
        db.close()
