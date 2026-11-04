from app.api.v1.integration_connections import _stable_event_id


def test_woocommerce_static_webhook_id_does_not_collapse_distinct_orders():
    headers = {"X-WC-Webhook-ID": "webhook-config-42"}

    first = _stable_event_id("woocommerce", headers, {}, "order-1001")
    second = _stable_event_id("woocommerce", headers, {}, "order-1002")

    assert first != second


def test_woocommerce_delivery_id_shared_within_one_second_does_not_collapse_orders():
    # WooCommerce derives X-WC-Webhook-Delivery-ID from the webhook ID and the current second.
    headers = {"X-WC-Webhook-Delivery-ID": "same-second-hash"}

    assert _stable_event_id("woocommerce", headers, {}, "1001") != _stable_event_id("woocommerce", headers, {}, "1002")


def test_retries_of_the_same_order_share_one_identity():
    first = _stable_event_id("custom", {"X-ORDIUM-Event-ID": "delivery-555"}, {}, "order-1001")
    retry = _stable_event_id("custom", {"X-ORDIUM-Event-ID": "delivery-556"}, {}, "order-1001")

    assert first == retry
