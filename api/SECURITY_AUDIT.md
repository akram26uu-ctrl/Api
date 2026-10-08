# ORDIUM API — Security Assessment

**Assessment date:** 2026-09-14  
**Assessed build:** ORDIUM API v1.4.0  
**Scope:** FastAPI application, middleware, authentication, multi-tenant authorization, Risk API, webhooks, rate limiting, idempotency, audit logging, network intelligence integration, migrations, and test suite.

## Methodology

The assessment was structured around the OWASP API Security Top 10 categories: object-level authorization, authentication, property/function authorization, resource consumption, sensitive business flows, SSRF, security misconfiguration, API inventory, and unsafe third-party API consumption. It also uses OWASP ASVS 5.0 as a verification-oriented reference.

## Automated baseline

- `python -m pytest -q -W error` → **66 passed, 1 skipped**.
- The single skipped test is the PostgreSQL integration test because `TEST_POSTGRES_DATABASE_URL` is not configured in the execution environment.
- `python -m compileall -q app migrations scripts tests` → **PASS**.
- `alembic upgrade head --sql` with non-secret test environment variables → **PASS**.
- Alembic → single head: `b31e7a4c9d22`.
- Static search for dangerous primitives (`eval`, `exec`, shell execution, pickle, unsafe YAML loading) → **none found**.
- Final archive excludes `.env`, `.git`, and test/runtime caches.

## Adversarial checks performed

### Authentication / authorization
- Invalid API keys → rejected with opaque 401 responses.
- Expired API keys → rejected, including handling of database-returned naive timestamps.
- Suspended merchants using otherwise valid keys → rejected.
- Cross-merchant webhook/key access → rejected.
- Invalid object IDs → 4xx rather than 500.
- Test API keys cannot access live metrics or update live outcomes.
- LIVE/TEST data isolation was tested through the risk engine.

### Resource consumption
- Request body size limits cover declared and chunked request bodies.
- Per-API-key rate limiting is enforced.
- Merchant-level rate limiting prevents bypass by spreading requests across multiple API keys.
- List endpoints are bounded.
- Idempotency records prevent duplicate work on retried order creation.

### SSRF / Webhooks
- Private, loopback, link-local, multicast, reserved, and unspecified targets are rejected.
- Userinfo and URL fragments are rejected.
- Redirects are disabled.
- Environment-configured proxies are disabled for webhook delivery.
- DNS is resolved and validated immediately before delivery and the verified public IP is pinned for the connection while TLS validation uses the original hostname.

### Secrets / logging
- API keys are stored hashed and are only returned in plaintext at creation/rotation time.
- Webhook signing secrets are encrypted at rest.
- IPQS credentials are sent through the documented `IPQS-KEY` header rather than appearing in the request URL.
- Production exception logging does not include exception messages/tracebacks unless debug is explicitly enabled.
- API request logging excludes Authorization headers and request bodies.
- Global cross-merchant reputation event payloads no longer expose raw cross-merchant counts to merchants.

### Configuration
Production settings now fail closed when any of the following is true:
- `DEBUG=true`
- API docs are enabled
- `ALLOWED_HOSTS` is empty
- SQLite is configured
- mock network intelligence is configured
- a selected real provider lacks its API key

## Findings fixed during this assessment

1. **High — trusted proxy IP spoofing.** Forwarded headers were previously accepted from the wrong end of the chain. The parser now walks from the nearest trusted hop toward the client and returns the first untrusted address.

2. **Medium — malformed object identifiers causing internal ORM errors.** UUID route parameters are now typed as UUIDs and rejected by FastAPI as client errors.

3. **High — rate-limit bypass using multiple API keys.** Merchant-level throttling is now enforced in addition to per-key limits.

4. **Medium — production misconfiguration risk.** Production now fails closed for unsafe configuration choices.

5. **Medium — third-party credential exposure in URL.** IPQS authentication now uses the documented `IPQS-KEY` header.

6. **Medium — cross-merchant reputation data exposure.** Client-visible global reputation events now expose an abstract signal rather than raw counts of orders/merchants.

7. **Medium — webhook URL userinfo/fragment abuse.** Webhook registration rejects URLs containing embedded credentials or fragments.

8. **Medium — exception secret leakage in production logs.** Production logging now records request ID and exception type without the exception message or traceback.

9. **Low/Medium — unbounded management list responses.** API-key and webhook listing endpoints are now bounded to a maximum of 100 records per response.

10. **Medium — API-key expiration timezone bug.** Authentication now normalizes naive database timestamps before comparison.

## Residual findings / release blockers

### Resolved — Control-plane permissions were previously key-wide
API keys now carry explicit scopes including `orders:write`, `outcomes:write`, `metrics:read`, `risk_profile:read`, `risk_features:read`, `keys:manage`, `webhooks:manage`, and `audit:read`. Management endpoints require the corresponding scope, and a key can only mint child keys whose scopes are a subset of its own permissions. Existing keys receive the legacy full set during migration so they continue working; production deployments should rotate them toward least-privilege scopes.

### HIGH — PostgreSQL integration was not executable in this environment
The full test suite was run against an isolated SQLite test database. The migration chain was rendered successfully using PostgreSQL dialect, but a real PostgreSQL integration/concurrency run was not possible because `TEST_POSTGRES_DATABASE_URL` is not available here. This must be completed before production release.

### MEDIUM — Dependency locking / continuous dependency scanning
`pyproject.toml` currently defines version ranges rather than a fully resolved lockfile. A production build should use a reproducible lock/constraints file and run `pip-audit` (or an equivalent supply-chain scanner) in CI on every release.

### MEDIUM — Webhook destination policy
IP pinning removes the DNS-rebinding gap between validation and connection for each delivery attempt, but ORDIUM still intentionally allows arbitrary public HTTPS webhook destinations. A stronger enterprise posture could add domain verification / customer allowlists.

## Security conclusion

No Critical vulnerability was identified in the reviewed code. The addressed findings materially strengthen authentication, tenant isolation, SSRF defenses, resource controls, configuration safety, and information disclosure.

**The build should not yet be labeled production-secure until the complete suite is run against real PostgreSQL under concurrency and dependency/supply-chain scanning is enabled in CI.**


### Current verification after scope hardening

- `python -m pytest -q -W error`: **68 passed, 1 skipped**.
- The skipped test requires `TEST_POSTGRES_DATABASE_URL` and is the live PostgreSQL integration/concurrency check.
- `python -m compileall -q app tests scripts`: passed.
- Alembic PostgreSQL offline SQL generation: passed; current head is `c4d8e2a1f7b3`.
- `pip-audit` was not available in the execution environment, so dependency CVE scanning remains an external/CI requirement.
- Static scan found no use of `eval`, `exec`, `pickle.loads`, `os.system`, unsafe subprocess shell execution, or unsafe `yaml.load` in application/scripts.
