"""Maps carrier codes to adapter classes, gated by environment."""
from __future__ import annotations

from app.services.carriers.base import CarrierAdapter
from app.services.carriers.sandbox import SandboxCarrier


class CarrierNotAvailable(Exception):
    def __init__(self, code: str, environment: str) -> None:
        super().__init__(f"carrier {code!r} is not available in {environment!r}")
        self.code = code
        self.environment = environment


# code -> (adapter class, display name, environments it may run in)
_CARRIERS: dict[str, tuple[type, str, frozenset[str]]] = {
    "sandbox": (SandboxCarrier, "Sandbox", frozenset({"test"})),
}


def get_adapter(code: str, credentials: dict, environment: str) -> CarrierAdapter:
    entry = _CARRIERS.get(code)
    if entry is None or environment not in entry[2]:
        raise CarrierNotAvailable(code, environment)
    return entry[0](credentials)


def available_carriers(environment: str) -> list[dict]:
    return [
        {"code": code, "display_name": name, "capabilities": cls.capabilities}
        for code, (cls, name, envs) in _CARRIERS.items()
        if environment in envs
    ]
