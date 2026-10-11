import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect

from ..config import get_settings
from ..db import audit, many, new_id, now_iso, one, tx
from ..realtime import hub
from ..schemas import StaffIn, StaffPatch
from ..security import current_user, doctor_only, hash_password, public_user, staff_only, user_from_token
from ..serializers import CONSULT_SQL, consultation_out

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/health")
def health():
    s = get_settings()
    one("SELECT 1 AS ok")
    return {"status": "ok", "gemini": s.gemini_enabled, "google_meet": s.google_meet_enabled,
            "firebase": s.firebase_enabled, "demo_mode": s.demo_mode, "turn": bool(s.turn_url)}


@router.get("/config")
def public_config():
    s = get_settings()
    return {"hospital_name": s.hospital_name, "languages": ["en", "ta", "hi", "te", "ml", "kn"],
            "features": {"gemini": s.gemini_enabled, "google_meet": s.google_meet_enabled,
                         "firebase": s.firebase_enabled, "demo_mode": s.demo_mode}}


@router.get("/users")
def list_staff(role: str | None = Query(None, pattern="^(doctor|student)$"), include_disabled: bool = False,
               user: dict = Depends(staff_only)):
    """Clinical staff directory (doctors and students). Disabled accounts only with include_disabled=true."""
    where = "role=?" if role else "role IN ('doctor','student')"
    rows = many(f"SELECT * FROM users WHERE {where} ORDER BY role, name", (role,) if role else ())
    return [public_user(r) for r in rows if include_disabled or not r.get("disabled")]


@router.post("/users", status_code=201)
def create_staff(body: StaffIn, user: dict = Depends(doctor_only)):
    if body.role == "doctor" and not (body.registration_number or "").strip():
        raise HTTPException(422, "Medical registration number is required for doctors")
    uid = new_id("usr")
    try:
        with tx() as c:
            c.execute("""INSERT INTO users (id,email,name,role,password_hash,registration_number,specialization,
                         designation,created_at) VALUES (?,?,?,?,?,?,?,?,?)""",
                      (uid, body.email.lower(), body.name.strip(), body.role, hash_password(body.password),
                       body.registration_number, body.specialization, body.designation, now_iso()))
            audit(c, user["id"], "create_staff", "user", uid, {"role": body.role})
    except sqlite3.IntegrityError:
        raise HTTPException(409, "An account with this email already exists")
    return public_user(one("SELECT * FROM users WHERE id=?", (uid,)))  # type: ignore[arg-type]


@router.patch("/users/{uid}")
def update_staff(uid: str, body: StaffPatch, user: dict = Depends(doctor_only)):
    target = one("SELECT * FROM users WHERE id=? AND role IN ('doctor','student')", (uid,))
    if not target:
        raise HTTPException(404, "Staff member not found")
    data = body.model_dump(exclude_unset=True)
    if data.get("disabled") and uid == user["id"]:
        raise HTTPException(422, "You cannot disable your own account")
    if "disabled" in data:
        data["disabled"] = int(bool(data["disabled"]))
    if data:
        with tx() as c:
            c.execute(f"UPDATE users SET {', '.join(f'{k}=?' for k in data)} WHERE id=?", (*data.values(), uid))
            audit(c, user["id"], "update_staff", "user", uid, data)
    return public_user(one("SELECT * FROM users WHERE id=?", (uid,)))  # type: ignore[arg-type]


@router.get("/dashboard")
def dashboard(user: dict = Depends(current_user)):
    live = hub.live_summary()
    if user["role"] == "patient":
        rows = many(CONSULT_SQL + " WHERE c.patient_id=? ORDER BY c.scheduled_at DESC", (user.get("patient_id"),))
        items = [consultation_out(r) for r in rows]
        for i in items:
            i["presence"] = live.get(i["id"], {"admitted": 0, "waiting": 0})
            if i["case_sheet_status"] != "approved":
                i["case_sheet_id"] = None
        return {"role": "patient", "upcoming": [i for i in items if i["status"] in ("scheduled", "live")],
                "past": [i for i in items if i["status"] in ("completed", "cancelled")]}
    rows = [consultation_out(r) for r in many(CONSULT_SQL + " ORDER BY c.scheduled_at DESC LIMIT 200")]
    for r in rows:
        r["presence"] = live.get(r["id"], {"admitted": 0, "waiting": 0})
    stats = one("""SELECT (SELECT COUNT(*) FROM patients) AS patients,
                   (SELECT COUNT(*) FROM consultations WHERE status='completed') AS completed,
                   (SELECT COUNT(*) FROM case_sheets WHERE status='draft') AS drafts,
                   (SELECT COUNT(*) FROM case_sheets WHERE status='approved') AS approved""")
    return {"role": user["role"], "stats": stats,
            "live": [r for r in rows if r["status"] == "live" or r["presence"]["admitted"] or r["presence"]["waiting"]],
            "upcoming": [r for r in rows if r["status"] == "scheduled"][:20],
            "awaiting_approval": [r for r in rows if r["case_sheet_status"] == "draft"][:20],
            "recent_approved": [r for r in rows if r["case_sheet_status"] == "approved"][:10]}


@router.websocket("/ws/staff")
async def staff_ws(ws: WebSocket, token: str = Query(...)):
    """Dashboard notifications (patient entered waiting room)."""
    try:
        user = user_from_token(token)
    except HTTPException:
        await ws.close(code=4401)
        return
    if user["role"] == "patient":
        await ws.close(code=4403)
        return
    await ws.accept()
    hub.watchers.add(ws)
    try:
        while True:
            await ws.receive_text()
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        hub.watchers.discard(ws)
