# Shipping, Tracking & Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merchants link a courier account; accepted orders dispatch automatically, held orders wait in a Pending-decision queue, parcels are tracked to delivery/return (feeding outcomes), and courier- or merchant-held stock is managed — with only a sandbox carrier until real agreements exist.

**Architecture:** A `CarrierAdapter` protocol with a registry (only `sandbox`), new SQLAlchemy models behind one additive Alembic migration, a `ShippingService` hooked into the existing decision/confirmation flow, three polling workers added to the existing `webhook-worker` loop, new `/api/v1/shipping/*` and `/api/v1/inventory/*` routers, and React views built from the existing dashboard components.

**Tech Stack:** FastAPI, SQLAlchemy 2, Alembic, pytest (SQLite in tests), cryptography Fernet; React + TypeScript + Tailwind, lucide-react; Control Plane dashboard proxy.

**Spec:** `docs/superpowers/specs/2026-11-04-shipping-inventory-design.md` (Arabic; section numbers below refer to it).

## Global Constraints

- Never change the existing dashboard colours or design: reuse `web/src/index.css` tokens, Cairo/JetBrains Mono, existing sidebar, `dashboard-panel`, `settings-*` classes, lucide icons. No new CSS variables or palettes.
- Every user-facing string exists in `web/src/i18n/ar.json`, `fr.json`, `en.json`.
- One additive Alembic migration; it must not modify existing rows except appending the new scopes to existing dashboard keys (Task 2).
- REVIEW / REJECT orders are never dispatched without an explicit merchant action.
- At most one active shipment per order; dispatch is idempotent (idempotency key = shipment id).
- `sandbox` carrier is allowed in `test` environment only; the registry refuses it for `live`.
- Bad-outcome labelling follows `app/core/outcomes.py` (`risk_decision`, `out_of_stock` are not bad).
- Touch targets ≥ 44px; full RTL.
- New API key scopes: `shipping:read`, `shipping:write`, `inventory:read`, `inventory:write`.
- Shipment statuses (exact strings): `pending_dispatch, dispatch_failed, accepted, picked_up, in_transit, out_for_delivery, delivery_attempt_failed, delivered, returning, returned, cancelled`.
- Hold reasons (exact strings): `review, rejected, no_answer, awaiting_confirmation, out_of_stock, unmapped_product, mixed_source, no_store`.

## Review Focus

1. A shipment created under one environment/store is never visible or actionable from another environment, store or merchant — test in Task 9 (`test_shipments_isolated_by_env_store_merchant`).
2. Two worker processes running concurrently must not dispatch the same shipment twice — Task 7 (`test_dispatch_is_idempotent_on_retry_after_crash`: adapter called twice with same idempotency key returns the same tracking number, one `accepted` shipment).
3. Out-of-order or duplicate tracking webhooks never move a delivered parcel backwards — Task 8 (`test_late_in_transit_after_delivered_is_logged_not_applied`).
4. Order items whose SKU differs only in case/whitespace from a product must still match — Task 5 (`test_sku_match_is_case_and_space_insensitive`).
5. A merchant who switches the setting from `after_confirmation` to `on_allow` while orders are waiting gets those orders released on the next worker run — Task 6 (`test_trigger_change_releases_awaiting_confirmation`).

---

### Task 1: Carrier adapter contract and sandbox carrier

**Files:**
- Create: `api/app/services/carriers/__init__.py`, `base.py`, `registry.py`, `sandbox.py`
- Test: `api/tests/test_carrier_sandbox.py`

**Interfaces:**
- Produces:
  - `SHIPMENT_STATUSES: tuple[str, ...]` (order as in Global Constraints) and `STATUS_RANK: dict[str,int]` (terminal `delivered/returned/cancelled` rank highest; `returning` > `delivery_attempt_failed` > `out_for_delivery`).
  - dataclasses (frozen): `Recipient(first_name, last_name, phone, wilaya, commune, address)`, `ShipmentLine(sku: str, name: str, quantity: int)`, `ShipmentRequest(idempotency_key: str, recipient: Recipient, delivery_type: str, stop_desk_id: str|None, cod_amount: Decimal, lines: list[ShipmentLine], warehouse_external_id: str|None)`, `CarrierShipmentResult(tracking_number: str, label_url: str|None, raw: dict)`, `TrackingEvent(status: str, raw_status: str, location: str|None, occurred_at: datetime, dedupe_key: str)`, `WarehouseInfo(external_id, name, wilaya_code, commune)`, `StockInfo(external_product_id, sku, name, warehouse_external_id, on_hand: int)`, `Capabilities(webhooks: bool, warehouses: bool, stop_desks: bool, cancel: bool)`.
  - exceptions: `CarrierError`, `CarrierAuthError(CarrierError)`, `CarrierValidationError(CarrierError)` (not retryable), `CarrierUnavailable(CarrierError)` (retryable).
  - `class CarrierAdapter(Protocol)`: `code: str`, `capabilities: Capabilities`, `__init__(self, credentials: dict)`, `validate_credentials() -> None`, `list_warehouses() -> list[WarehouseInfo]`, `list_stock() -> list[StockInfo]`, `create_shipment(req: ShipmentRequest) -> CarrierShipmentResult`, `cancel_shipment(tracking: str) -> None`, `get_tracking(tracking: str) -> list[TrackingEvent]`, `parse_webhook(headers: dict, body: bytes) -> list[tuple[str, TrackingEvent]]` (tracking, event), `label_url(tracking: str) -> str|None`.
  - `registry.get_adapter(code: str, credentials: dict, environment: str) -> CarrierAdapter` raising `CarrierNotAvailable(code, environment)`; `registry.available_carriers(environment) -> list[dict]` (`code`, `display_name`, `capabilities`).
  - `sandbox.SandboxCarrier` with `code="sandbox"`; module-level `SANDBOX_CLOCK: Callable[[], datetime]` (monkeypatchable) and in-process `_STATE: dict[str, dict]` keyed by tracking.

