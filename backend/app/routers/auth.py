import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Request

from ..config import get_settings
from ..db import DEMO_PASSWORD, audit, new_id, next_mrn, now_iso, one, tx
from ..schemas import DemoLoginIn, FirebaseIn, LoginIn, PasswordChangeIn, ProfilePatch, RegisterIn
from ..security import (current_user, hash_password, issue_token, login_limiter, public_user, verify_firebase_token,
                        verify_password)

router = APIRouter(prefix="/api/auth", tags=["auth"])
DEMO_ACCOUNTS = {"doctor": "doctor@medtrust.demo", "student": "student@medtrust.demo",
                 "patient": "patient@medtrust.demo"}


def _session(user: dict) -> dict:
    return {"token": issue_token(user), "token_type": "bearer", "user": public_user(user)}


@router.get("/config")
def auth_config():
    s = get_settings()
    return {"demo_mode": s.demo_mode, "firebase_enabled": s.firebase_enabled,
            "doctor_signup_requires_invite": bool(s.doctor_invite_code) or not s.demo_mode,
            "demo_accounts": ({r: {"email": e, "password": DEMO_PASSWORD} for r, e in DEMO_ACCOUNTS.items()}
                              if s.demo_mode else None)}


@router.post("/login")
def login(body: LoginIn, request: Request):
    email = body.email.strip().lower()
    keys = (f"email:{email}", f"ip:{request.client.host if request.client else '-'}")
    login_limiter.check(*keys)
    user = one("SELECT * FROM users WHERE lower(email)=?", (email,))
    if not user or not verify_password(body.password, user["password_hash"]):
        login_limiter.fail(*keys)
        raise HTTPException(401, "Incorrect email or password")
    if user.get("disabled"):
        raise HTTPException(403, "This account has been disabled. Contact the hospital administrator.")
    login_limiter.reset(keys[0])
    with tx() as c:
        audit(c, user["id"], "login", "user", user["id"])
    return _session(user)


@router.post("/demo")
def demo_login(body: DemoLoginIn):
    if not get_settings().demo_mode:
        raise HTTPException(403, "Demo mode is disabled")
    user = one("SELECT * FROM users WHERE email=?", (DEMO_ACCOUNTS[body.role],))
    if not user:
        raise HTTPException(500, "Demo account missing")
    return _session(user)


def _create_user(body: RegisterIn | None, *, email: str, name: str, role: str, password_hash: str | None) -> dict:
    s = get_settings()
    if role in ("doctor", "student"):
        code = body.invite_code if body else None
        if (s.doctor_invite_code and code != s.doctor_invite_code) or (not s.doctor_invite_code and not s.demo_mode):
            raise HTTPException(403, "A valid staff invite code is required to register clinical staff")
    uid = new_id("usr")
    ts = now_iso()
    try:
        with tx(immediate=True) as c:
            patient_id = None
            if role == "patient":
                first, _, last = name.partition(" ")
                patient_id = new_id("pat")
                c.execute("""INSERT INTO patients (id,mrn,first_name,last_name,date_of_birth,gender,phone,email,
                             created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                          (patient_id, next_mrn(c), first, last or "-",
                           (body.date_of_birth.isoformat() if body and body.date_of_birth else "1900-01-01"),
                           (body.gender if body and body.gender else "Other"),
                           (body.phone if body and body.phone else "0000000000"), email, uid, ts, ts))
            c.execute("""INSERT INTO users (id,email,name,role,password_hash,registration_number,specialization,
                         patient_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)""",
                      (uid, email.lower(), name, role, password_hash,
                       body.registration_number if body else None, body.specialization if body else None,
                       patient_id, ts))
            audit(c, uid, "register", "user", uid, {"role": role})
    except sqlite3.IntegrityError:
        raise HTTPException(409, "An account with this email already exists")
    return one("SELECT * FROM users WHERE id=?", (uid,))  # type: ignore[return-value]


@router.post("/register", status_code=201)
def register(body: RegisterIn):
    if body.role == "doctor" and not body.registration_number:
        raise HTTPException(422, "Medical registration number is required for doctors")
    user = _create_user(body, email=body.email, name=body.name.strip(), role=body.role,
                        password_hash=hash_password(body.password))
    return _session(user)


@router.post("/firebase")
def firebase_login(body: FirebaseIn):
    claims = verify_firebase_token(body.id_token)
    email = claims.get("email")
    if not email or not claims.get("email_verified", False):
        raise HTTPException(401, "Firebase account must have a verified email")
    user = one("SELECT * FROM users WHERE lower(email)=lower(?)", (email,))
    if not user:
        if body.role != "patient":
            raise HTTPException(403, "Clinical staff accounts must be provisioned by the hospital")
        user = _create_user(None, email=email, name=claims.get("name") or email.split("@")[0], role="patient",
                            password_hash=None)
    return _session(user)


@router.get("/me")
def me(user: dict = Depends(current_user)):
    return public_user(user)


@router.patch("/me")
def update_me(body: ProfilePatch, user: dict = Depends(current_user)):
    data = body.model_dump(exclude_unset=True)
    if user["role"] == "patient":
        data.pop("specialization", None)
        data.pop("designation", None)
    data = {k: (v.strip() if isinstance(v, str) else v) for k, v in data.items()}
    if data:
        with tx() as c:
            c.execute(f"UPDATE users SET {', '.join(f'{k}=?' for k in data)} WHERE id=?", (*data.values(), user["id"]))
            if user["role"] == "patient" and user.get("patient_id") and data.get("phone"):
                c.execute("UPDATE patients SET phone=?, updated_at=? WHERE id=?",
                          (data["phone"], now_iso(), user["patient_id"]))
            audit(c, user["id"], "update_profile", "user", user["id"], {"fields": sorted(data)})
    return public_user(one("SELECT * FROM users WHERE id=?", (user["id"],)))  # type: ignore[arg-type]


@router.post("/password")
def change_password(body: PasswordChangeIn, user: dict = Depends(current_user)):
    """Change password. Returns a fresh session; all previously issued tokens stop validating."""
    if user.get("password_hash") and not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(400, "Current password is incorrect")
    if body.new_password == body.current_password:
        raise HTTPException(422, "New password must be different from the current password")
    with tx() as c:
        c.execute("UPDATE users SET password_hash=? WHERE id=?", (hash_password(body.new_password), user["id"]))
        audit(c, user["id"], "change_password", "user", user["id"])
    return _session(one("SELECT * FROM users WHERE id=?", (user["id"],)))  # type: ignore[arg-type]
