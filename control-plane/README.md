# ORDIUM Control Plane

The control plane is the web-facing backend for account/session management. It owns its own database and never connects directly to the ORDIUM Risk API database.

## Responsibilities

- User accounts
- Organization/workspace metadata
- Membership/roles
- Secure browser sessions
- Merchant provisioning through the ORDIUM internal service boundary

## Database separation

`WEB_DATABASE_URL` is a dedicated database. Risk data remains in the ORDIUM API database.

## Local development

```bash
python -m venv .venv
.venv\Scripts\activate
python -m pip install -e ".[test]"
copy .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8010
```

Set `ORDIUM_INTERNAL_SHARED_SECRET` to the same value configured in the API as `ORDIUM_INTERNAL_SHARED_SECRET`. Production email verification also requires the SMTP variables in `.env.example`.
