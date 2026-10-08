# ORDIUM Platform — Fixes Applied

## Backend integration
- Added authenticated order listing and order retrieval to the Risk API.
- Added a merchant-isolated `/api/v1/metrics/summary` endpoint for dashboard telemetry.
- Added the `orders:read` API scope.
- Fixed API-key management calls to use the actual revoke/rotate contracts.
- Fixed webhook dashboard calls to match the actual create/list/disable API.
- Added session-bound dashboard API credentials for TEST and LIVE environments.
- Dashboard credentials are revoked when the browser session logs out.

## Account lifecycle
- Added email verification tokens with 30-minute expiry and one-time consumption.
- Added `POST /api/v1/auth/verify-email`.
- Added SMTP-based verification email delivery for production.
- Production now requires SMTP configuration when email verification is enabled.
- Added a browser verification page and development verification-token flow.
- Added Control Plane migration `0002_auth_verification`.

## Frontend
- Removed the normal Dashboard dependency on `MockDatabase`.
- Mock data is now available only with explicit `VITE_ORDIUM_DEMO_MODE=true`.
- Dashboard API requests use the session-bound Bearer credential.
- TEST/LIVE dashboard credentials are selected according to the active environment.
- Live order creation from the simulator is blocked; the simulator is TEST-only.
- Fixed simulator payloads to use the API's current Algerian/DZD contract.
- Fixed Rules Engine UI so it does not falsely claim to persist unsupported policy edits.
- Rules thresholds are loaded from the actual Risk Profile API.
- Fixed Vite ESM configuration (`__dirname` / `process.env` usage).
- Updated interactive API documentation to match the implemented endpoints.

## Documentation
- Updated API version references to 1.5.0.
- Updated environment examples and platform documentation.

## Verification
- ORDIUM API: 93 passed, 1 skipped (optional PostgreSQL integration test; no TEST_POSTGRES_DATABASE_URL configured).
- Control Plane: 3 passed.
- Control Plane Alembic migrations: `0001 -> 0002` applied successfully on temporary SQLite.
- TypeScript parsing/semantic check: no project-source semantic errors after filtering dependency-resolution errors; full check/build requires frontend dependencies to be installed.
