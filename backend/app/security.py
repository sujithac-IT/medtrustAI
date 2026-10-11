"""Password hashing, JWT sessions, Firebase ID-token verification, role guards."""
import base64
import hashlib
import hmac
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import get_settings
from .db import one

PBKDF2_ITER = 200_000
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITER)
    return f"pbkdf2_sha256${PBKDF2_ITER}${base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        _, it, salt, dk = stored.split("$")
        calc = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt), int(it))
        return hmac.compare_digest(calc, base64.b64decode(dk))
    except (ValueError, TypeError):
        return False


def issue_token(user: dict[str, Any]) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    payload = {"sub": user["id"], "role": user["role"], "iat": now,
               "exp": now + timedelta(hours=s.jwt_ttl_hours)}
    return jwt.encode(payload, s.jwt_secret, algorithm="HS256")


def public_user(u: dict[str, Any]) -> dict[str, Any]:
    return {k: u.get(k) for k in ("id", "email", "name", "role", "registration_number", "specialization",
                                  "designation", "patient_id")}


def user_from_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session")
    user = one("SELECT * FROM users WHERE id=?", (payload["sub"],))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User no longer exists")
    return user


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict[str, Any]:
    if not creds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")
    return user_from_token(creds.credentials)


def require_roles(*roles: str) -> Callable[..., dict[str, Any]]:
    def dep(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        if user["role"] not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Requires role: {', '.join(roles)}")
        return user
    return dep


staff_only = require_roles("doctor", "student")
doctor_only = require_roles("doctor")

_FIREBASE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
_cert_cache: dict[str, Any] = {"exp": 0.0, "certs": {}}


def _firebase_certs() -> dict[str, str]:
    if time.time() < _cert_cache["exp"]:
        return _cert_cache["certs"]
    r = httpx.get(_FIREBASE_CERTS_URL, timeout=10)
    r.raise_for_status()
    _cert_cache.update(certs=r.json(), exp=time.time() + 3600)
    return _cert_cache["certs"]


def verify_firebase_token(id_token: str) -> dict[str, Any]:
    """Verify a Firebase Auth ID token (RS256) against Google's published certificates."""
    project = get_settings().firebase_project_id
    if not project:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Firebase is not configured on this server")
    try:
        from cryptography.x509 import load_pem_x509_certificate
        kid = jwt.get_unverified_header(id_token).get("kid")
        cert = _firebase_certs().get(kid)
        if not cert:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown Firebase signing key")
        key = load_pem_x509_certificate(cert.encode()).public_key()
        return jwt.decode(id_token, key, algorithms=["RS256"], audience=project,
                          issuer=f"https://securetoken.google.com/{project}")
    except jwt.PyJWTError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid Firebase token: {e}")
    except httpx.HTTPError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Cannot reach Google to verify token")