- [ ] **Step 1: Write failing tests** in `test_carrier_sandbox.py`:
  - `test_sandbox_rejects_non_test_credentials`: `SandboxCarrier({"api_id":"x","api_token":"live_1"}).validate_credentials()` raises `CarrierAuthError`; with `api_token="test_ok"` passes.
  - `test_sandbox_lists_two_warehouses`: external ids `"ORN"` (wilaya_code `"31"`) and `"ALG"` (`"16"`).
  - `test_sandbox_stock_has_skus`: `list_stock()` returns rows for SKUs `"SNK-BLK-41"`, `"SNK-BLK-42"`, `"WAT-SLV-02"` with `on_hand >= 0`.
  - `test_sandbox_create_is_idempotent`: two `create_shipment` with same `idempotency_key` return the same `tracking_number`, starting with `"SBX-"`.
  - `test_sandbox_address_fail_raises_validation`: address containing `"FAIL"` raises `CarrierValidationError`; containing `"DOWN"` raises `CarrierUnavailable`.
  - `test_sandbox_progresses_with_clock`: after create at t0, `get_tracking` at t0+0h yields `accepted`; t0+2h includes `picked_up`; t0+26h includes `in_transit`; t0+50h last status `delivered` (or `returned` when address contains `"RETURN"`), statuses non-decreasing by `STATUS_RANK`.
  - `test_registry_refuses_sandbox_in_live`: `get_adapter("sandbox", {...}, "live")` raises `CarrierNotAvailable`; `available_carriers("live") == []`; `available_carriers("test")[0]["code"] == "sandbox"`.
  - `test_sandbox_webhook_signature`: `parse_webhook` with header `X-Sandbox-Signature` = hex HMAC-SHA256 of body with key `credentials["api_token"]` returns events; wrong signature raises `CarrierAuthError`.
- [ ] **Step 2:** Run `cd api && python -m pytest tests/test_carrier_sandbox.py -q` → FAIL (import error).
- [ ] **Step 3:** Implement the four modules. Sandbox timeline (hours after create): 0 accepted, 2 picked_up, 26 in_transit, 40 out_for_delivery, 48 delivered — or for `RETURN` addresses 40 out_for_delivery, 44 delivery_attempt_failed, 46 returning, 50 returned. `dedupe_key = f"{tracking}:{status}"`. Stock is a fixed table seeded per credentials.
- [ ] **Step 4:** Run the tests → PASS.
- [ ] **Step 5:** Commit `feat(shipping): carrier adapter contract and sandbox carrier`.

### Task 2: Data model, migration, order delivery fields, scopes

**Files:**
- Create: `api/app/models/carrier_account.py`, `carrier_warehouse.py`, `product.py` (Product, ProductCarrierLink, StockLevel, StockDeposit, StockMovement), `shipment.py` (Shipment, ShipmentEvent), `shipping_settings.py` (ShippingSettings, ShippingRoute)
- Create: `api/migrations/versions/f3c9a1d7e2b5_add_shipping_and_inventory.py` (`down_revision = "e8b3f5a2c1d9"`)
- Modify: `api/app/models/__init__.py`, `api/app/models/order.py` (add `delivery_type String(20) default "home"`, `stop_desk_id String(100) null`), `api/app/schemas/order.py` (`OrderCreate.delivery_type: Literal["home","stop_desk"] = "home"`, `stop_desk_id: str|None`), `api/app/services/order_service.py` (persist both), `api/app/schemas/api_key.py` (four new scopes), `control-plane/app/services/ordium_api.py` (dashboard key scopes += four), store payload normalizers in `api/app/api/v1/integrations.py` (map platform shipping method containing "stop"/"desk"/"bureau"/"مكتب" → `stop_desk`)
- Test: `api/tests/test_shipping_models.py`

