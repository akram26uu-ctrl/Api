# ORDIUM API — Deep Security / Red-Team Review

Assessment date: 2026-09-14
Build: post-P4 deep security hardening + cross-environment isolation hardening

## Scope

- API authentication and API-key lifecycle
- Scope enforcement and privilege escalation
- LIVE/TEST environment isolation
- Merchant tenant isolation
- Order idempotency and duplicate creation races
- Order outcome concurrency
- Webhook SSRF / redirects / DNS rebinding / replay metadata / delivery races
- Rate limiting and multi-key bypass
- Network intelligence resource exhaustion
- Identity resolution and global reputation boundaries
- Risk/analytics data leakage
- Input validation and resource limits
- Middleware security
- Database/migration integrity
- Dependency security posture
- Static dangerous-code scan
- Runtime production fail-closed configuration

## Verification

- `pytest -q -W error`: **76 passed, 1 skipped**
- `python -m compileall -q app migrations scripts tests`: **PASS**
- PostgreSQL dialect offline migration generation: **PASS**
- Alembic: **single head f6a9c2e4b7d1**
- Static scan: no eval/exec/pickle/yaml unsafe loader/shell execution found
- PostgreSQL live concurrency suite: **NOT EXECUTED** because `TEST_POSTGRES_DATABASE_URL` is not configured
- `pip-audit` executable was not available in the current execution environment

## Additional issues found and fixed in this review

### HIGH — TEST key could manage LIVE keys

A `test` API key with `keys:manage` could previously list/revoke/rotate `live` keys of the same merchant. Rotation could issue a new live secret to a test credential.

Fix:
- TEST keys can only manage TEST keys.
- LIVE keys may manage both environments.
- Added adversarial tests for list/revoke/rotate.

### HIGH — Webhooks were not environment scoped

Webhook endpoints previously belonged only to a merchant. A TEST order could therefore enqueue a delivery to a LIVE webhook endpoint, and a TEST control-plane key could disable/list LIVE webhooks.

Fix:
- `webhook_endpoints.environment`
- `webhook_deliveries.environment`
- endpoint creation/list/disable is environment-aware
- enqueue selects matching merchant + environment
- migration backfills existing endpoints as LIVE
- adversarial tests verify TEST traffic cannot reach LIVE webhooks

### HIGH — Analytics/audit environment leakage

Audit logs were queried by merchant only, allowing a credential from one environment to view records from the other. Risk metrics were also reachable through TEST credentials even though evaluations are production-only.

Fix:
- Audit reads are scoped to `merchant_id + environment`.
- Risk performance/calibration endpoints require a LIVE API key.
- Added cross-environment adversarial tests.

### MEDIUM — Production dependency floor was stale

The execution environment contained FastAPI 0.128.2, Starlette 0.50.0, cryptography 46.0.4, and pydantic-settings 2.14.1. Current security advisories require newer floors for safe fresh production installs.

Fix:
- FastAPI >= 0.133.1
- Starlette >= 1.3.1
- cryptography >= 50.0.0
- pydantic-settings >= 2.14.2
- production startup now fails closed if installed versions are below the secure floors
- security dependencies include `pip-audit` and `bandit`

Current advisories include Starlette issues affecting versions below 1.3.1 and cryptography issues fixed in 48.0.1/49.0.0/50.0.0 depending on the advisory; pydantic-settings versions 2.12.0–2.14.1 are affected by a secrets-directory symlink issue fixed in 2.14.2.

### MEDIUM — External network provider resource exhaustion

IPQS lookups could occupy all application worker threads under sustained concurrent traffic.

Fix:
- bounded concurrent lookup semaphore
- fail-safe response when the provider concurrency budget is exhausted
- bounded LRU cache retained

### LOW — Oversized User-Agent / outcome source could cause DB errors

Unbounded header/data strings could turn malformed inputs into server errors at persistence time.

Fix:
- truncate User-Agent to the DB-safe maximum
- validate outcome `source` maximum length at schema boundary

## Security invariants now enforced

- A TEST key cannot access LIVE orders/outcomes/metrics/audit/webhooks/key administration.
- LIVE risk analytics are based only on production-only `risk_evaluations`.
- TEST orders are excluded from production risk history and global reputation.
- Global reputation exposes only abstract reputation signals, not cross-merchant raw data.
- Webhook URLs are revalidated before every delivery; redirects and environment proxy configuration are blocked.
- Webhook delivery pins the validated public IP for the connection.
- API keys are stored as hashes and plaintext is returned only on create/rotate.
- Child keys cannot exceed caller scopes.
- Webhook secrets are encrypted at rest and signed deliveries include timestamp/event/delivery IDs.
- Unhandled errors return opaque server errors with request IDs.
- Request bodies are size-limited, including chunked requests.

## Residual high-priority work

### HIGH — PostgreSQL live concurrency tests

Still required on a dedicated PostgreSQL instance:
- concurrent identical order creation
- concurrent idempotency-key requests
- concurrent outcome submission
- concurrent webhook dispatch workers
- concurrent rate-limit bucket contention
- rollback/retry behavior under database errors
- migration upgrade from the actual deployed revision

### MEDIUM — Resolved dependency lock

The project now has secure minimum constraints but does not include a fully resolved lock artifact.

Production process should:
- create a clean Python 3.13 environment
- resolve dependencies
- generate `uv.lock` (or equivalent constraints lock)
- run `pip-audit` against the resolved environment
- deploy only from the locked environment

### MEDIUM — Global reputation poisoning resistance

Global reputation is based on merchant-supplied outcomes. Minimum distinct-merchant thresholds reduce single-merchant poisoning, but a malicious consortium could still influence reputation.

Future hardening should introduce merchant trust weighting / anomaly detection for outcome feedback before ML training.

### MEDIUM — Webhook signing-secret rotation

Secrets are encrypted using material derived from `SECRET_KEY`. Rotating `SECRET_KEY` currently requires an explicit webhook-secret re-encryption strategy to avoid breaking existing endpoints.

### LOW — Unauthenticated failure throttling

Invalid API-key attempts are cheap to submit but still require a database hash lookup. An edge/WAF or shared unauthenticated-IP throttling layer is recommended before exposing the API directly to the public internet.

## Conclusion

No Critical application-code vulnerability was identified in this review. Several additional High/Medium issues were found and fixed during the review.

Current status: **security-hardened pre-production baseline**.

This is not a formal penetration-test certification and should not be described as "100% secure".

Before public production release, complete the PostgreSQL concurrency suite, resolve and lock dependencies, run `pip-audit` and `bandit` in CI, and perform an external deployment/network test.
