"""Sign in with Google (OpenID Connect authorization-code flow with PKCE).

The browser is sent to Google, Google redirects back to the Web app's
``/auth/google/callback`` page, and that page posts the one-time ``code`` and
``state`` to the Control Plane. The Control Plane exchanges the code directly
with Google's token endpoint over TLS using the client secret, so the ID token
it receives is authenticated by that channel (OIDC Core 3.1.3.7); the claims
are still checked for issuer, audience, expiry and nonce.
"""
import base64
import hashlib
import json
import secrets
import time
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx

from app.core.config import settings

AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
VALID_ISSUERS = {"https://accounts.google.com", "accounts.google.com"}
CALLBACK_PATH = "/auth/google/callback"


class GoogleOAuthError(Exception):
    """The Google exchange failed or returned an identity that cannot be trusted."""


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str
    email: str
    first_name: str
    last_name: str


def redirect_uri() -> str:
    return settings.public_base_url.rstrip("/") + CALLBACK_PATH


def new_pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).rstrip(b"=").decode("ascii")
    return verifier, challenge


def authorization_url(*, state: str, nonce: str, code_challenge: str) -> str:
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": redirect_uri(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "nonce": nonce,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "prompt": "select_account",
    }
    return AUTHORIZATION_ENDPOINT + "?" + urlencode(params)


def _decode_jwt_payload(token: str) -> dict:
    try:
        payload_segment = token.split(".")[1]
        padded = payload_segment + "=" * (-len(payload_segment) % 4)
        claims = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")))
    except (IndexError, ValueError, UnicodeDecodeError) as exc:
        raise GoogleOAuthError("Malformed ID token") from exc
    if not isinstance(claims, dict):
        raise GoogleOAuthError("Malformed ID token")
    return claims


def identity_from_id_token(id_token: str, *, nonce: str, now: float | None = None) -> GoogleIdentity:
    claims = _decode_jwt_payload(id_token)
    current = time.time() if now is None else now
    if claims.get("iss") not in VALID_ISSUERS:
        raise GoogleOAuthError("Unexpected ID token issuer")
    audience = claims.get("aud")
    audiences = audience if isinstance(audience, list) else [audience]
    if settings.google_client_id not in audiences:
        raise GoogleOAuthError("ID token was not issued for this client")
    if claims.get("azp") not in (None, settings.google_client_id):
        raise GoogleOAuthError("ID token authorized party mismatch")
    if not isinstance(claims.get("exp"), (int, float)) or claims["exp"] <= current:
        raise GoogleOAuthError("ID token has expired")
    if not isinstance(claims.get("nonce"), str) or not secrets.compare_digest(claims["nonce"], nonce):
        raise GoogleOAuthError("ID token nonce mismatch")
    sub = claims.get("sub")
    email = claims.get("email")
    if not isinstance(sub, str) or not sub or not isinstance(email, str) or "@" not in email:
        raise GoogleOAuthError("ID token is missing the account identity")
    # Only a mailbox Google has verified may identify an ORDIUM account.
    if claims.get("email_verified") is not True and claims.get("email_verified") != "true":
        raise GoogleOAuthError("Google has not verified this email address")
    given = claims.get("given_name") if isinstance(claims.get("given_name"), str) else ""
    family = claims.get("family_name") if isinstance(claims.get("family_name"), str) else ""
    return GoogleIdentity(sub=sub, email=email.strip().lower(), first_name=given.strip()[:100], last_name=family.strip()[:100])


def exchange_code(code: str, *, code_verifier: str, nonce: str) -> GoogleIdentity:
    try:
        response = httpx.post(
            TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": redirect_uri(),
                "grant_type": "authorization_code",
                "code_verifier": code_verifier,
            },
            headers={"Accept": "application/json"},
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        raise GoogleOAuthError("Google token endpoint is unreachable") from exc
    if response.status_code != 200:
        raise GoogleOAuthError(f"Google rejected the authorization code (HTTP {response.status_code})")
    try:
        id_token = response.json().get("id_token")
    except ValueError as exc:
        raise GoogleOAuthError("Google returned an unreadable token response") from exc
    if not isinstance(id_token, str):
        raise GoogleOAuthError("Google did not return an ID token")
    return identity_from_id_token(id_token, nonce=nonce)