**Interfaces:**
- Produces model fields exactly as spec §7.2 plus: `Shipment.hold_reason: str|None`, `Shipment.environment: str`, `Shipment.merchant_id`, `Shipment.store_id: UUID|None`, `Shipment.carrier_account_id: UUID|None`, `Shipment.warehouse_id: UUID|None`, `Shipment.fulfillment: str` (`carrier|merchant`), `Shipment.idempotency_key: str` (= str(id)), `Shipment.allocations: JSON list` (`[{product_id, warehouse_id, quantity}]`), `Shipment.meta: JSON dict` (`backorder`, `fell_back`), `Shipment.created_at/updated_at`; `ShippingSettings.confirmation_timeout_hours: int = 24`; `CarrierAccount.environment`. `StockLevel` unique (`product_id`, `warehouse_id`) — merchant location stored as `warehouse_id IS NULL` with a partial unique index on `product_id` where null. Active-shipment uniqueness: partial unique index `uq_shipments_order_active` on `order_id` where `status NOT IN ('cancelled','returned','delivered','dispatch_failed')`.
- Migration also appends the four scopes to `api_keys.scopes` for rows with `key_kind='system' AND name LIKE 'Dashboard session%'` (JSON list, keep existing, no duplicates); downgrade removes them.

- [ ] **Step 1: Failing tests:** `test_stock_level_rejects_reserved_above_on_hand` (IntegrityError on flush with on_hand=1, reserved=2); `test_one_active_shipment_per_order` (second `pending_dispatch` for same order → IntegrityError; after first set `cancelled`, a new one is allowed); `test_order_create_accepts_delivery_type` (OrderCreate with `delivery_type="stop_desk"` valid, `"drone"` invalid); `test_new_scopes_available` (all four in `AVAILABLE_API_KEY_SCOPES`); `test_migration_chain_head` (alembic `ScriptDirectory` head == `"f3c9a1d7e2b5"`).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement models, migration, schema/scope edits. Partial indexes: use `postgresql_where` and `sqlite_where`.
- [ ] **Step 4:** `python -m pytest tests/test_shipping_models.py -q` PASS, then full `python -m pytest -q` PASS (no regressions).
- [ ] **Step 5:** Commit `feat(shipping): data model, migration, delivery type and scopes`.

### Task 3: Carrier accounts service and API

**Files:**
- Create: `api/app/services/carrier_account_service.py`, `api/app/api/v1/shipping_carriers.py`, `api/app/schemas/shipping.py`
- Modify: `api/app/api/v1/router.py`
- Test: `api/tests/test_carrier_accounts_api.py`

**Interfaces:**
- Consumes: Task 1 registry; Task 2 models.
- Produces: `CarrierAccountService(db)` with `link(merchant_id, store_id, environment, carrier_code, display_name, credentials: dict) -> CarrierAccount` (validates via adapter, encrypts with Fernet derived exactly like `WebhookService._fernet`, upserts warehouses, imports carrier stock via `InventoryService.import_carrier_stock` — call through a hook `on_linked` that Task 5 fills; until then a no-op), `adapter_for(account) -> CarrierAdapter`, `test(account) -> None`, `disable(account)`, `delete(account)`, `first_linked_at(store_id, environment) -> datetime|None`.
- Endpoints (prefix `/shipping/carriers`): `GET ""` (scope `shipping:read`; returns accounts + `available: registry.available_carriers(env)`; never returns credentials), `POST ""` (`shipping:write`; 422 on `CarrierAuthError` with `detail="carrier_auth_failed"`, 409 when sandbox in live with `detail="carrier_not_available"`), `POST "/{id}/test"`, `POST "/{id}/disable"`, `DELETE "/{id}"`, `GET "/{id}/warehouses"`. All filtered by `api_key.merchant_id`, `api_key.environment`, and key `store_id`.

- [ ] **Step 1: Failing tests:** `test_link_sandbox_in_test_env` (201, response has no `credentials`/`credentials_encrypted` key, warehouses count 2); `test_link_sandbox_in_live_refused` (409 `carrier_not_available`); `test_bad_credentials_422`; `test_other_merchant_cannot_see_account`; `test_scope_required` (key without `shipping:read` → 403); `test_audit_logged_on_link` (AuditLog action `carrier_account.linked`).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement and register router. **Step 4:** PASS. **Step 5:** Commit `feat(shipping): carrier account linking API`.

### Task 4: Shipping settings and routes API

**Files:**
- Create: `api/app/services/shipping_settings_service.py`, `api/app/api/v1/shipping_settings.py`
- Modify: `api/app/schemas/shipping.py`, `api/app/api/v1/router.py`
- Test: `api/tests/test_shipping_settings_api.py`

