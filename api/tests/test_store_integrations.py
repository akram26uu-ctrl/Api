import base64
import hashlib
import hmac
import json

import pytest
from fastapi import HTTPException

from app.api.v1.integrations import _normalize_order, _store_config, _verify_hmac


def test_hmac_verification_accepts_shopify_base64_signature():
    body = b'{"id":123,"currency":"DZD"}'
    secret = "test-webhook-secret"
    digest = hmac.new(secret.encode(), body, hashlib.sha256).digest()
    signature = base64.b64encode(digest).decode()

    assert _verify_hmac(body, signature, secret)
    assert not _verify_hmac(body, signature, "wrong-secret")
    assert not _verify_hmac(body + b" ", signature, secret)


def test_hmac_verification_accepts_hex_signature():
    body = b'{"event":"order.created"}'
    secret = "test-webhook-secret"
    signature = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    assert _verify_hmac(body, signature, secret)


def test_normalize_shop_order_to_ordium_schema():
    payload = {
        "id": 12345,
        "currency": "DZD",
        "total_price": "2500.00",
        "customer": {"first_name": "Ali", "last_name": "Test", "phone": "0550123456"},
        "shipping_address": {
            "first_name": "Ali",
            "last_name": "Test",
            "phone": "0550123456",
            "address1": "Rue 1",
            "city": "Alger Centre",
            "province": "Alger",
        },
        "line_items": [{"title": "Test product", "sku": "SKU-1", "quantity": 2, "price": "1250.00"}],
    }

    order = _normalize_order(payload, "12345")

    assert order.external_order_id == "12345"
    assert order.currency == "DZD"
    assert str(order.total_amount) == "2500.00"
    assert order.phone == "0550123456"
    assert len(order.items) == 1
    assert order.items[0].quantity == 2


def test_normalize_rejects_unsupported_currency():
    payload = {
        "currency": "USD",
        "total_price": "10.00",
        "customer": {"first_name": "Ali", "last_name": "Test", "phone": "0550123456"},
        "shipping_address": {
            "first_name": "Ali", "last_name": "Test", "phone": "0550123456",
            "address1": "Rue 1", "city": "Alger", "province": "Alger",
        },
        "line_items": [],
    }

    with pytest.raises(HTTPException) as exc:
        _normalize_order(payload, "order-1")

    assert exc.value.status_code == 422


def test_store_mapping_requires_valid_tenant_and_store_ids():
    merchant_id = "00000000-0000-0000-0000-000000000001"
    store_id = "00000000-0000-0000-0000-000000000002"
    mapped_merchant, mapped_store = _store_config(
        {"shop.example.myshopify.com": {"merchant_id": merchant_id, "store_id": store_id}},
        "shop.example.myshopify.com",
    )
    assert str(mapped_merchant) == merchant_id
    assert str(mapped_store) == store_id

    with pytest.raises(HTTPException) as exc:
        _store_config({}, "unknown.example.myshopify.com")
    assert exc.value.status_code == 403
