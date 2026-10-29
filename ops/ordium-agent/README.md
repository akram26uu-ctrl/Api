# ORDIUM autonomous reliability agent (EC2)

This worker continuously probes configured Ordium endpoints, reads recent CloudWatch log events, asks an OpenRouter model for a narrowly scoped unified diff when an incident signal exists, validates the patch, runs repository-owned tests, and can push a direct commit to `main`. It is intentionally separate from the production containers.

## Important behavior and limitations

- A worker process is not installed on your EC2 merely because these files are in GitHub. Follow the installation steps below on the actual instance.
- The agent only sees endpoints and CloudWatch log groups configured in `agent.env`. It does not discover your AWS resources automatically. Optional Playwright checks open the public homepage in headless Chromium and report page errors; they do not log in, submit forms, or create customer data. Set `ORDIUM_BROWSER_CHECK=true` only after Chromium is installed successfully.
- The model cannot provide shell commands. The worker runs only hard-coded test/build/deploy commands and validates patch paths before applying a diff.
- Protected areas include `.github/`, `deploy/`, `ops/`, migrations, environment files, lockfiles, and private-key files. Production database migrations are never run automatically.
- Direct commits require a GitHub token with repository Contents read/write access and a repository policy that permits pushing to `main`. Branch protection/rulesets can reject the push.
- This is a supervised-by-policy automation loop, not a guarantee that every production incident can be repaired. Daily fix limits and service logs bound repeated attempts.
- Automatic deploy is disabled until the production checkout path is confirmed. The deployment routine rebuilds Compose services, checks health, and attempts a code rollback on failure; it does not roll back database state or external side effects.
- Install the agent as a dedicated user. Docker socket access is effectively root-level and is deliberately not granted by the service unit. If you enable automatic deployment, give the agent only the specific deployment mechanism needed; do not casually add it to the `docker` group.

## Install on EC2

Run these commands as an administrator after confirming the instance OS and existing Ordium deployment paths. Do not paste secrets into chat or commit them.

1. Install Python 3.11+ and Git. Install AWS CLI only if needed for your operations. The EC2 instance should use an IAM instance profile, not static AWS access keys.
2. Create the agent user and directories:

```bash
sudo useradd --system --create-home --home-dir /opt/ordium-agent --shell /usr/sbin/nologin ordium-agent
sudo install -d -o ordium-agent -g ordium-agent -m 700 /opt/ordium-agent/app
sudo install -d -o root -g ordium-agent -m 750 /etc/ordium-agent
```

3. Copy `agent.py` and `requirements.txt` from this directory to `/opt/ordium-agent/app/`, then install dependencies:

```bash
sudo -u ordium-agent python3 -m venv /opt/ordium-agent/venv
sudo -u ordium-agent /opt/ordium-agent/venv/bin/pip install -r /opt/ordium-agent/app/requirements.txt
sudo /opt/ordium-agent/venv/bin/python -m playwright install-deps chromium
sudo -u ordium-agent /opt/ordium-agent/venv/bin/python -m playwright install chromium
```

4. Copy `.env.example` to `/etc/ordium-agent/agent.env`, fill in the real endpoints, CloudWatch log groups, OpenRouter key and GitHub token, then set permissions:

```bash
sudo chown root:ordium-agent /etc/ordium-agent/agent.env
sudo chmod 640 /etc/ordium-agent/agent.env
```

5. Copy `ordium-agent.service` to `/etc/systemd/system/ordium-agent.service`. Review the service user and filesystem paths. Ensure the agent user can write its workspace but cannot read production `.env.ec2` files.
6. Configure the EC2 instance role with the least-privilege policy in iam-policy.example.json; replace the placeholder log-group ARNs. Do not attach broad AdministratorAccess.
7. If automatic deployment is intended, verify the actual production .env.ec2 path. Install the root-owned helper and its root-owned configuration:

```bash
sudo install -o root -g root -m 750 ops/ordium-agent/ordium-agent-deploy.sh /usr/local/sbin/ordium-agent-deploy
sudo install -o root -g root -m 600 ops/ordium-agent/deploy.conf.example /etc/ordium-agent/deploy.conf
sudo install -o root -g root -m 440 ops/ordium-agent/sudoers.example /etc/sudoers.d/ordium-agent-deploy
sudo visudo -cf /etc/sudoers.d/ordium-agent-deploy
```

Edit /etc/ordium-agent/deploy.conf as root and set the real deployment env-file path. The helper only accepts a commit SHA matching the clean workspace HEAD or a rollback request; it never accepts a model-supplied command. The agent service requires the scoped sudo rule, which is why NoNewPrivileges is disabled; do not grant any other sudo commands.
8. Start and inspect the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ordium-agent
sudo systemctl status ordium-agent
sudo journalctl -u ordium-agent -f
```

## Required AWS IAM permissions

The example policy grants CloudWatch log reads plus the minimal stream-write actions needed by the Docker awslogs driver on the single Ordium container log group. The agent runs diagnostics locally on EC2; it does not require SSM or remote shell access for this mode. If your logs are not in CloudWatch, configure log forwarding first.

## Rollout sequence

1. For a validation-only dry run, set `ORDIUM_ALLOW_DIRECT_PUSH=false`; validated patches are saved as `/opt/ordium-agent/last-validated-proposal.patch` and are not pushed. Set it to `true` only after reviewing the token scope and confirming the repository permits direct pushes.
2. Verify GitHub permissions and all three configured health URLs, then enable direct push. Keep a daily fix limit.
3. Keep `ORDIUM_AUTO_DEPLOY=false` until you confirm the actual deployment checkout, Compose env file, health URLs, and rollback process.
4. Enable auto-deploy only after testing on staging and arranging the root-owned, sudoers-restricted deployment helper. The model cannot choose arbitrary commands, but deployment still has production impact.
5. Never enable automatic database migrations, IAM changes, security-group changes, or secret rotation as model-driven actions.

## Notes

The existing EC2 Compose setup is documented in `/deploy/ec2/README.md`. It is marked pre-production/manual and keeps Supabase databases external. This worker does not change that architecture or move production traffic.
