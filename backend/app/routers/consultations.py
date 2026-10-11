import json
import logging
import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect

from ..config import get_settings
from ..db import audit, many, new_id, now_iso, one, tx
from ..realtime import Peer, hub
from ..schemas import ConsultationIn, ConsultationPatch, DemoTranscriptIn, TranscriptIn
from ..security import current_user, doctor_only, staff_only, user_from_token
from ..serializers import (CONSULT_SQL, can_access_consultation, consultation_out, ensure_consultation_access,
                           get_consultation, segment_out)
from ..services import google_meet, samples

log = logging.getLogger("medtrust.consult")
router = APIRouter(prefix="/api/consultations", tags=["consultations"])


def _room_code() -> str:
    a = string.ascii_lowercase
    return "-".join("".join(secrets.choice(a) for _ in range(n)) for n in (3, 4, 3))


@router.get("")
def list_consultations(status: str | None = Query(None), patient_id: str | None = None,
                       user: dict = Depends(current_user)):
    where, params = ["1=1"], []
    if user["role"] == "patient":
        where.append("c.patient_id=?")
        params.append(user.get("patient_id"))
    elif patient_id:
        where.append("c.patient_id=?")
        params.append(patient_id)
    if status:
        where.append("c.status=?")
        params.append(status)
    rows = many(CONSULT_SQL + " WHERE " + " AND ".join(where) + " ORDER BY c.scheduled_at DESC", tuple(params))
    out = [consultation_out(r) for r in rows]
    live = hub.live_summary()
    for o in out:
        o["presence"] = live.get(o["id"], {"admitted": 0, "waiting": 0})
        if user["role"] == "patient" and o["case_sheet_status"] != "approved":
            o["case_sheet_id"] = None
    return out


