# ORDIUM MongoDB Atlas Credit: Repository Audit and Migration Plan

## Decision

Use the MongoDB Atlas student credit through a deliberately scoped, reversible integration. Do **not** replace PostgreSQL in the first phase and do not change production database URLs. The repository currently depends on SQLAlchemy, PostgreSQL/psycopg, Alembic migrations, relational foreign keys, uniqueness constraints, and multi-row transactions. A wholesale switch is a data-model and application rewrite, not a connection-string change.

## Repository findings (main branch audit)

### Separate relational database consumers

1. **API** — `api/app/db/database.py` builds a SQLAlchemy engine from `DATABASE_URL`; `api/pyproject.toml` depends on SQLAlchemy, psycopg and Alembic. `api/migrations/env.py` imports SQLAlchemy model metadata and runs Alembic migrations.
2. **Control plane/account service** — `control-plane/app/db.py` separately creates a SQLAlchemy engine from `WEB_DATABASE_URL`; `control-plane/pyproject.toml` also depends on SQLAlchemy, psycopg and Alembic. This service stores users, password hashes, organizations, memberships and web sessions.

### Data that should stay relational initially

- Account/authentication data: `users`, `web_sessions`, `memberships`, `organizations`. Session token hashes, revocation/expiry, membership uniqueness and foreign keys are security-sensitive.
- Merchant/store/API-key configuration and encrypted secrets.
- Orders and order items; unique merchant/environment/store/external-order identity and idempotency guarantees.
- Customers and identity links, phone/device/address identifiers, risk assessments/events, outcomes and calibration/evaluation records. These form a connected relational graph and are used by risk processing and reporting.
- Webhook endpoints and delivery state. Delivery records include retry/processing timestamps and endpoint foreign keys; moving queue state without a coordinated atomic design could lose or duplicate deliveries.
- API and merchant rate-limit buckets and idempotency records, where uniqueness and atomic updates matter.

### Flexible documents already stored in SQL

The API already stores JSON-shaped fields in SQLAlchemy models, including:
- `WebhookDelivery.payload` in `api/app/models/webhook_delivery.py`
- `RiskEvent.event_data` in `api/app/models/risk_event.py`
- `RiskFeatureSnapshot.features` in `api/app/models/risk_feature_snapshot.py`
- order identity-match reasons and idempotency response bodies.

This reduces the need to move those existing fields just to obtain flexible JSON documents. PostgreSQL JSON/JSONB may be enough for them; verify actual column types and query patterns before changing anything.

## Recommended first use of MongoDB Atlas

Use Atlas for a **new, non-authoritative integration-event archive** or raw inbound webhook payload store, separate from the transactional order and delivery tables. The exact first collection should be selected after locating and auditing the current inbound Shopify/Omniterra webhook routes and their idempotency/signature flow.

Proposed document shape (illustrative, not yet implemented):

- `_id`: stable provider event ID where available; otherwise a deterministic deduplication key
- `provider`: e.g. `omniterra` or `shopify`
- `store_id` and `merchant_id`: ORDIUM identifiers as strings
- `event_type`, `received_at`, `schema_version`
- `signature_verified`: boolean; only set after verification succeeds
- `payload`: sanitized raw provider document
- `processing_status`, `processed_at`, `error_code`: diagnostic state only if this collection is deliberately made the processing ledger.

Do not store passwords, API secrets, webhook signing secrets, session tokens, or unredacted sensitive personal data in raw payload archives. Define retention and redaction before enabling production writes. Create a unique index for the provider/event deduplication key and indexes for store/merchant/time. Do not use an archive as the source of truth for whether an order was created.

## Safe implementation sequence

### Phase 0 — account and cost guardrails
1. Confirm the $50 credit is active in the intended Atlas organization, its eligible products, and expiry date in the Atlas billing console.
2. Start with a development/test cluster and set Atlas alerts/budget guardrails where available. Do not assume a $50 credit prevents charges after exhaustion.
3. Create a least-privilege database user restricted to the intended database; restrict network access to the API host where practical. Keep the URI only in Render environment variables/secrets, never in GitHub or frontend code.

### Phase 1 — data-flow and compatibility audit
1. Enumerate all inbound webhook handlers, raw-body signature verification, event ID extraction, replay handling, and duplicate behavior.
2. Enumerate Alembic heads and verify production schema drift separately; do not combine a MongoDB trial with unresolved PostgreSQL migration drift.
3. Define event schema, maximum document size, TTL/retention, redaction policy, unique/index strategy, and expected read/write volume.
4. Add a MongoDB client module with explicit timeouts and health checks, behind a feature flag. Keep PostgreSQL as the authoritative transaction store.

### Phase 2 — test-only vertical slice
1. Add tests using a dedicated Atlas test database or isolated MongoDB test instance.
2. Verify valid and invalid HMAC signatures, duplicate delivery, malformed payloads, tenant/store isolation, timeout/unavailable database behavior, and payload redaction.
3. Write the event archive only after signature verification. Do not block order processing on archive availability unless a documented durable-ingestion contract requires it.
4. Test duplicate/retry behavior and ensure a MongoDB failure cannot create duplicate orders or bypass the existing SQL idempotency checks.

### Phase 3 — shadow mode and controlled rollout
1. Enable writes only in test/staging, then a small production canary after tests and backups.
2. Compare accepted event counts, duplicate rates, processing latency and errors against the existing SQL path.
3. Keep a feature flag to disable MongoDB writes immediately; existing PostgreSQL processing must continue.
4. Add metrics for insert failures, latency, duplicate-key results and connection pool usage.

### Phase 4 — decide whether to expand
Only consider moving an existing dataset if measured query patterns or cost justify it and there is a tested export/import, reconciliation, rollback and outage plan. Migrating the entire API or control-plane database is a separate project. Do not migrate auth/session tables as part of this credit experiment.

## Go/no-go criteria

Go only when:
- The credit and expected cluster costs are verified in Atlas.
- Production schema drift/migrations are understood.
- Signature verification and idempotency remain enforced by the existing API.
- Tests cover outage/retry/duplicate/tenant isolation.
- Retention, redaction and access controls are documented.
- A rollback is demonstrated without deleting or rewriting PostgreSQL records.

No production code, database configuration, or customer data is changed by this audit document.