**Interfaces:**
- Produces: `ShippingSettingsService(db).get_or_default(store_id) -> ShippingSettings` (creates row with spec defaults: auto_dispatch true, dispatch_trigger `after_confirmation`, hold_minutes 15, retry_max 5, retry_interval_minutes 10, fallback_enabled true, out_of_stock_policy `hold`, low_stock_days 5, reserve_on_accept true, disable_product_when_out false, confirmation_timeout_hours 24, label_size `a6`, notify flags all true); `resolve_route(store_id, environment, wilaya_code: str) -> tuple[CarrierAccount|None, CarrierAccount|None]` (most specific route containing the wilaya by priority, else default route with empty list, else the only active account).
- Endpoints: `GET/PUT /shipping/settings`; `GET/POST /shipping/routes`, `PUT/DELETE /shipping/routes/{id}`. Validation: enums exact; `hold_minutes` 0–1440; `retry_max` 0–20; `retry_interval_minutes` 1–1440; `confirmation_timeout_hours` 1–168; `low_stock_days` 1–60; route `wilaya_codes` each a 2-digit code 01–58 (use `app/core/algeria_geo`), carrier ids must belong to same store/env, fallback ≠ primary.

- [ ] **Step 1: Failing tests:** `test_defaults_returned_when_none_saved` (exact default values above); `test_put_rejects_unknown_policy` (422); `test_route_resolution_specific_then_default` (route A `["16"]`, default route B → wilaya `"16"` resolves A, `"31"` resolves B); `test_route_rejects_foreign_carrier` (422); `test_settings_audit_logged`.
- [ ] **Step 2–5:** Run FAIL → implement → PASS → commit `feat(shipping): shipping settings and routing API`.

### Task 5: Inventory service and API

**Files:**
- Create: `api/app/services/inventory_service.py`, `api/app/api/v1/inventory.py`
- Modify: `api/app/services/carrier_account_service.py` (wire `on_linked` to `InventoryService.import_carrier_stock`), `api/app/api/v1/router.py`
- Test: `api/tests/test_inventory.py`

**Interfaces:**
- Produces `InventoryService(db)`:
  - `normalize_sku(sku: str|None) -> str|None` (strip, casefold, collapse inner whitespace; empty → None).
  - `import_carrier_stock(account: CarrierAccount, stock: list[StockInfo]) -> None` (create/attach `Product(fulfillment="carrier")` by normalized SKU per store, create `ProductCarrierLink`, set `StockLevel.on_hand`, write `StockMovement(reason="sync")` with the delta).
  - `match_items(store_id, items: list[OrderItem]) -> tuple[list[tuple[OrderItem, Product]], list[OrderItem]]` (matched, unmatched).
  - `available(product_id, warehouse_id|None) -> int` (= on_hand − reserved).
  - `reserve(shipment, allocations: list[tuple[Product, UUID|None, int]]) -> None`, `release(shipment) -> None`, `consume(shipment) -> None` (on_hand −= qty, reserved −= qty), `restock(shipment) -> None` (on_hand += qty). Each writes `StockMovement` with `shipment_id`; quantities per shipment are stored in `Shipment.allocations` (Task 2).
  - `is_low(product) -> bool` using `low_stock_days` and 14-day average daily quantity from `order_items` of shipped orders.
  - `receive_deposit(deposit) -> None` (status → `received`, on_hand += lines, movements `deposit`), then calls hook `on_stock_increased(product_ids)` (Task 7 fills it for backorders).
- Endpoints (prefix `/inventory`): `GET/POST /products`, `PUT /products/{id}` (name, fulfillment, weight), `POST /products/{id}/links`, `GET /products/unmapped` (distinct normalized SKU/name from items of shipments held `unmapped_product`), `GET /stock` (per product: per-location on_hand/reserved/inbound, totals, `is_low`, `status` ∈ `ok|low|out|merchant|unmapped`), `GET/POST /deposits`, `POST /deposits/{id}/status` (`in_transit|counting|received`), `GET /movements` (paginated, newest first). Scopes `inventory:read` / `inventory:write`.

- [ ] **Step 1: Failing tests:** `test_sku_match_is_case_and_space_insensitive` (item sku `" snk-blk-42 "` matches product `"SNK-BLK-42"`); `test_reserve_then_release_restores_available`; `test_reserve_beyond_available_raises` (`InsufficientStock`); `test_consume_and_restock_write_movements` (two movements, deltas −1 and +1); `test_import_carrier_stock_creates_products_and_links` (sandbox stock → 3 products, `fulfillment=="carrier"`); `test_deposit_received_increases_on_hand`; `test_stock_status_values` (out when available 0, low by days, merchant for merchant products); `test_inventory_isolated_by_store`.
- [ ] **Step 2–5:** FAIL → implement → PASS → commit `feat(inventory): products, stock reservation, deposits and movements`.

### Task 6: Shipment creation from decisions and confirmations

