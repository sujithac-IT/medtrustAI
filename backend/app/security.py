"""Password hashing, JWT sessions, WebSocket tickets, Firebase ID-token verification, role guards."""
import base64
import hashlib
import hmac
import os
import re
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
ISSUER = "medtrust"
WS_TICKET_TTL_S = 60
bearer = HTTPBearer(auto_error=False)
_COMMON_PASSWORDS = {"password", "password1", "12345678", "123456789", "qwerty123", "iloveyou", "11111111",
                     "abc12345", "medtrust", "welcome1", "admin123", "letmein1", "password123"}


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


# Spend the same time on unknown emails as on wrong passwords, so login timing does not reveal accounts.
_DUMMY_HASH = hash_password(os.urandom(8).hex())


def verify_password_constant_time(password: str, stored: str | None) -> bool:
    return verify_password(password, stored or _DUMMY_HASH) and bool(stored)


def password_problem(password: str, email: str = "", name: str = "") -> str | None:
    """Minimal policy: length, not a common password, not the email/name, letters and digits."""
    p = password.lower()
    if len(password) < 8:
        return "Password must be at least 8 characters"
    if p in _COMMON_PASSWORDS:
        return "This password is too common"
    local = email.split("@")[0].lower()
    if (local and len(local) >= 4 and local in p) or (name and name.lower().replace(" ", "") == p):
        return "Password must not contain your email or name"
    if not (re.search(r"[A-Za-z]", password) and re.search(r"\d", password)):
        return "Password must contain letters and at least one digit"
    return None


def _pw_version(user: dict[str, Any]) -> str:
    """Short fingerprint of the password hash; tokens issued before a password change stop validating."""
    return hashlib.sha256((user.get("password_hash") or "none").encode()).hexdigest()[:10]


def _encode(payload: dict[str, Any]) -> str:
    return jwt.encode(payload, get_settings().jwt_secret, algorithm="HS256")


def issue_token(user: dict[str, Any]) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    return _encode({"sub": user["id"], "role": user["role"], "typ": "access", "iss": ISSUER, "iat": now,
                    "pwv": _pw_version(user), "exp": now + timedelta(hours=s.jwt_ttl_hours)})


def issue_ws_ticket(user: dict[str, Any], scope: str) -> str:
    """Short-lived token for one WebSocket connect, so long-lived session tokens never travel in URLs."""
    now = datetime.now(timezone.utc)
    return _encode({"sub": user["id"], "typ": "ws", "scope": scope, "iss": ISSUER, "iat": now,
                    "pwv": _pw_version(user), "exp": now + timedelta(seconds=WS_TICKET_TTL_S)})


def public_user(u: dict[str, Any]) -> dict[str, Any]:
    out = {k: u.get(k) for k in ("id", "email", "name", "role", "registration_number", "specialization",
                                 "designation", "patient_id", "phone")}
    out["disabled"] = bool(u.get("disabled"))
    out["is_admin"] = bool(u.get("is_admin"))
    return out


def _decode(token: str, typ: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"], issuer=ISSUER,
                             options={"require": ["exp", "sub", "typ", "pwv", "iss"]})
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session")
    if payload.get("typ") != typ:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session")
    return payload


def _load_user(payload: dict[str, Any]) -> dict[str, Any]:
    user = one("SELECT * FROM users WHERE id=?", (payload["sub"],))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User no longer exists")
    if user.get("disabled"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This account has been disabled")
    if not hmac.compare_digest(str(payload["pwv"]), _pw_version(user)):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Password changed - please sign in again")
    return user


def user_from_token(token: str) -> dict[str, Any]:
    return _load_user(_decode(token, "access"))


def user_from_ws_ticket(ticket: str, scope: str) -> dict[str, Any]:
    payload = _decode(ticket, "ws")
    if payload.get("scope") != scope:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Ticket is not valid for this connection")
    return _load_user(payload)


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


def admin_only(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    if user["role"] == "patient" or not user.get("is_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Requires a hospital administrator")
    return user


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
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Firebase token")
    except httpx.HTTPError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Cannot reach Google to verify token")
