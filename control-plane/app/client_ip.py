"""Resolve the browser's IP address behind ORDIUM's own proxies (nginx -> Web -> Control Plane)."""
import ipaddress
from functools import lru_cache

from fastapi import Request

from app.core.config import settings

CLIENT_IP_HEADER = "x-ordium-client-ip"


@lru_cache(maxsize=8)
def _networks(raw: str) -> tuple[ipaddress._BaseNetwork, ...]:
    networks = []
    for item in raw.split(","):
        item = item.strip()
        if item:
            try:
                networks.append(ipaddress.ip_network(item, strict=False))
            except ValueError:
                continue
    return tuple(networks)


def client_ip(request: Request) -> str:
    """Return the real client IP.

    Every browser request reaches the Control Plane through the Web container, so the TCP peer is
    the same for all users. The Web proxy reports the nginx-provided address in X-Ordium-Client-IP;
    it is only honoured when the peer is a trusted internal proxy, so clients cannot spoof it.
    """
    peer = request.client.host if request.client else ""
    try:
        peer_ip = ipaddress.ip_address(peer)
    except ValueError:
        return peer or "unknown"
    if any(peer_ip in network for network in _networks(settings.trusted_proxy_networks)):
        reported = (request.headers.get(CLIENT_IP_HEADER) or "").strip()
        try:
            return str(ipaddress.ip_address(reported))
        except ValueError:
            pass
    return str(peer_ip)
