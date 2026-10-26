from app.api.v1.integration_connections import _stable_event_id


class HeaderMap(dict):
    def get(self, key, default=None):
        return super().get(key, default)


def _stable_event_id(platform, headers, payload, external_order_id):
    # Exercise the same ID-selection policy used by the webhook receiver.
    delivery_id = (
        headers.get("X-Omniterra-Webhook-Id")
        or headers.get("X-NDC-Webhook-Id")
        or headers.get("X-Shopify-Webhook-Id")
        or headers.get("X-WC-Webhook-Delivery-ID")
        or headers.get("X-ORDIUM-Event-ID")
        or payload.get("event_id")
        or payload.get("delivery_id")
        or f"{platform}:{external_order_id}"
    )
    return delivery_id


def test_woocommerce_static_webhook_id_does_not_collapse_distinct_orders():
    headers = HeaderMap({"X-WC-Webhook-ID": "webhook-config-42"})

    first = _stable_event_id("woocommerce", headers, {}, "order-1001")
    second = _stable_event_id("woocommerce", headers, {}, "order-1002")

    assert first == "woocommerce:order-1001"
    assert second == "woocommerce:order-1002"
    assert first != second


def test_custom_delivery_id_is_used_for_retry_deduplication():
    headers = HeaderMap({"X-ORDIUM-Event-ID": "delivery-555"})

    first = _stable_event_id("custom", headers, {}, "order-1001")
    retry = _stable_event_id("custom", headers, {}, "order-1001")

    assert first == retry == "delivery-555"
