#!/usr/bin/env bash
set -euo pipefail
umask 077

CONFIG=/etc/ordium-agent/deploy.conf
if [[ ! -r "$CONFIG" ]]; then
  echo "Missing root-owned config: $CONFIG" >&2
  exit 2
fi
# This file must be owned by root and not writable by ordium-agent.
source "$CONFIG"

WORKSPACE="${ORDIUM_WORKSPACE:-/opt/ordium-agent/workspace}"
COMPOSE_FILE="${ORDIUM_COMPOSE_FILE:-compose.ec2.yaml}"
ENV_FILE="${ORDIUM_DEPLOY_ENV_FILE:-}"
if [[ -z "$ENV_FILE" || ! -f "$ENV_FILE" || ! -f "$WORKSPACE/$COMPOSE_FILE" ]]; then
  echo "Deployment config, env file, or Compose file is missing." >&2
  exit 2
fi

compose() {
  docker compose --project-directory "$WORKSPACE" --env-file "$ENV_FILE" -f "$WORKSPACE/$COMPOSE_FILE" "$@"
}
save_previous_images() {
  for image in ordium-api:ec2 ordium-control-plane:ec2 ordium-web:ec2; do
    if docker image inspect "$image" >/dev/null 2>&1; then
      local rollback="${image%:*}:rollback"
      docker image tag "$image" "$rollback"
    fi
  done
}
restore_previous_images() {
  local restored=0
  for image in ordium-api:ec2 ordium-control-plane:ec2 ordium-web:ec2; do
    local rollback="${image%:*}:rollback"
    if docker image inspect "$rollback" >/dev/null 2>&1; then
      docker image tag "$rollback" "$image"
      restored=1
    fi
  done
  if [[ "$restored" == "1" ]]; then
    compose up -d --no-build
  fi
}

case "${1:-}" in
  deploy)
    sha="${2:-}"
    if [[ ! "$sha" =~ ^[0-9a-f]{40}$ ]]; then
      echo "Expected a full 40-character commit SHA." >&2
      exit 2
    fi
    actual="$(git -C "$WORKSPACE" rev-parse HEAD)"
    [[ "$actual" == "$sha" ]] || { echo "Requested SHA does not match workspace HEAD." >&2; exit 3; }
    [[ -z "$(git -C "$WORKSPACE" status --porcelain)" ]] || { echo "Workspace is not clean." >&2; exit 3; }
    save_previous_images
    if ! compose build || ! compose up -d; then
      restore_previous_images
      exit 4
    fi
    ;;
  rollback)
    restore_previous_images
    ;;
  *)
    echo "Usage: ordium-agent-deploy {deploy <full-commit-sha>|rollback}" >&2
    exit 2
    ;;
esac
