"""Orders must not be lost to formatting: every path (API and store
webhooks) normalizes phones, wilayas and amounts the same way."""
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.api.v1.integrations import _money, _normalize_order
from app.core.algeria_geo import canonical_wilaya_text, resolve_wilaya
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


import json as _json
from pathlib import Path as _Path

_WILAYAS = _json.loads((_Path(__file__).resolve().parent.parent / "app" / "data" / "algeria_communes.json").read_text(encoding="utf-8"))["wilayas"]
_AR_DIGITS = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def _forms(code, fr, ar):
    n = int(code)
    return [
        code, str(n), f"DZ-{code}", f"DZ-{n}", f"dz{code}", f"W{n}", f"Wilaya {n}", f"wilaya n° {code}",
        f"ولاية {n}", f"الولاية {code}", str(n).translate(_AR_DIGITS), f"ولاية {str(n).translate(_AR_DIGITS)}",
        f"{code} - {fr}", f"{n}-{fr}", f"{fr} ({code})", f"{code} {ar}", fr, ar, fr.upper(), f"{code}000",
    ]


@pytest.mark.parametrize("code", sorted(_WILAYAS))
def test_every_wilaya_resolves_in_every_format(code):
    fr, ar = _WILAYAS[code]
    failures = [form for form in _forms(code, fr, ar) if resolve_wilaya(form) != code]
    assert failures == []


@pytest.mark.parametrize("code", sorted(_WILAYAS))
def test_every_code_only_form_displays_the_name(code):
    fr, _ = _WILAYAS[code]
    n = int(code)
    for form in (code, str(n), f"DZ-{code}", f"Wilaya {n}", f"ولاية {str(n).translate(_AR_DIGITS)}", f"W{n}"):
        assert canonical_wilaya_text(form) == fr, form


def test_contradictory_wilaya_is_not_guessed():
    assert resolve_wilaya("31 - Alger") is None
    assert resolve_wilaya("99") is None
    assert resolve_wilaya("59000") is None


def test_oran_examples():
    for form in ("31", "DZ-31", "Wilaya 31", "ولاية 31", "٣١", "31000", "31 - Oran", "وهران", "Oran"):
        assert resolve_wilaya(form) == "31", form
    assert _order(wilaya="31").wilaya == "Oran"
    assert _order(wilaya="ولاية ٣١").wilaya == "Oran"


def test_postal_code_supplies_a_missing_wilaya():
    payload = {
        "id": 78, "currency": "DZD", "total_price": "2500.00",
        "shipping_address": {"first_name": "Ali", "last_name": "Bena", "phone": "0550123456",
                             "address1": "5 Rue X", "city": "Es Senia", "zip": "31000", "province": None},
    }
    assert _normalize_order(payload, "78").wilaya == "Oran"


@pytest.mark.parametrize("raw", ["1e30", "123456789012345678901234567890"])
def test_out_of_range_amounts_are_clean_422s(raw):
    with pytest.raises(HTTPException):
        _money(raw, "total")
    with pytest.raises(ValueError):
        _order(total_amount=raw)


@pytest.mark.parametrize("currency", ["DA", " DZD ", "dzd", "دج"])
def test_api_accepts_local_currency_labels(currency):
    assert _order(currency=currency).currency == "DZD"
