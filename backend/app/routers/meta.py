from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect

from ..config import get_settings
from ..db import IntegrityError, audit, dialect, many, new_id, now_iso, one, tx
from ..realtime import hub
from ..schemas import StaffIn, StaffPatch
from ..security import admin_only, current_user, hash_password, password_problem, public_user, staff_only, user_from_ws_ticket
from ..serializers import CONSULT_SQL, consultation_out, consultation_scope

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/health")
async def health():
    """Liveness + readiness: 503 when the database or the realtime bus is unreachable."""
    s = get_settings()
    checks = {"database": True, "realtime": await hub.healthy()}
    try:
        one("SELECT 1 AS ok")
    except Exception:
        checks["database"] = False
    body = {"status": "ok" if all(checks.values()) else "degraded", "checks": checks, "gemini": s.gemini_enabled,
            "google_meet": s.google_meet_enabled, "firebase": s.firebase_enabled, "demo_mode": s.demo_mode,
            "turn": bool(s.turn_url), "database": dialect(), "realtime_backend": type(hub).__name__}
    if not all(checks.values()):
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content=body)
    return body


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
    show_disabled = include_disabled and bool(user.get("is_admin"))
    return [public_user(r) for r in rows if show_disabled or not r.get("disabled")]


@router.post("/users", status_code=201)
def create_staff(body: StaffIn, user: dict = Depends(admin_only)):
    if body.role == "doctor" and not (body.registration_number or "").strip():
        raise HTTPException(422, "Medical registration number is required for doctors")
    problem = password_problem(body.password, body.email, body.name)
    if problem:
        raise HTTPException(422, problem)
    uid = new_id("usr")
    try:
        with tx() as c:
            c.execute("""INSERT INTO users (id,email,name,role,password_hash,registration_number,specialization,
                         designation,created_at) VALUES (?,?,?,?,?,?,?,?,?)""",
                      (uid, body.email.lower(), body.name.strip(), body.role, hash_password(body.password),
                       body.registration_number, body.specialization, body.designation, now_iso()))
            audit(c, user["id"], "create_staff", "user", uid, {"role": body.role})
    except IntegrityError:
        raise HTTPException(409, "An account with this email already exists")
    return public_user(one("SELECT * FROM users WHERE id=?", (uid,)))  # type: ignore[arg-type]


@router.patch("/users/{uid}")
async def update_staff(uid: str, body: StaffPatch, user: dict = Depends(admin_only)):
    target = one("SELECT * FROM users WHERE id=? AND role IN ('doctor','student')", (uid,))
    if not target:
        raise HTTPException(404, "Staff member not found")
    data = body.model_dump(exclude_unset=True, exclude_none=True)
    if data.get("disabled") and uid == user["id"]:
        raise HTTPException(422, "You cannot disable your own account")
    if "is_admin" in data:
        if uid == user["id"] and not data["is_admin"]:
            raise HTTPException(422, "You cannot remove your own administrator role")
        if target["role"] != "doctor" and data["is_admin"]:
            raise HTTPException(422, "Only doctors can be administrators")
    for k in ("disabled", "is_admin"):
        if k in data:
            data[k] = int(bool(data[k]))
    if data:
        with tx() as c:
            c.execute(f"UPDATE users SET {', '.join(f'{k}=?' for k in data)} WHERE id=?", (*data.values(), uid))
            audit(c, user["id"], "update_staff", "user", uid, data)
        if data.get("disabled"):
            await hub.disconnect_user(uid, 4401, "Account disabled")
    return public_user(one("SELECT * FROM users WHERE id=?", (uid,)))  # type: ignore[arg-type]


@router.get("/dashboard")
async def dashboard(user: dict = Depends(current_user)):
    live = await hub.live_summary()
    if user["role"] == "patient":
        rows = many(CONSULT_SQL + " WHERE c.patient_id=? ORDER BY c.scheduled_at DESC", (user.get("patient_id"),))
        items = [consultation_out(r) for r in rows]
        for i in items:
            i["presence"] = live.get(i["id"], {"admitted": 0, "waiting": 0})
            if i["case_sheet_status"] != "approved":
                i["case_sheet_id"] = None
        return {"role": "patient", "upcoming": [i for i in items if i["status"] in ("scheduled", "live")],
                "past": [i for i in items if i["status"] in ("completed", "cancelled")]}
    scope, params = consultation_scope(user)
    rows = [consultation_out(r) for r in many(CONSULT_SQL + f" WHERE {scope} ORDER BY c.scheduled_at DESC LIMIT 200",
                                               params)]
    for r in rows:
        r["presence"] = live.get(r["id"], {"admitted": 0, "waiting": 0})
    stats = one(f"""SELECT (SELECT COUNT(*) FROM patients) AS patients,
                   (SELECT COUNT(*) FROM consultations c WHERE {scope} AND c.status='completed') AS completed,
                   (SELECT COUNT(*) FROM case_sheets cs JOIN consultations c ON c.id=cs.consultation_id
                      WHERE {scope} AND cs.status='draft') AS drafts,
                   (SELECT COUNT(*) FROM case_sheets cs JOIN consultations c ON c.id=cs.consultation_id
                      WHERE {scope} AND cs.status='approved') AS approved""", params * 3)
    return {"role": user["role"], "stats": stats,
            "live": [r for r in rows if r["status"] == "live" or r["presence"]["admitted"] or r["presence"]["waiting"]],
            "upcoming": [r for r in rows if r["status"] == "scheduled"][:20],
            "awaiting_approval": [r for r in rows if r["case_sheet_status"] == "draft"][:20],
            "recent_approved": [r for r in rows if r["case_sheet_status"] == "approved"][:10]}


@router.websocket("/ws/staff")
async def staff_ws(ws: WebSocket, ticket: str = Query(..., max_length=2000)):
    """Dashboard notifications (patient entered waiting room). Only the assigned staff and admins are told."""
    try:
        user = user_from_ws_ticket(ticket, "staff")
    except HTTPException:
        await ws.close(code=4401)
        return
    if user["role"] == "patient":
        await ws.close(code=4403)
        return
    await ws.accept()
    ws.state.user = user
    hub.watchers.add(ws)
    try:
        while True:
            await ws.receive_text()
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        hub.watchers.discard(ws)
