import secrets
from uuid import UUID
import httpx
from app.core.config import settings


class OrdiumApiError(RuntimeError):
    pass


class OrdiumProvisioningClient:
    def __init__(self) -> None:
        self.base_url = settings.ordium_api_url.rstrip("/")
        self.headers = {"X-ORDIUM-Internal-Key": settings.ordium_internal_shared_secret}

    def provision_merchant(self, *, name: str, email: str, business_type: str | None = None, secondary_business_categories: list[str] | None = None) -> UUID:
        with httpx.Client(timeout=10.0, follow_redirects=False) as client:
            response = client.post(
                f"{self.base_url}/internal/v1/merchants/provision",
                headers={**self.headers, "X-Request-ID": secrets.token_hex(16)},
                json={"name": name, "email": email, "business_type": business_type, "secondary_business_categories": secondary_business_categories or []},
            )
        if response.status_code >= 400:
            raise OrdiumApiError("Unable to provision ORDIUM merchant")
        return UUID(response.json()["merchant_id"])
    def ensure_store(self, merchant_id: UUID) -> tuple[UUID, str]:
        """Ensure every provisioned merchant has one active default store.

        This is intentionally idempotent so login/verification can repair legacy
        accounts that were created before store provisioning was mandatory.
        """
        with httpx.Client(timeout=10.0, follow_redirects=False) as client:
            response = client.post(
                f"{self.base_url}/internal/v1/merchants/{merchant_id}/stores",
                headers={**self.headers, "X-Request-ID": secrets.token_hex(16)},
            )
        if response.status_code >= 400:
            raise OrdiumApiError("Unable to ensure ORDIUM default store")
        payload = response.json()
        return UUID(payload["store_id"]), str(payload["name"])

    def activate_merchant(self, merchant_id: UUID) -> None:
        with httpx.Client(timeout=10.0, follow_redirects=False) as client:
            response = client.post(
                f"{self.base_url}/internal/v1/merchants/{merchant_id}/activate",
                headers=self.headers,
            )
        if response.status_code >= 400:
            raise OrdiumApiError("Unable to activate ORDIUM merchant")

    def create_initial_test_key(self, merchant_id: UUID) -> tuple[UUID, str]:
        with httpx.Client(timeout=10.0, follow_redirects=False) as client:
            response = client.post(
                f"{self.base_url}/internal/v1/merchants/{merchant_id}/api-keys",
                headers=self.headers,
                json={"name": "Initial test key", "environment": "test", "scopes": ["orders:write", "outcomes:write"]},
            )
        if response.status_code >= 400:
            raise OrdiumApiError("Unable to create initial ORDIUM test key")
        payload = response.json()
        return UUID(payload["api_key_id"]), payload["api_key"]



    def create_dashboard_key(self, merchant_id: UUID, environment: str = "test") -> tuple[UUID, str]:
        with httpx.Client(timeout=10.0, follow_redirects=False) as client:
            response = client.post(
                f"{self.base_url}/internal/v1/merchants/{merchant_id}/api-keys",
                headers=self.headers,
                json={"name": f"Dashboard session ({environment})", "environment": environment, "scopes": [
                    "orders:read", "orders:write", "outcomes:write", "keys:manage",
                    "webhooks:manage", "risk_profile:read", "risk_profile:write", "risk_features:read", "audit:read", "metrics:read"
                ]},
            )
        if response.status_code >= 400:
            raise OrdiumApiError("Unable to create dashboard API key")
        payload = response.json()
        return UUID(payload["api_key_id"]), payload["api_key"]

    def revoke_api_key(self, merchant_id: UUID, api_key_id: UUID) -> None:
        with httpx.Client(timeout=10.0, follow_redirects=False) as client:
            response = client.post(
                f"{self.base_url}/internal/v1/merchants/{merchant_id}/api-keys/{api_key_id}/revoke",
                headers=self.headers,
            )
        if response.status_code >= 400 and response.status_code != 404:
            raise OrdiumApiError("Unable to revoke dashboard API key")
