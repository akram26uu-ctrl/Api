from uuid import uuid4

from app.models.api_key import ApiKey
from app.models.merchant import Merchant
from app.models.merchant_customer import MerchantCustomer
from app.models.enums import MerchantStatus
from app.repositories.audit_log_repository import AuditLogRepository
from app.services.api_key_service import ApiKeyService
from app.services.audit_service import AuditService
from app.services.feature_registry import FeatureRegistry
from app.services.webhook_service import WebhookService


def test_api_key_lifecycle_rotation_and_hashing():
    from app.db.database import SessionLocal

    db = SessionLocal()
    try:
        merchant = Merchant(name="Keys", email=f"keys-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
        db.add(merchant)
        db.flush()
        key, raw = ApiKeyService(db).create_key(merchant, "integration", "live")
        assert raw.startswith("ordium_live_")
        assert key.key_hash != raw
        assert ApiKeyService(db).authenticate(raw).id == key.id
        key.is_active = False
        db.commit()
        try:
            ApiKeyService(db).authenticate(raw)
        except ValueError:
            pass
        else:
            raise AssertionError("revoked key authenticated")
    finally:
        db.rollback()
        db.close()


def test_webhook_secret_is_encrypted_and_signature_is_stable():
    from app.db.database import SessionLocal

    db = SessionLocal()
    try:
        merchant = Merchant(name="Hooks", email=f"hooks-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
        db.add(merchant)
        db.flush()
        service = WebhookService(db)
        endpoint, secret = service.create_endpoint(merchant.id, "live", "https://1.1.1.1/webhook", ["order.risk_assessed"])
        assert secret.startswith("whsec_")
        assert endpoint.signing_secret_encrypted != secret.encode()
        signature = service.sign(endpoint, {"order_id": "1", "risk": {"score": 80}}, timestamp=1700000000)
        assert signature.startswith("t=1700000000,v1=")
    finally:
        db.rollback()
        db.close()


def test_webhook_enqueue_is_tenant_scoped_and_event_filtered():
    from app.db.database import SessionLocal

    db = SessionLocal()
    try:
        merchant_a = Merchant(name="A", email=f"a-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
        merchant_b = Merchant(name="B", email=f"b-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
        db.add_all([merchant_a, merchant_b])
        db.flush()
        service = WebhookService(db)
        service.create_endpoint(merchant_a.id, "live", "https://1.1.1.1/a", ["order.outcome.updated"])
        service.create_endpoint(merchant_b.id, "live", "https://1.1.1.1/b", ["*"])
        deliveries = service.enqueue(merchant_a.id, "live", "order.outcome.updated", {"x": 1})
        assert len(deliveries) == 1
        assert deliveries[0].endpoint.merchant_id == merchant_a.id
    finally:
        db.rollback()
        db.close()


def test_audit_log_and_feature_registry():
    from app.db.database import SessionLocal

    db = SessionLocal()
    try:
        merchant = Merchant(name="Audit", email=f"audit-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
        db.add(merchant)
        db.flush()
        entry = AuditService(db).record(
            action="test.action",
            resource_type="test",
            resource_id="abc",
            merchant_id=merchant.id,
            environment="live",
            request_id="req-1",
            metadata={"safe": True},
        )
        assert entry.id is not None
        entries = AuditLogRepository(db).list_for_merchant(merchant.id, "live")
        assert entries[0].action == "test.action"
        names = FeatureRegistry.names()
        assert "identity_confidence" in names
        assert "identity_cluster_size" in names
    finally:
        db.rollback()
        db.close()


def test_webhook_blocks_private_networks():
    from app.db.database import SessionLocal
    db = SessionLocal()
    try:
        merchant = Merchant(name="SSRF", email=f"ssrf-{uuid4()}@ordium.local", status=MerchantStatus.ACTIVE)
        db.add(merchant); db.flush()
        service = WebhookService(db)
        for url in ("http://127.0.0.1/hook", "https://10.0.0.1/hook", "https://169.254.169.254/latest"):
            try:
                service.create_endpoint(merchant.id, "live", url, ["*"])
            except ValueError:
                pass
            else:
                raise AssertionError(f"forbidden webhook URL accepted: {url}")
    finally:
        db.rollback(); db.close()


def test_webhook_delivery_revalidates_target(monkeypatch):
    from app.services.webhook_service import WebhookService

    calls = []
    original = WebhookService.validate_url

    def fake_validate(url, *, resolve=False):
        calls.append((url, resolve))
        return original(url, resolve=resolve)

    monkeypatch.setattr(WebhookService, "validate_url", staticmethod(fake_validate))
    WebhookService(None).validate_delivery_target("https://1.1.1.1/webhook")
    assert calls == [("https://1.1.1.1/webhook", True)]


def test_webhook_redirect_handler_rejects_redirects():
    import scripts.dispatch_webhooks as dispatcher

    handler = dispatcher._NoRedirectHandler()
    try:
        handler.redirect_request(None, None, 302, "Found", {}, "https://example.org/next")
    except RuntimeError as exc:
        assert str(exc) == "Webhook redirects are not allowed"
    else:
        raise AssertionError("webhook redirects were not rejected")


def test_webhook_delivery_model_supports_processing_lease():
    from app.models.webhook_delivery import WebhookDelivery
    assert hasattr(WebhookDelivery, "processing_started_at")


def test_dispatcher_has_safe_delivery_headers():
    import inspect
    import scripts.dispatch_webhooks as dispatcher
    source = inspect.getsource(dispatcher.dispatch_once)
    assert 'X-ORDIUM-Event-ID' in source
    assert 'X-ORDIUM-Delivery-ID' in source
    assert 'status = "processing"' in source
