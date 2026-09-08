"""
Authentication — verifies Supabase Auth JWTs and enforces roles.

The frontend logs in directly against Supabase Auth (email/password) and
sends the resulting JWT as a Bearer token on every API call. This module
verifies that token here in the backend — never trust a role claim the
frontend sends unverified — and looks up the user's role from the `profiles`
table (not the JWT itself, so revoking/changing a role takes effect
immediately without waiting for the token to expire).

Newer Supabase projects sign access tokens with an asymmetric key (ES256),
not the legacy shared HS256 "JWT Secret" — the token's own header carries a
`kid` that must be looked up against the project's JWKS endpoint, so that's
what's used here instead of a static secret.

Env vars required:
  SUPABASE_URL — the project's base URL, e.g. https://xxxx.supabase.co
"""
from __future__ import annotations

import os

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from . import db

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
_JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json" if SUPABASE_URL else ""

_bearer = HTTPBearer(auto_error=False)
_jwk_client = PyJWKClient(_JWKS_URL) if _JWKS_URL else None


class CurrentUser:
    def __init__(self, user_id: str, email: str, role: str, display_name: str):
        self.user_id = user_id
        self.email = email
        self.role = role  # 'analyst' or 'admin'
        self.display_name = display_name


def _decode_token(token: str) -> dict:
    if _jwk_client is None:
        raise HTTPException(status_code=500, detail="Auth not configured on server (SUPABASE_URL missing)")
    try:
        signing_key = _jwk_client.get_signing_key_from_jwt(token)
        return jwt.decode(token, signing_key.key, algorithms=["ES256", "RS256"], audience="authenticated")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired, please log in again")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid session token")


def _load_profile(user_id: str, email: str) -> tuple[str, str]:
    """Returns (role, display_name). Creates a default profile if one is
    missing (e.g. the DB trigger didn't fire for some reason)."""
    with db.get_cursor() as cur:
        cur.execute("SELECT role, display_name FROM profiles WHERE id=%s", (user_id,))
        row = cur.fetchone()
    if row:
        return row["role"], row["display_name"] or email.split("@")[0]

    default_name = email.split("@")[0]
    with db.get_cursor(commit=True) as cur:
        cur.execute(
            "INSERT INTO profiles (id, email, display_name, role) VALUES (%s,%s,%s,'analyst') "
            "ON CONFLICT (id) DO NOTHING",
            (user_id, email, default_name),
        )
    return "analyst", default_name


def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> CurrentUser:
    if creds is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization header")
    payload = _decode_token(creds.credentials)
    user_id = payload.get("sub", "")
    email = payload.get("email", "")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing subject")
    role, display_name = _load_profile(user_id, email)
    return CurrentUser(user_id=user_id, email=email, role=role, display_name=display_name)


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user
