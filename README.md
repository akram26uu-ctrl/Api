<<<<<<< HEAD
# ORDIUM Platform

## Components
- `api/` — ORDIUM Risk/Data Plane. Uses the Risk PostgreSQL database.
- `control-plane/` — Accounts, sessions, organizations, and merchant provisioning. Uses a separate Web/Control Plane PostgreSQL database.
- `web/` — Frontend application. Talks to the Control Plane and ORDIUM API; it must not connect directly to either database.

## Business Context
The API now supports merchant business categories and optional order items. Business category is context, not an automatic fraud score. Product quantity/value rules use real historical samples with a minimum evidence threshold.

## Databases
Keep the Web/Control Plane database and Risk API database separate.

## Migrations
Run separately in each service:

```bash
cd api
alembic upgrade head

cd ../control-plane
alembic upgrade head
```

Do not copy production `.env` files into source control or share them.


## Authentication lifecycle

Control Plane email verification is enabled for production. Verification tokens expire after 30 minutes; production requires SMTP configuration. After activation/login, the Control Plane issues session-bound test/live dashboard API credentials and revokes them on logout.

## Dashboard data path

The dashboard uses the real ORDIUM API by default. `MockDatabase` is only available when `VITE_ORDIUM_DEMO_MODE=true`; it is not part of the normal production path.
=======
# Api
Api for Ecommerce
>>>>>>> 4b03b26421016567808815a723eb1b80f19ef75f