@router.post("", status_code=201)
def create_consultation(body: ConsultationIn, user: dict = Depends(staff_only)):
    patient = one("SELECT * FROM patients WHERE id=?", (body.patient_id,))
    if not patient:
        raise HTTPException(404, "Patient not found")
    doctor_id = body.doctor_id or (user["id"] if user["role"] == "doctor" else None)
    doctor = one("SELECT * FROM users WHERE id=? AND role='doctor'", (doctor_id,)) if doctor_id else None
    if not doctor:
        raise HTTPException(422, "A valid attending doctor is required")
    if body.student_id and not one("SELECT 1 FROM users WHERE id=? AND role='student'", (body.student_id,)):
        raise HTTPException(422, "student_id is not a student")
    student_id = body.student_id or (user["id"] if user["role"] == "student" else None)
    try:
        start = datetime.fromisoformat((body.scheduled_at or now_iso()).replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(422, "scheduled_at must be ISO-8601")
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    cid, code = new_id("con"), _room_code()
    meet: dict = {"provider": "in_app"}
    if body.create_google_meet and get_settings().google_meet_enabled:
        try:
            emails = [doctor["email"], patient.get("email") or ""]
            if student_id:
                st = one("SELECT email FROM users WHERE id=?", (student_id,))
                emails.append(st["email"] if st else "")
            meet = google_meet.create_meeting(
                f"MedTrust consultation - {patient['first_name']} {patient['last_name']}",
                start.isoformat(), (start + timedelta(minutes=30)).isoformat(), emails)
        except Exception as e:
            log.warning("Google Meet provisioning failed: %s", e)
            meet = {"provider": "in_app", "google_error": "Google Meet provisioning failed; in-app room is active"}
    with tx() as c:
        c.execute("""INSERT INTO consultations (id,room_code,patient_id,doctor_id,student_id,reason,scheduled_at,
                     meet_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)""",
                  (cid, code, patient["id"], doctor["id"], student_id, body.reason,
                   start.isoformat(timespec="seconds"), json.dumps(meet), now_iso()))
        audit(c, user["id"], "create", "consultation", cid)
    return consultation_out(get_consultation(cid))


@router.get("/{cid}")
def get_one(cid: str, user: dict = Depends(current_user)):
    c = get_consultation(cid)
    ensure_consultation_access(user, c)
    out = consultation_out(c)
    out["presence"] = hub.live_summary().get(c["id"], {"admitted": 0, "waiting": 0})
    if user["role"] == "patient" and out["case_sheet_status"] != "approved":
        out["case_sheet_id"] = None
    out["ice_servers"] = get_settings().ice_servers()
    return out


@router.patch("/{cid}")
def patch_consultation(cid: str, body: ConsultationPatch, user: dict = Depends(staff_only)):
    c = get_consultation(cid)
    if c["status"] in ("completed", "cancelled"):
        raise HTTPException(409, f"Consultation is {c['status']}")
    data = body.model_dump(exclude_unset=True)
    if data:
        with tx() as conn:
            conn.execute(f"UPDATE consultations SET {', '.join(f'{k}=?' for k in data)} WHERE id=?",
                         (*data.values(), c["id"]))
            audit(conn, user["id"], "update", "consultation", c["id"], data)
    return consultation_out(get_consultation(c["id"]))


def _set_status(cid: str, status: str, user: dict) -> dict:
    c = get_consultation(cid)
    with tx() as conn:
        if status == "live" and c["status"] == "scheduled":
            conn.execute("UPDATE consultations SET status='live', started_at=? WHERE id=?", (now_iso(), c["id"]))
        elif status == "completed" and c["status"] in ("live", "scheduled"):
            conn.execute("UPDATE consultations SET status='completed', ended_at=?, started_at=COALESCE(started_at,?) "
                         "WHERE id=?", (now_iso(), now_iso(), c["id"]))
        else:
            return consultation_out(c)
        audit(conn, user["id"], status, "consultation", c["id"])
    return consultation_out(get_consultation(c["id"]))


@router.post("/{cid}/start")
async def start(cid: str, user: dict = Depends(staff_only)):
    out = _set_status(cid, "live", user)
    await hub.to_consultation(out["id"], {"type": "status", "status": out["status"], "started_at": out["started_at"]})
    return out


@router.post("/{cid}/end")
async def end(cid: str, user: dict = Depends(doctor_only)):
    out = _set_status(cid, "completed", user)
    await hub.to_consultation(out["id"], {"type": "status", "status": "completed", "ended_at": out["ended_at"]})
    return out


# ------------------------------------------------------------------ transcripts
def _offset_ms(c: dict) -> int:
    if not c.get("started_at"):
        return 0
    return int((datetime.now(timezone.utc) - datetime.fromisoformat(c["started_at"])).total_seconds() * 1000)


def _insert_segment(c: dict, *, client_id: str, role: str, user_id: str | None, name: str, text: str,
                    language: str, offset_ms: int, source: str) -> dict | None:
    sid = new_id("seg")
    with tx() as conn:
        cur = conn.execute("""INSERT OR IGNORE INTO transcript_segments (id,consultation_id,client_id,speaker_role,
                    speaker_user_id,speaker_name,text,language,offset_ms,source,created_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                           (sid, c["id"], client_id, role, user_id, name, text.strip(), language, offset_ms, source,
                            now_iso()))
        if cur.rowcount == 0:
            return None
    return segment_out(one("SELECT * FROM transcript_segments WHERE id=?", (sid,)))  # type: ignore[arg-type]


@router.get("/{cid}/transcript")
def get_transcript(cid: str, user: dict = Depends(current_user)):
    c = get_consultation(cid)
    ensure_consultation_access(user, c)
    return [segment_out(s) for s in many(
        "SELECT * FROM transcript_segments WHERE consultation_id=? ORDER BY offset_ms, created_at", (c["id"],))]


@router.post("/{cid}/transcript", status_code=201)
async def add_segment(cid: str, body: TranscriptIn, user: dict = Depends(current_user)):
    c = get_consultation(cid)
    ensure_consultation_access(user, c)
    if c["status"] in ("completed", "cancelled") and user["role"] != "doctor":
        raise HTTPException(409, "Consultation has ended")
    # Speakers are attributed to the authenticated user; only staff may attribute text to another role
    role = body.speaker_role if (body.speaker_role and user["role"] != "patient") else user["role"]
    name = user["name"] if role == user["role"] else role.capitalize()
    seg = _insert_segment(c, client_id=body.client_id or uuid.uuid4().hex, role=role, user_id=user["id"],
                          name=name, text=body.text, language=body.language,
                          offset_ms=body.offset_ms if body.offset_ms is not None else _offset_ms(c), source="manual"
                          if body.client_id is None else "live")
    if seg:
        await hub.to_consultation(c["id"], {"type": "transcript.final", "segment": seg})
    return seg or {"duplicate": True}


@router.post("/{cid}/transcript/demo", status_code=201)
async def load_demo(cid: str, body: DemoTranscriptIn, user: dict = Depends(staff_only)):
    c = get_consultation(cid)
    sc = samples.get_scenario(body.scenario)
    if not sc:
        raise HTTPException(404, "Unknown scenario")
    added = []
    for i, t in enumerate(sc["turns"]):
        mm, ss = t["timestamp"].split(":")
        seg = _insert_segment(c, client_id=f"demo-{body.scenario}-{i}", role=t["speaker"], user_id=None,
                              name=t["speaker_name"], text=t["text"], language="en-IN",
                              offset_ms=(int(mm) * 60 + int(ss)) * 1000, source="demo")
        if seg:
            added.append(seg)
    await hub.to_consultation(c["id"], {"type": "transcript.reload"})
    return {"added": len(added), "scenario": body.scenario}


@router.get("/demo/scenarios")
def scenarios(user: dict = Depends(staff_only)):
    return samples.list_scenarios()


@router.post("/{cid}/transcript/import-google")
async def import_google(cid: str, user: dict = Depends(staff_only)):
    c = get_consultation(cid)
    meet = json.loads(c["meet_json"] or "{}")
    if not get_settings().google_meet_enabled:
        raise HTTPException(400, "Google Meet API is not configured on this server")
    if not meet.get("space_name"):
        raise HTTPException(400, "This consultation has no Google Meet space")
    try:
        entries = google_meet.fetch_transcript_entries(meet["space_name"])
    except Exception as e:
        raise HTTPException(502, f"Google Meet API error: {e}")
    # Map Meet display names onto roles using the consultation participants
    doctor = one("SELECT name FROM users WHERE id=?", (c["doctor_id"],))
    student = one("SELECT name FROM users WHERE id=?", (c["student_id"],)) if c["student_id"] else None

    def role_of(name: str) -> str:
        low = name.lower()
        if doctor and (low in doctor["name"].lower() or doctor["name"].lower().replace("dr. ", "") in low):
            return "doctor"
        if student and low in student["name"].lower():
            return "student"
        return "patient"
    n = 0
    for e in entries:
        if _insert_segment(c, client_id=e["entry_id"], role=role_of(e["speaker_name"]), user_id=None,
                           name=e["speaker_name"], text=e["text"], language=e["language"], offset_ms=e["offset_ms"],
                           source="google_meet"):
            n += 1
    await hub.to_consultation(c["id"], {"type": "transcript.reload"})
    return {"imported": n, "total_entries": len(entries)}


# ------------------------------------------------------------------ realtime
@router.websocket("/{cid}/ws")
async def consultation_ws(ws: WebSocket, cid: str, token: str = Query(...)):
    """Realtime channel. See docs/API_CONTRACT.md section 4 for the message protocol."""
    try:
        user = user_from_token(token)
        c = get_consultation(cid)
    except HTTPException as e:
        await ws.close(code=4401 if e.status_code == 401 else 4404, reason=str(e.detail))
        return
    if not can_access_consultation(user, c):
        await ws.close(code=4403, reason="Not a participant")
        return
    if c["status"] in ("completed", "cancelled"):
        await ws.accept()
        await ws.send_json({"type": "status", "status": c["status"]})
        await ws.close(code=4409, reason="Consultation is closed")
        return
    await ws.accept()
    room = hub.room(c["id"])
    staff = user["role"] in ("doctor", "student")
    doctor_present = any(p.user["role"] == "doctor" for p in room.admitted())
    peer = Peer(peer_id=hub.new_peer_id(), ws=ws, user=user, admitted=staff)
    async with room.lock:
        room.peers[peer.peer_id] = peer
    await ws.send_json({"type": "welcome", "peer_id": peer.peer_id, "admitted": peer.admitted,
                        "ice_servers": get_settings().ice_servers(),
                        "peers": [p.public() for p in room.admitted() if p.peer_id != peer.peer_id],
                        "consultation": {"status": c["status"], "started_at": c["started_at"]},
                        "doctor_present": doctor_present})
    if peer.admitted:
        await room.broadcast({"type": "peer.joined", "peer": peer.public()}, exclude=peer.peer_id)
    else:
        await room.broadcast({"type": "waiting.joined", "peer": peer.public()})
        await hub.notify_watchers({"type": "waiting", "consultation_id": c["id"], "name": user["name"]})
    await room.roster()
    try:
        while True:
            msg = await ws.receive_json()
            t = msg.get("type")
            if t == "ping":
                await ws.send_json({"type": "pong"})
            elif t == "admit" and staff:
                target = room.peers.get(msg.get("peer_id", ""))
                if target and not target.admitted:
                    target.admitted = True
                    await room.send(target, {"type": "admitted",
                                             "peers": [p.public() for p in room.admitted() if p.peer_id != target.peer_id]})
                    await room.broadcast({"type": "peer.joined", "peer": target.public()}, exclude=target.peer_id)
                    await room.roster()
            elif t == "deny" and staff:
                target = room.peers.get(msg.get("peer_id", ""))
                if target and not target.admitted:
                    await room.send(target, {"type": "denied"})
            elif not peer.admitted:
                continue  # waiting-room peers may only ping
            elif t == "signal":
                target = room.peers.get(msg.get("to", ""))
                if target and target.admitted:
                    await room.send(target, {"type": "signal", "from": peer.peer_id, "data": msg.get("data")})
            elif t == "media":
                peer.media.update({k: bool(v) for k, v in (msg.get("media") or {}).items()
                                   if k in ("audio", "video", "screen")})
                await room.broadcast({"type": "media", "peer_id": peer.peer_id, "media": peer.media},
                                     exclude=peer.peer_id)
            elif t == "transcript.interim":
                text = str(msg.get("text", ""))[:1000]
                await room.broadcast({"type": "transcript.interim", "peer_id": peer.peer_id, "name": user["name"],
                                      "role": user["role"], "text": text}, exclude=peer.peer_id)
            elif t == "transcript.final":
                text = str(msg.get("text", "")).strip()[:4000]
                if text:
                    fresh = get_consultation(c["id"])
                    seg = _insert_segment(fresh, client_id=str(msg.get("client_id") or uuid.uuid4().hex)[:64],
                                          role=user["role"], user_id=user["id"], name=user["name"], text=text,
                                          language=str(msg.get("language") or "en-IN")[:10],
                                          offset_ms=_offset_ms(fresh), source="live")
                    if seg:
                        await room.broadcast({"type": "transcript.final", "segment": seg})
            elif t == "chat":
                await room.broadcast({"type": "chat", "from": user["name"], "role": user["role"],
                                      "text": str(msg.get("text", ""))[:1000], "at": now_iso()})
    except (WebSocketDisconnect, RuntimeError):
        pass
    except Exception as e:  # malformed JSON etc.
        log.info("ws closed: %s", type(e).__name__)
    finally:
        async with room.lock:
            room.peers.pop(peer.peer_id, None)
        await room.broadcast({"type": "peer.left", "peer_id": peer.peer_id}, admitted_only=False)
        await room.roster()
        if not room.peers:
            hub.rooms.pop(c["id"], None)
