# Carrier Adapter Guide

How to add a real courier to the shipping module.

## Where things live

- `api/app/services/carriers/base.py`: the `CarrierAdapter` protocol, data classes, errors, `SHIPMENT_STATUSES`, `STATUS_RANK`.
- `api/app/services/carriers/<code>.py`: one module per courier (see `sandbox.py` as the reference).
- `api/app/services/carriers/registry.py`: `_CARRIERS` maps `code -> (class, display name, allowed environments)`. Register your class there; `get_adapter(code, credentials, environment)` raises `CarrierNotAvailable` otherwise.

Environment rules: real carriers are allowed in `live` and `test` (`frozenset({"live", "test"})`); the sandbox carrier is `test` only. Never register a real courier as test-only or the sandbox as live.

## The protocol

```python
class CarrierAdapter(Protocol):
    code: str
    capabilities: Capabilities            # webhooks, warehouses, stop_desks, cancel (bools)
    def __init__(self, credentials: dict) -> None
    def validate_credentials(self) -> None                      # raise CarrierAuthError if bad
    def list_warehouses(self) -> list[WarehouseInfo]
    def list_stock(self) -> list[StockInfo]
    def create_shipment(self, req: ShipmentRequest) -> CarrierShipmentResult
    def cancel_shipment(self, tracking: str) -> None
    def get_tracking(self, tracking: str) -> list[TrackingEvent]
    def parse_webhook(self, headers: dict, body: bytes) -> list[tuple[str, TrackingEvent]]  # (tracking, event)
    def label_url(self, tracking: str) -> str | None
```

Data classes (all frozen): `Recipient`, `ShipmentLine(sku, name, quantity)`, `ShipmentRequest`, `CarrierShipmentResult(tracking_number, label_url, raw)`, `TrackingEvent(status, raw_status, location, occurred_at, dedupe_key)`, `WarehouseInfo`, `StockInfo`, `Capabilities`.

Set `capabilities` honestly: if `cancel` is false the service cancels locally and tells the merchant to cancel at the courier; `webhooks=False` means we poll `get_tracking`.

## Required behaviours

1. **Idempotency.** `create_shipment` must honour `req.idempotency_key`: a replay with the same key (retry after a timeout, worker restart) must return the same tracking number and never create a second parcel. Use the courier's own idempotency/reference field (e.g. send the key as the client reference) and look it up before creating if the courier has no native support.
2. **Error mapping.** Wrap every courier/HTTP error; nothing else may escape.
   - `CarrierUnavailable`: retryable. Timeouts, connection errors, 5xx, 429.
   - `CarrierValidationError`: the merchant must fix the data. 4xx validation (bad address, unknown commune, bad phone).
   - `CarrierAuthError`: bad/expired credentials, 401/403, bad webhook signature.
3. **No secrets in messages.** Exception messages are stored in `shipment.last_error` and shown to merchants. Never include credentials, tokens, auth headers, or raw request/response bodies. Use short, courier-agnostic text (`"courier rejected the address"`), optionally with the courier's public error text after scrubbing.
4. **Status mapping.** Map every courier status to one of the 11 normalized statuses: `pending_dispatch, dispatch_failed, accepted, picked_up, in_transit, out_for_delivery, delivery_attempt_failed, delivered, returning, returned, cancelled`. Keep the original in `raw_status`. Unknown statuses must raise `CarrierValidationError` (webhook) or be skipped, never guessed. Out-of-order events are resolved with `STATUS_RANK`.
5. **Stable `dedupe_key`.** Same event delivered twice (webhook retry, polling overlap) must produce the identical key, e.g. `f"{tracking}:{status}:{courier_event_id_or_timestamp}"`. Never use `now()` or random values.
6. **Webhook signatures.** Verify before parsing, over the raw body bytes, and compare with `hmac.compare_digest` (on bytes; handle non-ASCII signatures without crashing). Failure raises `CarrierAuthError`. Treat `occurred_at` without a timezone as UTC.
7. **Inputs we send.** SKU comparison is case- and whitespace-insensitive on our side, but send `ShipmentLine.sku` as given. `stop_desk_id` may be `None` (always for `home`). `delivery_type` is `home` or `stop_desk`; reject unsupported types with `CarrierValidationError` (or declare `stop_desks=False`). `cod_amount` is a `Decimal` in DZD.
8. **Timeouts.** Every HTTP call needs an explicit timeout; adapters are called from the dispatch worker and request threads.
9. `list_stock`/`list_warehouses` return empty lists, not errors, when the courier has none.

## Test checklist

Copy from `api/tests/test_carrier_sandbox.py` and adapt (mock the courier HTTP layer, never call the real API):

- credentials: valid accepted, invalid raises `CarrierAuthError` (`test_sandbox_rejects_non_test_credentials`)
- warehouses and stock listing (`..._lists_two_warehouses`, `..._stock_has_skus`)
- create is idempotent, same key same tracking, different key different tracking (`..._create_is_idempotent`)
- validation failure maps to `CarrierValidationError`; outage/timeout/5xx/429 maps to `CarrierUnavailable` (`..._address_fail_raises_validation`)
- tracking progression and return path produce the right normalized statuses; unknown tracking is `CarrierValidationError`
- `STATUS_RANK` ordering (`test_status_rank_ordering`)
- cancel behaviour matches `capabilities.cancel`
- webhook: good signature parses, bad signature and non-ASCII signature raise `CarrierAuthError`, unknown status and malformed body raise `CarrierValidationError`, naive datetime treated as UTC, duplicate delivery yields the same `dedupe_key`
- registry: allowed in `live` and `test`, unknown code or wrong environment raises `CarrierNotAvailable` (`test_registry_refuses_sandbox_in_live` for the sandbox inverse)
- error messages contain no credentials (assert the token is absent from `str(exc)`)
