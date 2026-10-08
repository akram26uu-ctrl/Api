from __future__ import annotations

from dataclasses import dataclass
import threading
import time
from collections import OrderedDict
from functools import lru_cache
from typing import Protocol

import httpx

from app.core.config import settings


@dataclass
class NetworkIntelResult:
    ip_address: str
    vpn: bool = False
    proxy: bool = False
    tor: bool = False
    bot_status: bool = False
    recent_abuse: bool = False
    active_vpn: bool = False
    active_tor: bool = False
    fraud_score: int | None = None
    usage_type: str | None = None
    provider: str = "unknown"
    available: bool = True


class NetworkIntelligenceProvider(Protocol):
    def lookup(self, ip_address: str) -> NetworkIntelResult: ...


class MockNetworkIntelligenceProvider:
    VPN_IPS = {"10.10.10.10"}
    PROXY_IPS = {"20.20.20.20"}
    TOR_IPS = {"30.30.30.30"}

    def lookup(self, ip_address: str) -> NetworkIntelResult:
        return NetworkIntelResult(
            ip_address=ip_address,
            vpn=ip_address in self.VPN_IPS,
            proxy=ip_address in self.PROXY_IPS,
            tor=ip_address in self.TOR_IPS,
            provider="mock",
        )


class IPQualityScoreProvider:
    BASE_URL = "https://ipqualityscore.com/api/json/ip"

    def __init__(
        self,
        api_key: str,
        timeout_seconds: float = 1.5,
        cache_ttl_seconds: int = 3600,
        strictness: int = 1,
    ) -> None:
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds
        self.cache_ttl_seconds = cache_ttl_seconds
        self.strictness = strictness
        self._cache: OrderedDict[str, tuple[float, NetworkIntelResult]] = OrderedDict()
        self.max_cache_entries = settings.ipqs_cache_max_entries
        self._lock = threading.Lock()
        self._concurrency = threading.BoundedSemaphore(settings.ipqs_max_concurrent_lookups)

    def lookup(self, ip_address: str) -> NetworkIntelResult:
        now = time.monotonic()
        with self._lock:
            cached = self._cache.get(ip_address)
            if cached is not None and self.cache_ttl_seconds > 0 and now - cached[0] < self.cache_ttl_seconds:
                self._cache.move_to_end(ip_address)
                return cached[1]
            if self.cache_ttl_seconds == 0 and cached is not None:
                self._cache.pop(ip_address, None)
            if cached is not None:
                self._cache.pop(ip_address, None)

        acquired = self._concurrency.acquire(timeout=self.timeout_seconds)
        if not acquired:
            return NetworkIntelResult(
                ip_address=ip_address,
                provider="ipqs",
                available=False,
            )
        try:
            response = httpx.get(
                f"{self.BASE_URL}",
                params={
                    "ip": ip_address,
                    "strictness": self.strictness,
                    "allow_public_access_points": "true",
                },
                timeout=self.timeout_seconds,
                headers={"Accept": "application/json", "IPQS-KEY": self.api_key},
                follow_redirects=False,
            )
            response.raise_for_status()
            data = response.json()
            result = NetworkIntelResult(
                ip_address=ip_address,
                vpn=bool(data.get("vpn")),
                proxy=bool(data.get("proxy")),
                tor=bool(data.get("tor")),
                bot_status=bool(data.get("bot_status")),
                recent_abuse=bool(data.get("recent_abuse")),
                active_vpn=bool(data.get("active_vpn")),
                active_tor=bool(data.get("active_tor")),
                fraud_score=(int(data["fraud_score"]) if data.get("fraud_score") is not None else None),
                usage_type=data.get("usage_type"),
                provider="ipqs",
                available=True,
            )
        except (httpx.HTTPError, ValueError, TypeError, KeyError):
            return NetworkIntelResult(
                ip_address=ip_address,
                provider="ipqs",
                available=False,
            )
        finally:
            self._concurrency.release()

        with self._lock:
            self._cache[ip_address] = (time.monotonic(), result)
            self._cache.move_to_end(ip_address)
            while len(self._cache) > self.max_cache_entries:
                self._cache.popitem(last=False)
        return result


@lru_cache(maxsize=1)
def build_network_intelligence_provider() -> NetworkIntelligenceProvider:
    provider = settings.network_intelligence_provider.strip().lower()
    if provider == "ipqs" and settings.ipqs_api_key:
        return IPQualityScoreProvider(
            api_key=settings.ipqs_api_key,
            timeout_seconds=settings.ipqs_timeout_seconds,
            cache_ttl_seconds=settings.ipqs_cache_ttl_seconds,
            strictness=settings.ipqs_strictness,
        )
    return MockNetworkIntelligenceProvider()
