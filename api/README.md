# ORDIUM API

ORDIUM is a multi-tenant fraud and fake-order risk API for e-commerce, initially focused on Cash on Delivery workflows.

## Core flow

```text
Store
  -> API Key authentication
  -> Order intake
  -> Identity resolution
  -> Risk Engine
  -> Risk Assessment + explainable Risk Events
  -> Real Order Outcome
  -> Production-only Risk Evaluation metrics
```

## Risk decisions

- `0-49` -> `allow`
- `50-79` -> `review`
- `80-100` -> `reject`

These are heuristic risk scores, not probabilities.

## Production data boundaries

Every API key is either:

- `live`
- `test`

Orders also carry:

- `environment`: `live` or `test`
- `data_origin`: `real`, `test`, `synthetic`, `imported`, or `manual`

Only `live + real` orders are eligible for production risk-performance evaluation and future ML labels.

## Idempotency

`POST /api/v1/orders` accepts:

```http
Idempotency-Key: <unique-key>
```

A repeated request with the same key and the same payload returns the original response instead of creating another order. Reusing the key with a different payload is rejected.

## API

The authoritative interactive schema is exposed by FastAPI at `/openapi.json` when `ENABLE_DOCS=true`. The current tenant-facing routes include:

```text
POST /api/v1/orders
GET  /api/v1/orders
GET  /api/v1/orders/{order_id}
POST /api/v1/orders/{order_id}/outcome
PUT  /api/v1/orders/{order_id}/outcome
GET  /api/v1/risk-profile
PATCH /api/v1/risk-profile
GET  /api/v1/metrics/summary
GET  /api/v1/metrics/risk-performance
GET  /api/v1/metrics/risk-calibration
GET  /api/v1/metrics/risk-attribution
GET  /api/v1/metrics/risk-backtest
GET  /api/v1/metrics/risk-quality
GET  /api/v1/identity-graph
GET  /api/v1/risk-features
GET  /api/v1/api-keys
POST /api/v1/api-keys
POST /api/v1/api-keys/{api_key_id}/revoke
POST /api/v1/api-keys/{api_key_id}/rotate
GET  /api/v1/webhooks
POST /api/v1/webhooks
POST /api/v1/webhooks/{endpoint_id}/disable
POST /api/v1/webhooks/{endpoint_id}/test
GET  /api/v1/notifications
POST /api/v1/notifications/read-all
POST /api/v1/notifications/{notification_id}/read
GET  /api/v1/audit-logs
```

Authentication uses:

```http
Authorization: Bearer <ordium_live_...>
```

Test keys use the `ordium_test_...` prefix.

## Development

Create and activate Python 3.13 virtual environment, then install the project with test dependencies:

```bash
python -m venv .venv
.venv\Scripts\activate
python -m pip install -e ".[test]"
```

Create `.env` from `.env.example`, then run:

```bash
alembic upgrade head
uvicorn app.main:app --reload
```

Run tests with:

```bash
python -m pytest -q
```

Tests use an isolated SQLite database and never inherit the application's real `DATABASE_URL`.

## Middleware architecture

Cross-cutting HTTP behavior lives under `app/middleware/`:

- `RequestLoggingMiddleware` — structured access logs without authorization headers or request bodies.
- `RequestIDMiddleware` — validates/generates `X-Request-ID` and returns it on every HTTP response.
- `RequestSizeLimitMiddleware` — enforces request-size limits for both declared and chunked request bodies.
- `SecurityHeadersMiddleware` — applies cache/security headers consistently, including middleware-generated error responses.

Authentication and API-key rate limiting remain FastAPI dependencies because they require authenticated tenant/API-key context and database state. Business logic remains inside services and repositories.

## Database

Alembic migrations are stored under `migrations/`. Always review the migration plan before applying migrations to a real PostgreSQL database.

## Security notes

- Never commit `.env`.
- API keys are stored hashed and are never stored in plaintext.
- Test data must not be used as production performance or ML labels.
- Merchant isolation is required for every tenant-facing query.

## Risk intelligence layers

ORDIUM combines merchant-scoped historical signals with cross-merchant reputation signals that are used internally without exposing another merchant's data. Current layers include:

- identity reuse across phone, device, address, and customer relationships
- multi-window velocity and burst detection
- duplicate-order pattern detection
- external network intelligence (optional IPQS provider)
- cross-merchant phone/device/IP reputation based only on real evaluated outcomes
- immutable risk feature snapshots for future model training and auditability

Network reputation is conservative by design: a global signal requires a minimum amount of real historical outcome data and multiple merchants before contributing risk.

## Network provider

The default provider is `mock`. For production, configure a real provider such as IPQS through environment variables without changing the Risk Engine interface. External provider failures are fail-safe and do not block order creation.

## Trusted reverse proxies

ORDIUM does not trust `X-Forwarded-For` by default. Set `TRUSTED_PROXY_NETWORKS` to a comma-separated list of proxy CIDRs when the API is deployed behind a trusted reverse proxy.

## Production hardening

ORDIUM API v1 is designed for server-to-server use.

### Environment isolation

