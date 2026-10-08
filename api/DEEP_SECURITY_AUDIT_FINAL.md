# ORDIUM API — Deep Security Audit Final

Assessment date: 2026-09-14
Build: v1.5.2 post-P4 hardening and final regression review

## Verification

- `python -m pytest -q -W error`: **79 passed, 1 skipped**.
- `python -m compileall -q app migrations scripts tests`: **PASS**.
- PostgreSQL offline migration generation using `postgresql+psycopg`: **PASS** through `f6a9c2e4b7d1`.
- Alembic reports a single head: `f6a9c2e4b7d1`.
- Static dangerous-code scan: no `eval`, `exec`, `pickle.loads`, unsafe YAML loader, `os.system`, or shell execution in application/scripts.
- `pip-audit` and `bandit` are declared as security dependencies but their executables were not installed in this execution environment.
- Real PostgreSQL concurrency suite was not executed because `TEST_POSTGRES_DATABASE_URL` is not configured.

## Issues found and fixed in this final review

### Environment control-plane isolation
API-key and webhook management is now environment-scoped for all operations. A key operating in `live` cannot list, rotate, revoke, or disable `test` resources, and a `test` key cannot touch `live` resources.

### Outcome chronology integrity
`occurred_at` must contain timezone information, cannot be more than five minutes in the future, and cannot precede the order creation time. This prevents poisoning of feedback metrics through impossible timestamps.

### Production configuration hardening
Production rejects wildcard `ALLOWED_HOSTS`, wildcard CORS origins, and `/0` trusted-proxy networks. This reduces misconfiguration-driven host/header trust bypasses.

### Analytics defense in depth
Risk evaluation aggregation is explicitly restricted to `environment='live'` and `data_origin='real'` at the repository layer, even though the public metrics endpoint already requires a live API key.

## Current security invariants

- Merchant tenant isolation is enforced in order/outcome/identity/risk paths.
- LIVE/TEST isolation is enforced in order data, idempotency, rate limiting, audit, metrics, API-key management, webhooks, and feedback evaluation.
- API keys are hashed and plaintext is returned only on create/rotate.
- Child key scopes cannot exceed caller scopes.
- Production configuration fails closed for unsafe provider/docs/database/host/CORS/proxy settings.
- Webhook delivery blocks redirects and environment proxies, validates destinations before delivery, and pins the validated public IP.
- Webhook signing secrets are encrypted at rest.
- Request bodies are size-limited, including chunked bodies.
- Merchant and API-key rate limits are enforced independently.
- Idempotency is merchant/environment scoped and backed by a uniqueness constraint.
- Outcome evaluation accepts only real live production traffic.

## Residual release blockers

1. Run the complete suite against a real dedicated PostgreSQL database, including concurrent order creation, duplicate idempotency requests, concurrent outcomes, webhook workers, and rate-limit contention.
2. Resolve and lock dependencies in a reproducible lock artifact and run `pip-audit`/`bandit` in CI.
3. Define a production key-rotation strategy for encrypted webhook secrets when `SECRET_KEY` rotates.
4. Add global-reputation poisoning controls before using those signals for automated ML decisions.
5. Add edge/WAF throttling for unauthenticated invalid-key traffic if the API is directly internet exposed.

## Conclusion

No critical application-code vulnerability was identified in this review. The remaining blockers are environment/deployment validation items rather than unverified claims of security. This build should be treated as a **pre-production security baseline**, not as a formal penetration-test certification.
