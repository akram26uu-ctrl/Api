from app.services.identity_confidence import calculate_identity_confidence
from app.services.network_intelligence import IPQualityScoreProvider
from app.services.webhook_service import WebhookService


def test_new_identity_does_not_claim_exact_name_confidence():
    result = calculate_identity_confidence(
        existing_customer=False,
        exact_phone=False,
        exact_name=True,
    )
    assert result.score == 0
    assert "exact_name" not in result.reasons


def test_new_identity_with_seen_phone_is_not_full_confidence():
    result = calculate_identity_confidence(
        existing_customer=False,
        exact_phone=True,
        exact_name=True,
    )
    assert result.score == 55
    assert result.reasons == ("phone_seen_before",)


def test_ipqs_zero_ttl_does_not_keep_cache(monkeypatch):
    from app.services.network_intelligence import NetworkIntelResult

    calls = []

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"fraud_score": 10}

    def fake_get(*args, **kwargs):
        calls.append(1)
        return FakeResponse()

    monkeypatch.setattr("app.services.network_intelligence.httpx.get", fake_get)
    provider = IPQualityScoreProvider(api_key="x", cache_ttl_seconds=0)
    provider.lookup("8.8.8.8")
    provider.lookup("8.8.8.8")

    assert len(calls) == 2


def test_webhook_rejects_non_global_literal_ip():
    for url in ("https://100.64.0.1/hook", "https://198.18.0.1/hook"):
        try:
            WebhookService.validate_url(url, resolve=True)
        except ValueError:
            pass
        else:
            raise AssertionError(f"non-global webhook IP accepted: {url}")


def test_identity_cluster_counts_unique_customers():
    from types import SimpleNamespace
    from uuid import uuid4
    from app.services.identity_graph_service import IdentityGraphService

    customer = uuid4()
    order = SimpleNamespace(
        id=uuid4(), merchant_id=uuid4(), environment="live",
        customer_id=customer, phone_identifier_id=uuid4(),
        device_identifier_id=uuid4(), address_identifier_id=uuid4(),
        ip_address="1.1.1.1",
    )

    class FakeScalar:
        def __init__(self, values): self.values = values
        def all(self): return self.values

    class FakeDB:
        def scalars(self, statement):
            return FakeScalar([customer])

    summary = IdentityGraphService(FakeDB()).summarize_order(order)
    assert summary["counts"] == {
        "phone_customers": 1,
        "device_customers": 1,
        "address_customers": 1,
        "ip_customers": 1,
    }
    assert summary["identity_cluster_size"] == 1
