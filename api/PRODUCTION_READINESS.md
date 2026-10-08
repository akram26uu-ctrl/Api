# ORDIUM Production Readiness

## Implemented in this release

- Outcome feedback and correction for live/real orders.
- Calibration quality metrics and score-bucket diagnostics.
- Signal correlation and overlap analysis.
- Signal attribution and score-cap diagnostics.
- Historical persisted-event replay for advisory threshold/weight calibration.
- Cross-merchant reputation requires evidence from multiple bad merchants, reducing single-merchant poisoning risk.
- API-key authentication, merchant status checks, environment isolation, rate limits and idempotency remain enforced.
- CORS allows the implemented PUT outcome correction route.
- CI definition runs API tests, Control Plane tests, web typecheck/build, Bandit and pip-audit.

## Calibration safety

Calibration endpoints are advisory. No endpoint automatically modifies RiskProfile weights or thresholds. Candidate changes must be reviewed and promoted as a versioned rules/profile change.

The replay engine is `persisted-event-replay`: it replays recorded RiskEvent score impacts. It is not a full historical re-execution of every rule against reconstructed historical state.

## Required external release checks

These cannot be honestly certified from the repository-only environment:

1. Run the API suite against a dedicated PostgreSQL test database with `TEST_POSTGRES_DATABASE_URL`.
2. Run PostgreSQL concurrency tests for idempotency, concurrent outcomes, rate-limit contention and webhook claiming.
3. Run `pip-audit` and `bandit` in a clean CI environment.
4. Install web dependencies and run `npm ci`, `npm run lint`, and `npm run build`.
5. Configure production `DATABASE_URL`, `SECRET_KEY`, `ORDIUM_INTERNAL_SHARED_SECRET`, `ALLOWED_HOSTS`, CORS origins, and IPQS credentials through the deployment secret manager.
6. Define and test webhook encryption-key rotation before rotating `SECRET_KEY` in production.
7. Define IP/network-data retention and deletion policy for production privacy compliance.
8. Put an edge/WAF rate limit in front of the public API for invalid-key traffic.

## Release invariant

A production deployment must use only `live + real` data for production calibration and must not enable the frontend demo/mock mode.