**Files:**
- Create: `api/app/services/shipping_service.py`, `api/app/services/outcome_service.py`
- Modify: `api/app/api/v1/order_outcomes.py` (delegate to `record_outcome`, keep HTTP behaviour; existing `tests/test_order_outcome.py` must stay green)
- Modify: `api/app/services/order_service.py` (after `enqueue_for_order(...)`, call `ShippingService(self.db).on_decision(order, merchant, risk_result.decision)`), `api/app/services/confirmation_service.py` (`apply_confirmation`: on `confirmed` → `ShippingService.on_confirmed(order)`; on `cancelled` → `on_cancelled(order)`)
- Test: `api/tests/test_shipping_service.py`

**Interfaces:**
- Consumes: Tasks 4, 5.
- Produces `outcome_service.record_outcome(db, order, outcome_status: str, *, source: str, reason: str|None = None, note: str|None = None, occurred_at: datetime|None = None) -> OrderOutcome` raising `OutcomeExists` / `ValueError` (same checks as the current endpoint, including the status map and `RiskEvaluationService.record_from_outcome`).
- Produces `ShippingService(db)`:
  - `on_decision(order, merchant, decision: RiskDecision) -> Shipment|None`. Returns None when the store has no linked carrier account in that environment, or when `order.created_at < first_linked_at`. `store_id is None` → shipment with `hold_reason="no_store"`. REVIEW → `review`; REJECT → `rejected`. ALLOW → if `confirmation_applies(merchant)` and trigger `after_confirmation` → `hold_reason="awaiting_confirmation"`, else `hold_reason=None, next_attempt_at=now+hold_minutes`. ALLOW with `reserve_on_accept` calls `allocate_and_reserve` immediately.
  - `confirmation_applies(merchant) -> bool` = `merchant.whatsapp_confirmation_enabled and "allow" in merchant.whatsapp_confirmation_decisions.split(",")`.
  - `allocate_and_reserve(shipment) -> None`: matches items (Task 5); unmatched → `hold_reason="unmapped_product"`; mix of merchant+carrier products → `mixed_source`; carrier products: choose carrier via `resolve_route` on the order's wilaya code, then the first active warehouse of that carrier holding every line (warehouse in same wilaya first, then others by name); none → apply policy (`hold` → `out_of_stock`; `backorder` → `out_of_stock` with `next_attempt_at=None` and flag `backorder=True` in `Shipment.meta`; `other_warehouse` → try the fallback carrier's warehouses, else `out_of_stock`); success → `reserve`.
  - `on_confirmed(order)`: clears `awaiting_confirmation` / `no_answer`, sets `next_attempt_at=now+hold_minutes`.
  - `on_cancelled(order)`: active shipment `pending_dispatch` → `cancelled` + `release`; `accepted` → adapter `cancel_shipment` when `capabilities.cancel`, then `cancelled` + `release`; later statuses → Notification `shipment.cancel_after_pickup` only.
  - `expire_unconfirmed(now) -> int`: shipments `awaiting_confirmation` older than `confirmation_timeout_hours` → `no_answer`; also releases `awaiting_confirmation` when `confirmation_applies` became false or trigger changed to `on_allow`.
  - `approve(shipment, actor_key)`, `reject(shipment, actor_key)` (cancels shipment, `release`, order → cancelled via `record_outcome(..., "cancelled", source="merchant", reason="risk_decision")`), `restore(shipment, actor_key)` (only `hold_reason=="rejected"` and order not cancelled), `archive(shipment, actor_key)`, `dispatch_from(shipment, warehouse_id, actor_key)` (warehouse must belong to route primary/fallback; never valid while `hold_reason in {"review","rejected"}`). Each writes AuditLog `shipment.<action>`.

- [ ] **Step 1: Failing tests:** `test_review_and_reject_are_held` (hold_reason `review`/`rejected`, `next_attempt_at is None`); `test_allow_without_confirmation_is_due_after_hold` (confirmation off → hold_reason None, `next_attempt_at == created+15min`); `test_allow_with_confirmation_waits` (`awaiting_confirmation`); `test_confirmation_releases_and_cancel_cancels`; `test_unconfirmed_moves_to_no_answer_after_24h`; `test_trigger_change_releases_awaiting_confirmation`; `test_orders_before_first_link_get_no_shipment`; `test_no_store_order_held`; `test_unmapped_and_mixed_source_holds`; `test_out_of_stock_policies` (parametrized hold / backorder / other_warehouse outcomes); `test_reject_records_risk_decision_outcome_not_bad` (`is_bad_outcome` False); `test_dispatch_from_refused_for_review`.
- [ ] **Step 2–5:** FAIL → implement → PASS (plus full suite) → commit `feat(shipping): create and hold shipments from decisions`.

### Task 7: Dispatch worker

**Files:**
- Create: `api/app/services/dispatch_service.py`, `api/scripts/dispatch_shipments.py`
- Modify: `compose.ec2.yaml` (worker loop: add `python -m scripts.dispatch_shipments || echo "Shipment dispatch batch failed; retrying";` after the WhatsApp step), `api/app/services/inventory_service.py` (`on_stock_increased` → release backorders)
- Test: `api/tests/test_dispatch_worker.py`

