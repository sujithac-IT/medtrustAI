from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query, HTTPException

from ..config import get_settings
from ..db import many, one
from ..realtime import hub
from ..security import current_user, public_user, staff_only, user_from_token
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
def list_staff(role: str | None = None, user: dict = Depends(staff_only)):
    rows = many("SELECT * FROM users WHERE role IN ('doctor','student') ORDER BY name") if not role else \
        many("SELECT * FROM users WHERE role=? ORDER BY name", (role,))
    return [public_user(r) for r in rows if r["role"] != "patient" or user["role"] == "doctor"]


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
                "past": [i for i in items if i["status"] == "completed"]}
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