Use `ordium_live_*` API keys for production traffic and `ordium_test_*` keys for sandbox traffic. Test traffic is excluded from live risk history, production evaluation metrics, and future ML labels.

### Trusted proxies

Set `TRUSTED_PROXY_NETWORKS` only to the CIDR ranges of infrastructure you control. ORDIUM ignores forwarded client-IP headers from untrusted peers.

### Rate limiting

Authenticated requests are rate-limited per API key. Response headers expose `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`. Production limits are configured by environment variables.

### Idempotency

Order creation supports `Idempotency-Key`. The key is scoped to the merchant and API-key environment and is retained for the configured TTL.

### Production checklist

1. Run `python -m pip install -e ".[test]"` in Python 3.13.
2. Run `alembic upgrade head` against a dedicated PostgreSQL database.
3. Set `SECRET_KEY` to a random value of at least 32 characters.
4. Set `ENABLE_DOCS=false` unless public API documentation is intentionally exposed.
5. Configure `TRUSTED_PROXY_NETWORKS` only when running behind a trusted reverse proxy.
6. Configure `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` explicitly.
7. Configure a real network-intelligence provider and its timeout/cache settings.
8. Run `python -m pytest -q` before deployment.
9. Verify that the deployed reverse proxy/load balancer is included in `TRUSTED_PROXY_NETWORKS` before relying on forwarded client IPs.


## API key scopes

API keys are least-privilege by default. Supported scopes are:

- `orders:write`
- `outcomes:write`
- `metrics:read`
- `risk_profile:read`
- `risk_features:read`
- `keys:manage`
- `webhooks:manage`
- `audit:read`

A key may create child keys only with a subset of its own scopes. Rotate legacy keys after migration so production credentials follow least-privilege access.

## P4 platform controls

ORDIUM API v1.4 adds commercial API platform primitives without coupling them to the risk engine:

- API key lifecycle: create, list, rotate, revoke. Raw API keys are returned only at creation/rotation time and are stored hashed.
- Audit log: tenant-scoped immutable operational records for sensitive actions. Secrets and request bodies are never logged.
- Webhooks: merchant-scoped endpoints with encrypted signing secrets and an outbox delivery queue. Webhook delivery is intentionally outside the order request path.
- Feature registry: versioned definitions for risk features used by the feature snapshot and future ML pipeline.
- Identity confidence: explicit confidence and match reasons are recorded with the order and risk assessment.
- Relational fraud graph: phone/device/address/IP/customer relationships are summarized from PostgreSQL without introducing a separate graph database. Raw IP values are not stored in feature snapshots or graph summaries.

### Webhook delivery

Pending deliveries are dispatched by: `python scripts/dispatch_webhooks.py`. Use a scheduler/worker in production. Each delivery is signed with `X-ORDIUM-Signature` and identifies the event in `X-ORDIUM-Event`. Failed deliveries retry with exponential backoff and eventually move to `failed`.

### API key lifecycle

The plaintext key is returned only by create/rotate. Rotate a key before deployment changes and revoke keys that are no longer trusted. Management endpoints require `keys:manage`, and child keys cannot receive scopes that exceed the permissions of their parent key. A key cannot revoke itself.

### PostgreSQL production verification

The test suite has an optional PostgreSQL integration test. Configure `TEST_POSTGRES_DATABASE_URL` in a dedicated disposable/test database and run `python -m pytest -q`. Do not point tests at production.


## Security hardening in v1.4
- Merchant-level rate limiting in addition to per-API-key limits.
- Production configuration fails closed for debug/docs/SQLite/mock network intelligence.
- Trusted proxy client-IP extraction walks the forwarded chain from the nearest hop.
- Webhook delivery validates and pins the resolved public IP for each attempt, disables redirects and environment proxies, and preserves TLS SNI/hostname validation.
- Global cross-merchant reputation events expose only abstract signal strength to merchants; raw cross-merchant counts remain internal.
- Invalid object identifiers fail with 4xx responses instead of internal errors.
- Third-party IPQS credentials are sent in the supported header instead of the request URL.

## Business and product context

Orders can optionally include line items. Merchant provisioning stores a normalized primary business category and optional secondary categories. Contextual risk signals compare order quantity/value against the merchant/category historical distribution rather than assigning risk solely from the business type.

## Store isolation

A merchant can manage multiple stores from the same account. Each live customer API key is bound to exactly one store. Orders ingested with that key inherit the store automatically; the dashboard can also select a store and view its orders, risk metrics, notifications, Identity Graph, webhooks, and API credentials independently.

The dashboard's internal system credential is not store-bound so it can create stores and issue store-scoped customer credentials. The TEST credential is internal to the Simulator and is not exposed as a platform-wide environment.

Store management endpoints:

- `GET /api/v1/stores`
- `POST /api/v1/stores`
- `PATCH /api/v1/stores/{store_id}`
- `GET /api/v1/api-keys?store_id={store_id}`
- `POST /api/v1/api-keys` with `store_id`
- `GET /api/v1/orders?store_id={store_id}`
- `GET /api/v1/metrics/summary?store_id={store_id}`
