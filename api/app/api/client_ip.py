from __future__ import annotations

import ipaddress

from fastapi import Request

from app.core.config import settings


def _trusted_networks() -> list[ipaddress._BaseNetwork]:
    networks: list[ipaddress._BaseNetwork] = []
    for raw in settings.trusted_proxy_networks.split(","):
        raw = raw.strip()
        if not raw:
            continue
        try:
            networks.append(ipaddress.ip_network(raw, strict=False))
        except ValueError:
            continue
    return networks


def get_client_ip(request: Request) -> str | None:
    peer = request.client.host if request.client is not None else None
    if not peer:
        return None

    try:
        peer_ip = ipaddress.ip_address(peer)
    except ValueError:
        return peer

    # The synthetic seed dataset needs deterministic IPs so its network
    # intelligence/risk rules can be exercised. Never honor this header in
    # production; normal deployed traffic must use trusted proxy handling.
    if settings.environment.strip().lower() in {"development", "test"}:
        simulated_ip = request.headers.get("X-Simulation-IP", "").strip()
        if simulated_ip:
            try:
                return str(ipaddress.ip_address(simulated_ip))
            except ValueError:
                pass

    if not any(peer_ip in network for network in _trusted_networks()):
        return peer

    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        parsed: list[ipaddress._BaseAddress] = []
        for candidate in forwarded.split(","):
            candidate = candidate.strip()
            try:
                parsed.append(ipaddress.ip_address(candidate))
            except ValueError:
                continue
        trusted_networks = _trusted_networks()
        for candidate in reversed(parsed):
            if not any(candidate in network for network in trusted_networks):
                return str(candidate)
        if parsed:
            return str(parsed[0])

    real_ip = request.headers.get("X-Real-IP") or request.headers.get("CF-Connecting-IP")
    if real_ip:
        try:
            ipaddress.ip_address(real_ip.strip())
            return real_ip.strip()
        except ValueError:
            pass

    return peer
