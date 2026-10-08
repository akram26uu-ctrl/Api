# ORDIUM API — Deep Security & Integrity Reassessment

Date: 2026-09-14
Scope: current ORDIUM API source tree from the latest Security-Audit ZIP.

## Test result
- `python -m pytest -q -W error`: 84 passed, 1 skipped.
- `python -m compileall -q app scripts migrations`: PASS.
- Static dangerous-code scan: PASS for eval/exec/pickle/yaml unsafe load/shell execution/verify=False/allow_redirects=True patterns.
- Single Alembic head: `f6a9c2e4b7d1`.
- PostgreSQL integration test: not executed because no `TEST_POSTGRES_DATABASE_URL` is configured.

## Fixed during this reassessment

### High-value integrity fixes
1. Identity confidence no longer treats a newly-created customer as an `exact_name` historical match. A brand-new identity now has zero confidence unless there is historical phone evidence.
2. Identity graph cluster size now counts the union of distinct connected customers rather than summing overlapping relationship counts. This prevents cluster inflation when the same customer appears through phone, device, address and IP.
3. IPQS cache TTL `0` now means cache disabled rather than cache entries becoming effectively permanent.
4. Webhook URL resolution now requires resolved addresses to be globally routable, closing gaps for non-global special-use ranges that are not always classified as private by a simple `is_private` check.

## Security areas reviewed
- Authentication and API-key lifecycle.
- API-key scope enforcement and environment isolation.
- Merchant/tenant authorization.
- LIVE vs TEST separation.
- IDOR/BOLA style object access.
- Rate limiting and multi-key bypass.
- Idempotency race behavior.
- Request ID and request logging.
- Request size controls.
- Trusted proxy / client-IP handling.
- Webhook SSRF, redirects, proxy bypass, DNS resolution, signing and outbox leases.
- Audit-log tenant/environment scoping.
- Global reputation aggregation and privacy boundaries.
- Feature snapshots and risk evaluation integrity.
- Input validation and malformed identifiers.
- Dependency floor enforcement for production runtime.
- Dangerous-code/static source patterns.
- Migration chain integrity and downgrade completeness.

## Remaining risks / required pre-production verification

### 1. Real PostgreSQL integration and concurrency
SQLite-based tests are valuable for application logic but do not certify PostgreSQL behavior. Run a dedicated PostgreSQL test database and execute:

```bash
alembic upgrade head
python -m pytest -q -W error
```

Also run concurrency tests for idempotency, outcome creation, rate limits and webhook claiming.

### 2. Dependency vulnerability scan
The repository declares `bandit` and `pip-audit` security extras, but those scanners were not installed in this execution environment. CI must run both on a clean Python 3.13 environment.

### 3. Webhook encryption-key rotation
Webhook signing secrets are encrypted using a key derived from `SECRET_KEY`. Rotating `SECRET_KEY` without a key-versioning or migration strategy can make existing webhook secrets undecryptable. A dedicated versioned webhook-encryption key should be introduced before frequent secret rotation is supported.

### 4. Risk-profile disclosure
`GET /api/v1/risk-profile` exposes exact system-controlled thresholds and weights. This is not a direct tenant-isolation vulnerability, but it reveals detection policy details that can help adversarial order crafting. Consider making exact policy values internal/admin-only and exposing only coarse capability/status to merchant API consumers.

### 5. Outcome correction model
`OrderOutcome` is one-to-one and the first submitted outcome becomes the evaluation label. There is no correction/version history. For high-integrity ML labels, later corrections should be auditable rather than silently blocked or overwritten.

### 6. Feature registry/snapshot alignment
The feature registry contains some features that are not materialized in every feature snapshot. The registry should become a strict contract with schema validation so future ML jobs cannot silently assume a feature exists when it is absent.

### 7. Privacy/retention
Raw client IPs are stored for fraud intelligence. A production deployment should define retention, access, deletion and minimization rules explicitly and avoid retaining more network/identity data than necessary.

## Overall assessment
Current state: **strong pre-production security/integrity baseline**.

It is not responsible to claim "100% secure" until the real PostgreSQL integration/concurrency suite and dependency scanners run in a clean production-like environment.
