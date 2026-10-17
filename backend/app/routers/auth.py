from fastapi import APIRouter, Depends, HTTPException, Request

from ..config import get_settings
from ..db import DEMO_PASSWORD, IntegrityError, audit, new_id, next_mrn, now_iso, one, tx
from ..ratelimit import limiter, login_guard
from ..realtime import hub
from ..schemas import DemoLoginIn, FirebaseIn, LoginIn, PasswordChangeIn, ProfilePatch, RegisterIn, WsTicketIn
from ..security import (current_user, hash_password, issue_token, issue_ws_ticket, password_problem, public_user,
                        verify_firebase_token, verify_password, verify_password_constant_time)
from ..serializers import ensure_consultation_access, get_consultation

router = APIRouter(prefix="/api/auth", tags=["auth"])
DEMO_ACCOUNTS = {"doctor": "doctor@medtrust.demo", "student": "student@medtrust.demo",
                 "patient": "patient@medtrust.demo"}


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "-"


def _session(user: dict) -> dict:
    if user.get("disabled"):
        raise HTTPException(403, "This account has been disabled. Contact the hospital administrator.")
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
    keys = (f"login:email:{email}", f"login:ip:{client_ip(request)}")
    login_guard.check(*keys)
    user = one("SELECT * FROM users WHERE lower(email)=?", (email,))
    if not user or not verify_password_constant_time(body.password, user["password_hash"]):
        login_guard.fail(*keys)
        raise HTTPException(401, "Incorrect email or password")
    if user.get("disabled"):
        raise HTTPException(403, "This account has been disabled. Contact the hospital administrator.")
    login_guard.reset(keys[0])
    with tx() as c:
        audit(c, user["id"], "login", "user", user["id"])
    return _session(user)


@router.post("/demo")
def demo_login(body: DemoLoginIn, request: Request):
    if not get_settings().demo_mode:
        raise HTTPException(403, "Demo mode is disabled")
    limiter.hit(f"demo:ip:{client_ip(request)}", 60, 60, "Too many demo sign-ins")
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
    except IntegrityError:
        raise HTTPException(409, "An account with this email already exists")
    return one("SELECT * FROM users WHERE id=?", (uid,))  # type: ignore[return-value]


@router.post("/register", status_code=201)
def register(body: RegisterIn, request: Request):
    limiter.hit(f"register:ip:{client_ip(request)}", 10, 3600, "Too many registrations from this network")
    if body.role == "doctor" and not body.registration_number:
        raise HTTPException(422, "Medical registration number is required for doctors")
    problem = password_problem(body.password, body.email, body.name)
    if problem:
        raise HTTPException(422, problem)
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
async def change_password(body: PasswordChangeIn, user: dict = Depends(current_user)):
    """Change password. Returns a fresh session; all previously issued tokens stop validating."""
    if user.get("password_hash") and not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(400, "Current password is incorrect")
    if body.new_password == body.current_password:
        raise HTTPException(422, "New password must be different from the current password")
    problem = password_problem(body.new_password, user["email"], user["name"])
    if problem:
        raise HTTPException(422, problem)
    with tx() as c:
        c.execute("UPDATE users SET password_hash=? WHERE id=?", (hash_password(body.new_password), user["id"]))
        audit(c, user["id"], "change_password", "user", user["id"])
    await hub.disconnect_user(user["id"], 4401, "Password changed")
    return _session(one("SELECT * FROM users WHERE id=?", (user["id"],)))  # type: ignore[arg-type]


@router.post("/ws-ticket")
def ws_ticket(body: WsTicketIn, user: dict = Depends(current_user)):
    """One-minute ticket for opening a WebSocket. Keeps the session token out of URLs and logs."""
    if body.consultation_id:
        c = get_consultation(body.consultation_id)
        ensure_consultation_access(user, c)
        scope = f"consultation:{c['id']}"
    else:
        if user["role"] == "patient":
            raise HTTPException(403, "Staff notifications are for clinical staff")
        scope = "staff"
    return {"ticket": issue_ws_ticket(user, scope), "expires_in": 60}
