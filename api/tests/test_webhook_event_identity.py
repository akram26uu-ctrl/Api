from app.api.v1.integration_connections import _stable_event_id


def test_woocommerce_static_webhook_id_does_not_collapse_distinct_orders():
    headers = {"X-WC-Webhook-ID": "webhook-config-42"}

    first = _stable_event_id("woocommerce", headers, {}, "order-1001")
    second = _stable_event_id("woocommerce", headers, {}, "order-1002")

    assert first == "woocommerce:order-1001"
    assert second == "woocommerce:order-1002"
    assert first != second


def test_custom_delivery_id_is_used_for_retry_deduplication():
    headers = {"X-ORDIUM-Event-ID": "delivery-555"}

    first = _stable_event_id("custom", headers, {}, "order-1001")
    retry = _stable_event_id("custom", headers, {}, "order-1001")

    assert first == retry == "delivery-555"