**Interfaces:**
- Produces `DispatchService(db, clock=utcnow)`: `run_batch(limit: int = 50) -> dict[str,int]` (`dispatched`, `retried`, `failed`, `fell_back`). Selects `status=="pending_dispatch" and hold_reason is None and next_attempt_at <= now` with `with_for_update(skip_locked=True)` (no-op on SQLite). Re-checks hold rules (`expire_unconfirmed` first). Builds `ShipmentRequest` from order + recipient (phone from `phone_identifier.phone`, address/wilaya/commune from `address_identifier`), `cod_amount = order.total_amount`, `delivery_type/stop_desk_id` from order. On success: `accepted`, tracking, label_url, `dispatched_at`, ShipmentEvent(`accepted`, source `manual`/`poll`), webhook event `order.shipment.updated`. `CarrierUnavailable` → `attempts += 1`, `next_attempt_at = now + retry_interval * 2**(attempts-1)` capped at 24h; when `attempts >= retry_max` and `fallback_enabled` and fallback exists → switch carrier, reset attempts once (`meta.fell_back=True`); else `dispatch_failed` + `release` + Notification `shipment.dispatch_failed`. `CarrierValidationError` → `dispatch_failed` immediately with `last_error` (carrier message, max 500 chars) + Notification.
- `scripts/dispatch_shipments.py:main()` opens a session, runs one batch, commits, prints counts (same shape as `scripts/retry_store_backlog.py`).

- [ ] **Step 1: Failing tests:** `test_held_shipments_never_dispatched` (review/rejected/awaiting/out_of_stock rows untouched after `run_batch`); `test_due_allow_dispatches_with_tracking`; `test_dispatch_is_idempotent_on_retry_after_crash`; `test_unavailable_backs_off_then_falls_back`; `test_validation_error_fails_with_message_and_releases_stock`; `test_backorder_released_when_deposit_received`; `test_webhook_event_enqueued_on_accept`.
- [ ] **Step 2–5:** FAIL → implement → PASS → commit `feat(shipping): dispatch worker with retry and fallback`.

### Task 8: Outcomes service, tracking ingestion, sync workers

**Files:**
- Create: `api/app/services/tracking_service.py`, `api/app/api/v1/carrier_webhooks.py`, `api/scripts/sync_shipments.py`, `api/scripts/sync_inventory.py`
- Modify: `api/app/api/v1/router.py`, `compose.ec2.yaml` (loop: `sync_shipments` and `sync_inventory`, each gated by a timestamp file under `/tmp` so they run every 30 min / 60 min)
- Test: `api/tests/test_tracking.py`, existing `api/tests/test_order_outcome.py` must still pass

**Interfaces:**
- Consumes: `outcome_service.record_outcome` (Task 6).
- Produces `TrackingService(db).apply_events(shipment, events: list[TrackingEvent], source: str) -> int` (inserts new events by `dedupe_key`, ignoring duplicates; advances `status` only when `STATUS_RANK[new] > STATUS_RANK[current]`; on `picked_up` sets `order.status = shipped`; on `delivered` → `consume` + `record_outcome(order,"delivered", source="carrier")` unless an outcome exists; on `returned` → `restock` always + `record_outcome(order,"returned", source="carrier", reason="customer_refused")` unless an outcome exists; enqueues webhook `order.shipment.updated`; notifications per settings flags).
- `POST /carriers/{carrier_code}/webhook/{account_id}` (no API key; adapter `parse_webhook` verifies; unknown account → 404; bad signature → 401; returns `{"accepted": n}`).
- `scripts/sync_shipments.py` polls active shipments (`accepted..returning`) via `get_tracking`; `scripts/sync_inventory.py` calls `import_carrier_stock` for each active account and then `on_stock_increased`.

- [ ] **Step 1: Failing tests:** `test_duplicate_events_ignored`; `test_late_in_transit_after_delivered_is_logged_not_applied`; `test_delivered_records_outcome_and_consumes_stock`; `test_returned_restocks_even_with_manual_outcome` (manual outcome kept unchanged, stock +qty); `test_picked_up_marks_order_shipped`; `test_carrier_webhook_bad_signature_401`; `test_sync_shipments_advances_sandbox_by_clock`.
- [ ] **Step 2–5:** FAIL → implement → PASS (full suite) → commit `feat(shipping): tracking ingestion, carrier webhook, sync workers`.

### Task 9: Shipments and pending-decision API, dashboard proxy

**Files:**
- Create: `api/app/api/v1/shipments.py`, `api/app/api/v1/shipping_pending.py`
- Modify: `api/app/api/v1/router.py`, `control-plane/app/api/dashboard_proxy.py` (`_ALLOWED` += patterns below; forward `X-Ordium-Store-ID` for `/shipping/` and `/inventory/` paths)
- Test: `api/tests/test_shipments_api.py`, `control-plane/tests/test_dashboard_proxy_shipping.py`

