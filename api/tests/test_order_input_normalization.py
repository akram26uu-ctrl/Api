"""Orders must not be lost to formatting: every path (API and store
webhooks) normalizes phones, wilayas and amounts the same way."""
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.api.v1.integrations import _money, _normalize_order
from app.core.algeria_geo import resolve_wilaya
from app.schemas.order import OrderCreate


def _order(**overrides):
    base = dict(
        external_order_id="N-1", first_name="Amina", last_name="Benali", phone="0555123456",
        wilaya="Alger", commune="Bab Ezzouar", address="12 Rue Didouche Mourad", total_amount="4500.00",
    )
    base.update(overrides)
    return OrderCreate(**base)


@pytest.mark.parametrize("raw", [
    "0555123456", "+213555123456", "00213555123456", "213555123456", "555123456",
    "+213 (0) 555 12 34 56", "0555-12-34-56", "٠٥٥٥١٢٣٤٥٦", "۰۵۵۵۱۲۳۴۵۶", "+٢١٣٥٥٥١٢٣٤٥٦",
])
def test_phone_formats_normalize_to_local_mobile(raw):
    assert _order(phone=raw).phone == "0555123456"


@pytest.mark.parametrize("raw", ["12345", "05551234567890", "abc", "0055512345"])
def test_invalid_phones_are_still_rejected(raw):
    with pytest.raises(ValueError):
        _order(phone=raw)


@pytest.mark.parametrize("raw,name", [
    ("DZ-16", "Alger"), ("dz16", "Alger"), ("DZ 31", "Oran"), ("16", "Alger"), ("1", "Adrar"),
    ("01", "Adrar"), ("Alger", "Alger"), ("16 - Alger", "16 - Alger"), ("الجزائر", "الجزائر"),
])
def test_wilaya_codes_become_names(raw, name):
    assert _order(wilaya=raw).wilaya == name


def test_iso_wilaya_codes_resolve():
    assert resolve_wilaya("DZ-16") == "16"
    assert resolve_wilaya("dz-06") == "06"
    assert resolve_wilaya("DZ-99") is None


def test_single_letter_names_are_accepted():
    order = _order(first_name="Y", last_name="B")
    assert (order.first_name, order.last_name) == ("Y", "B")


@pytest.mark.parametrize("raw,expected", [
    ("1500", "1500.00"), ("1500.50", "1500.50"), ("1,500.00", "1500.00"), ("1 500,00", "1500.00"),
    ("1.500,00", "1500.00"), ("1,500", "1500.00"), ("2 500 DA", "2500.00"), ("3500 DZD", "3500.00"),
    ("12,5", "12.50"), (4500, "4500.00"), ("1 200", "1200.00"),
])
def test_store_amount_formats(raw, expected):
    assert _money(raw, "total") == Decimal(expected)


@pytest.mark.parametrize("raw", ["", "abc", "-100", "0", None])
def test_invalid_amounts_rejected(raw):
    with pytest.raises(HTTPException):
        _money(raw, "total")


def test_woocommerce_state_code_order_is_ingested_with_readable_wilaya():
    payload = {
        "id": 991, "currency": "DZD", "total": "3,200.00",
        "billing": {"first_name": "Karim", "last_name": "Saidi", "phone": "٠٦٦١٢٣٤٥٦٧",
                    "address_1": "Cite 5 juillet", "city": "Bab Ezzouar", "state": "DZ-16"},
        "line_items": [{"name": "Robe", "quantity": 1, "price": "3,200.00"}],
    }
    order = _normalize_order(payload, "991")
    assert order.wilaya == "Alger"
    assert order.phone == "0661234567"
    assert order.total_amount == Decimal("3200.00")


def test_terse_address_is_accepted_and_scored_instead_of_lost():
    assert _order(address="5", commune="X").address == "5"


@pytest.mark.parametrize("currency", ["DZD", "dzd", "DA", "دج", " DZD "])
def test_local_currency_labels_are_accepted(currency):
    payload = {
        "id": 77, "currency": currency, "total": "1200",
        "billing": {"first_name": "Ali", "last_name": "Bena", "phone": "0550123456",
                    "address_1": "5 Rue X", "city": "Oran", "state": "DZ-31"},
    }
    assert _normalize_order(payload, "77").currency == "DZD"
