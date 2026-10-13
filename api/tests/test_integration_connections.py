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