**Interfaces:**
- Endpoints: `GET /shipping/shipments?status=&source=&q=&page=&limit=` → `{data, counts:{all, ready, transit, out, done, ret, fail}, pagination}` where `ready = pending_dispatch(no hold)+accepted`, `transit = picked_up+in_transit`, `out = out_for_delivery+delivery_attempt_failed`, `done = delivered`, `ret = returning+returned`, `fail = dispatch_failed`; `GET /shipping/shipments/{id}` (with `events` newest first, `order` summary, `allocations`); `POST /shipping/shipments` (`{order_id}` manual dispatch; refused 409 for `review/rejected` holds); `POST /shipping/shipments/{id}/retry`; `POST /shipping/shipments/{id}/cancel`; `GET /shipping/next-pickups` (per carrier: next pickup time from account settings `meta.pickup_time` default `"14:00"`, parcel counts split merchant/warehouse); `GET /shipping/pending?reason=review|stock|rejected` (`review` includes `review` + `no_answer` + `unmapped_product` + `mixed_source` + `no_store`; `stock` = `out_of_stock`) with risk reasons from the latest `RiskAssessment` events; `POST /shipping/pending/{shipment_id}/{approve|reject|restore|archive}`; `POST /shipping/pending/{shipment_id}/dispatch-from` `{warehouse_id}`. Read scopes `shipping:read`, writes `shipping:write`.
- Proxy patterns: `^/shipping/(carriers|routes)(?:/[0-9a-fA-F-]{36}(?:/(test|disable|warehouses))?)?$`, `^/shipping/settings$`, `^/shipping/shipments(?:/[0-9a-fA-F-]{36}(?:/(retry|cancel))?)?$`, `^/shipping/next-pickups$`, `^/shipping/pending(?:/[0-9a-fA-F-]{36}/(approve|reject|restore|archive|dispatch-from))?$`, `^/inventory/(products|stock|deposits|movements)(?:/[0-9a-fA-F-]{36}(?:/(links|status))?)?$`, `^/inventory/products/unmapped$`.

- [ ] **Step 1: Failing tests:** `test_counts_match_status_groups`; `test_shipments_isolated_by_env_store_merchant`; `test_manual_dispatch_refused_for_review_hold`; `test_pending_lists_by_reason_with_risk_reasons`; `test_approve_makes_due_and_reject_cancels`; control-plane `test_shipping_paths_allowed_and_others_404`.
- [ ] **Step 2–5:** FAIL → implement → PASS (api + control-plane suites) → commit `feat(shipping): shipments and pending-decision API`.

### Task 10: Frontend API client and types

**Files:**
- Create: `web/src/lib/api/shipping.ts`, `web/src/lib/api/inventory.ts`
- Modify: `web/src/lib/api/types.ts`, `web/src/lib/api/index.ts`

**Interfaces:**
- Produces typed functions using `ordiumFetch` with `dashboard/` paths exactly matching Task 9: `shippingApi.{listCarriers, linkCarrier, testCarrier, disableCarrier, deleteCarrier, listWarehouses, getSettings, updateSettings, listRoutes, createRoute, updateRoute, deleteRoute, listShipments, getShipment, dispatchOrder, retryShipment, cancelShipment, nextPickups, listPending, pendingAction(id, action, body?)}` and `inventoryApi.{listProducts, createProduct, updateProduct, linkProduct, listUnmapped, getStock, listDeposits, createDeposit, setDepositStatus, listMovements}`. Types: `ShipmentStatus` union of the 11 statuses, `HoldReason` union, `Shipment`, `ShipmentEvent`, `CarrierAccount`, `ShippingSettings`, `ShippingRoute`, `PendingItem`, `StockRow`, `Deposit`, `Movement`.

- [ ] **Step 1:** Write the modules. **Step 2:** `cd web && npm run lint` → PASS. **Step 3:** Commit `feat(web): shipping and inventory API client`.

### Task 11: Sidebar, Shipments view and shipment drawer

**Files:**
- Create: `web/src/components/dashboard/ShipmentsView.tsx`, `ShipmentDetailDrawer.tsx`, `ShipmentStatusBadge.tsx`
- Modify: `web/src/components/dashboard/DashboardSidebar.tsx` (`DashboardTab` += `'pending' | 'shipments' | 'inventory'`; groups: Orders = orders, confirmation, pending; new group `dashboard.sidebar.group_shipping` = shipments (`Truck`), inventory (`Package`); pending icon `Clock`), `DashboardLayout.tsx` (titles + render), i18n files
- Visual reference: artboards `Main.dc.html`, `Tracking.dc.html` in the mockup; styling only from existing classes/tokens.

