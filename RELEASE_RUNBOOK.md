# ORDIUM Release Runbook

## Release gate

The current source has:
- API automated tests: 93 passed, 1 skipped (optional PostgreSQL integration test is skipped without `TEST_POSTGRES_DATABASE_URL`).
- Control Plane automated tests: 5 passed.
- Control Plane migrations: `0001 -> 0002 -> 0003` verified on a temporary SQLite test database.
- Frontend TypeScript source check: passes when normal frontend dependencies are installed. The supplied archive contains platform-specific/incomplete `node_modules`, so a clean install is required before production build.

## Production configuration

### API
Required production settings:
- `ENVIRONMENT=production`
- `DEBUG=false`
- PostgreSQL `DATABASE_URL`
- `SECRET_KEY` (32+ random characters; rotate any previously exposed value)
- `ALLOWED_HOSTS` with explicit API hostnames
- `CORS_ALLOWED_ORIGINS` with explicit web origin(s)
- `ORDIUM_INTERNAL_SHARED_SECRET` shared only with Control Plane
- `ENABLE_DOCS=false`
- `NETWORK_INTELLIGENCE_PROVIDER=ipqs` plus a valid `IPQS_API_KEY` (or another production provider implementation)

Run:
```bash
cd api
alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Control Plane
Required production settings:
- `ENVIRONMENT=production`
- `DEBUG=false`
- PostgreSQL `WEB_DATABASE_URL`
- `COOKIE_SECURE=true`
- `REQUIRE_EMAIL_VERIFICATION=true`
- `PUBLIC_BASE_URL=https://<web-domain>`
- SMTP host/port/username/password/from
- `ORDIUM_API_URL=https://<api-internal-or-public-host>`
- the same `ORDIUM_INTERNAL_SHARED_SECRET` as API

Run:
```bash
cd control-plane
alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8010
```

## Frontend
Create `web/.env` from `.env.example` with the real HTTPS origins, then install dependencies from the lockfile and build:
```bash
cd web
npm install
npx tsc --noEmit
npm run build
```

If using Bun, use the repository's `bun.lock` consistently instead of mixing package managers.

## Mandatory smoke test

1. Open `/healthz` for API and Control Plane.
2. Open API `/readyz` and confirm HTTP 200.
3. Register a new account.
4. Receive and consume the email verification link.
5. Confirm login creates a browser session.
6. Open `/dashboard` directly and confirm the session is accepted without manually entering a dashboard API key.
7. Switch TEST/LIVE and confirm the correct environment key is used.
8. Create a TEST order from the simulator.
9. Confirm risk decision, order detail, metrics, audit log, and customer/identity views use real API data.
10. Create a webhook using a public HTTPS endpoint and confirm the endpoint is stored.
11. Run the webhook dispatcher worker and confirm signed delivery plus retry behavior.
12. Create/rotate/revoke an API key and verify old credentials stop working.
13. Request password reset, consume the link, and verify old sessions are revoked.
14. Logout and verify the old browser session/API credentials no longer work.
15. Run `alembic current` in both services and verify each database is at its expected head.

## Webhook worker

The API persists webhook events in an outbox table. A worker/scheduled process must execute:
```bash
cd api
python -m scripts.dispatch_webhooks
```
Use a supervised process or scheduler in production. Do not rely on a developer shell.

## Security before public launch

- Rotate any real credentials that were previously exposed during development or chat/debugging.
- Use HTTPS everywhere in production.
- Keep API and Control Plane databases separate.
- Do not commit `.env` files.
- Configure reverse-proxy rate limiting for account endpoints and API abuse protection.
- Configure database backups and test restoration.
- Configure monitoring for `/healthz`, `/readyz`, 5xx rate, latency, database failures, and webhook failures.
- Keep the internal merchant provisioning route inaccessible from the public internet except through the intended service boundary.

## Known validation limitation

A complete frontend production bundle cannot be produced from the supplied development archive when `node_modules` lacks the Linux-compatible Vite package. This is an environment/dependency issue, not a TypeScript source error. A clean dependency installation on the target Windows/Linux build environment is required for the final `npm run build` gate.
