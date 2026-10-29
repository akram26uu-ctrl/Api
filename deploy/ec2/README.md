# ORDIUM EC2 Compose deployment (pre-production)

This scaffold does not create AWS resources, migrate databases, change DNS, or replace Render/Vercel.

## Services and exposure

- `api`: FastAPI on container port 8000; published to EC2 loopback only at `127.0.0.1:8000` for host Nginx.
- `control-plane`: FastAPI on port 8010, available only inside the Compose network; it is not published to the host.
- `web`: Vite production assets plus a Node same-origin proxy; published to host loopback only at `127.0.0.1:8080`.
- `webhook-worker`: polls the existing webhook dispatcher in batches, independently of API web traffic. It is behind the optional `webhook-worker` profile and does not start with the default stack.
- Supabase remains external. `DATABASE_URL` and `WEB_DATABASE_URL` must stay separate.

After EC2 approval, host Nginx must terminate HTTPS and proxy the public web domain to `127.0.0.1:8080`, and the public API domain (for example `api.ordium.dev`) to `127.0.0.1:8000`. Do not expose 8000, 8010, or 8080 to the internet. Only 80/443 should be publicly reachable. Never publish Control Plane port 8010.

## CloudWatch logs

The Compose stack sends container stdout/stderr to the CloudWatch Logs group `/ordium/containers` using the EC2 instance role. Set `AWS_REGION` in `.env.ec2` to the instance's actual region. The instance role needs `logs:CreateLogStream` and `logs:PutLogEvents` on that log group; the autonomous agent also needs `logs:FilterLogEvents`. The awslogs driver uses non-blocking mode so a temporary logging outage does not block application writes. Confirm the group and streams appear before enabling automatic repairs.

## Prepare configuration

1. Copy `deploy/ec2/env.example` to `.env.ec2` at the repository root.
2. Replace every placeholder with the actual Supabase URLs and valid secrets. Use separate URLs for the API database and Control Plane database.
3. Generate a Fernet-compatible session key locally with a trusted Python environment: `from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())`. Generate independent random values for `SECRET_KEY` and `ORDIUM_INTERNAL_SHARED_SECRET`. Do not paste secrets into chat or commit them.
4. Set owner-only permissions: `chmod 600 .env.ec2`.
5. Check syntax without starting services:

```bash
docker compose --env-file .env.ec2 -f compose.ec2.yaml config --quiet
```

The placeholder example can be used for syntax validation only:

```bash
docker compose --env-file deploy/ec2/env.example -f compose.ec2.yaml config --quiet
```

## Build and smoke test

```bash
docker compose --env-file .env.ec2 -f compose.ec2.yaml build
docker compose --env-file .env.ec2 -f compose.ec2.yaml ps
docker compose --env-file .env.ec2 -f compose.ec2.yaml logs --tail=100
```

Start the stack only against an approved test/staging environment first. The web proxy has path allowlists, bounded request bodies, selected forwarded headers, manual redirect handling, and preserves separate `Set-Cookie` headers. Automated tests cover its path validation.

The webhook dispatcher is deliberately opt-in to prevent duplicate live deliveries while the existing Render-side worker may still be active. Do not start it until the old dispatcher is confirmed stopped and the worker handoff is approved. Only then run `docker compose --profile webhook-worker --env-file .env.ec2 -f compose.ec2.yaml up -d webhook-worker`.

## Migration safety

**Do not run Alembic migrations against the existing production Supabase databases during container startup.** The Compose file deliberately does not run migrations. Before any database change, check each current Alembic revision independently, back up each database, test restoration, review the migration diff, and obtain explicit approval for production database changes.

API and Control Plane use separate migration histories. Do not reuse one database URL for both.

## ARM64 versus x86

All three Dockerfiles use multi-architecture base images. CI builds Linux AMD64 and ARM64 images. Before selecting `t4g.medium`, test the actual dependency stack on ARM64. If dependencies or runtime behavior fail, use the x86 AMD option `t3a.medium` and recheck costs.

## Manual start/stop and rollback

The chosen mode is manual. Starting Compose does not change DNS.

```bash
docker compose --env-file .env.ec2 -f compose.ec2.yaml stop
docker compose --env-file .env.ec2 -f compose.ec2.yaml up -d
```

EBS storage and some attached resources still incur charges while EC2 is stopped. Before any public cutover, keep Render and Vercel intact and record the current DNS/hosting configuration. Roll back by restoring the previous DNS destinations; do not delete the EC2 instance or its volumes until logs are captured and the cause is understood.
