import base64
import hashlib
import hmac

from app.api.v1.integration_connections import (
    decrypt_webhook_secret,
    encrypt_webhook_secret,
    _verify_signature,
)


def test_integration_secret_is_encrypted_and_round_trips():
    secret = "provider-webhook-secret-for-test"
    encrypted = encrypt_webhook_secret(secret)

    assert encrypted != secret
    assert decrypt_webhook_secret(encrypted) == secret


def test_shared_receiver_signature_verification_accepts_base64_and_hex():
    body = b'{"event":"order.created","id":"order-42"}'
    secret = "integration-test-secret"
    digest = hmac.new(secret.encode(), body, hashlib.sha256).digest()

    assert _verify_signature(body, base64.b64encode(digest).decode(), secret)
    assert _verify_signature(body, digest.hex(), secret)
    assert not _verify_signature(body, digest.hex(), "incorrect-secret")
    assert not _verify_signature(body + b" ", digest.hex(), secret)


def test_shopify_webhook_is_bound_to_registered_shop_domain():
    from app.api.v1.integration_connections import _shopify_domain_matches

    assert _shopify_domain_matches("shop.example.myshopify.com", "shop.example.myshopify.com")
    assert _shopify_domain_matches("SHOP.EXAMPLE.MYSHOPIFY.COM", "shop.example.myshopify.com")
    assert not _shopify_domain_matches("shop-a.myshopify.com", "shop-b.myshopify.com")
    assert not _shopify_domain_matches("shop.example.myshopify.com", None)


def test_store_scoped_api_key_cannot_create_connection_for_another_store():
    from types import SimpleNamespace
    from uuid import uuid4

    import pytest
    from fastapi import HTTPException

    from app.api.v1.integration_connections import _ensure_store_scope

    allowed_store = uuid4()
    other_store = uuid4()
    scoped_key = SimpleNamespace(store_id=allowed_store)

    _ensure_store_scope(scoped_key, allowed_store)
    with pytest.raises(HTTPException) as exc_info:
        _ensure_store_scope(scoped_key, other_store)
    assert exc_info.value.status_code == 403


def test_merchant_wide_api_key_can_manage_any_owned_store():
    from types import SimpleNamespace
    from uuid import uuid4

    from app.api.v1.integration_connections import _ensure_store_scope

    _ensure_store_scope(SimpleNamespace(store_id=None), uuid4())