**Interfaces:**
- `ShipmentStatusBadge({status}: {status: ShipmentStatus})` — reused by Tasks 12–13; colours: success=`--ordium-success` (delivered), warning (out_for_delivery, delivery_attempt_failed), danger (returned, returning, dispatch_failed), signal (in_transit, picked_up), muted (pending_dispatch, accepted, cancelled).
- ShipmentsView: header (title, description, "print my labels", "manual dispatch"), next-pickups strip, failed-dispatch alert linking to `fail` tab, status tabs with counts, search + source filter, table (wilaya code, destination+customer, order, carrier+source, tracking, status, updated, COD) that stacks on phones via existing `ordium-stack-table`, empty/loading/error states, LIVE empty state when `available` carriers is empty (`shipping.empty.no_carriers_live`). Row click opens ShipmentDetailDrawer (stages bar, event log, parcel facts, Ordium decision, actions refresh/label/cancel).

- [ ] **Step 1:** Implement. **Step 2:** `npm run lint && npm run build` PASS. **Step 3:** Run `node scripts/check-i18n.mjs` if present, else `python3 -c` key-diff of the three JSON files → no missing keys. **Step 4:** Commit `feat(web): shipments page and shipment drawer`.

### Task 12: Pending-decision view

**Files:** Create `web/src/components/dashboard/PendingView.tsx`; modify `DashboardLayout.tsx`, i18n files. Visual reference `Pending.dc.html`.

**Interfaces:** Consumes `shippingApi.listPending`, `pendingAction`. Tabs `review | stock | rejected` with counts; each row: risk score box (or available qty for stock), customer, order link (opens existing `OrderDetailDrawer`), wilaya · COD · age, reasons list (risk signals from API or hold-reason copy `pending.reason.<hold_reason>`), actions: review → approve/no-answer (existing `recordConfirmationAttempt` with `no_answer`)/reject; stock → dispatch-from (select of warehouses with stock)/wait/cancel; rejected → restore/archive. Confirm dialog only for reject/archive (existing `Modal`). "older than 48 h" counter; sort select.

- [ ] Implement → `npm run lint && npm run build` → i18n key check → commit `feat(web): pending-decision queue`.

### Task 13: Inventory view

**Files:** Create `web/src/components/dashboard/InventoryView.tsx`; modify `DashboardLayout.tsx`, i18n files. Visual reference `Inventory.dc.html`.

**Interfaces:** Consumes `inventoryApi`. Unmapped alert (count from `listUnmapped`, opens a link dialog using `linkProduct`), locations strip (per warehouse + "with me"), tabs products/deposits/movements, filters, products table (product+SKU, where with per-location qty, available, reserved, inbound, cover days, status badge), deposit create form (warehouse, lines sku+qty), movements list. Buttons "sync now" (calls `/inventory/stock?refresh=1`, add that query flag in Task 5 if missing) and "deposit to warehouse".

- [ ] Implement → lint/build → i18n check → commit `feat(web): inventory page`.

### Task 14: Shipping settings panels

**Files:** Create `web/src/components/dashboard/settings/CarriersPanel.tsx`, `DispatchSettingsPanel.tsx`, `StockSettingsPanel.tsx`, `PickupSettingsPanel.tsx`, `TrackingSettingsPanel.tsx`; modify `SettingsView.tsx` (new group `settings.group.shipping` between store and account with the five items and statuses: carriers "N connected", stock "N low"), i18n files. Visual reference `Settings.dc.html`.

**Interfaces:** Uses existing `Switch`, `settings-card`, `settings-list`, `settings-check`, `settings-input`, `settings-note`, `settings-actions`, `settings-feedback`. Dispatch panel includes the note that delivery type/price/fees come from each order; routes editor (wilaya multi-select from `web/src/lib/algeriaData.ts`, carrier, fallback); failure retries; trigger radio; hold minutes; confirmation timeout hours. Stock panel: three out-of-stock radios, low-stock days, reserve on accept, disable product when out. Save with existing feedback pattern.

- [ ] Implement → lint/build → i18n check → commit `feat(web): shipping settings`.

### Task 15: End-to-end verification

- [ ] **Step 1:** `cd api && python -m pytest -q` → all pass (report counts).
- [ ] **Step 2:** `cd control-plane && python -m pytest -q` → all pass.
- [ ] **Step 3:** `cd web && npm run lint && node --test proxy-utils.test.mjs && npm run build` → pass.
- [ ] **Step 4:** Sandbox flow in a TEST container against a scratch SQLite DB: link sandbox, create ALLOW order with confirmation off, run `dispatch_shipments`, advance `SANDBOX_CLOCK` 50h, run `sync_shipments` → order status `delivered`, outcome `source=carrier`, stock consumed.
- [ ] **Step 5:** Update `deploy/ec2/README.md` (new worker steps, sandbox TEST-only, migration `f3c9a1d7e2b5`). Commit `docs: shipping workers and migration notes`.
