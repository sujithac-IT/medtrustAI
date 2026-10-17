import json
import logging
import re
import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import PlainTextResponse

from ..config import get_settings
from ..db import audit, many, new_id, now_iso, one, tx
from ..realtime import Peer, hub
from ..schemas import ConsultationIn, ConsultationPatch, DemoTranscriptIn, SegmentPatch, TranscriptIn
from ..security import current_user, staff_only, user_from_ws_ticket
from ..serializers import (CONSULT_SQL, can_access_consultation, consultation_out, consultation_scope,
                           ensure_consultation_access, get_consultation, is_admin, is_assigned, page, segment_out)
from ..services import google_meet, samples
from ..services.transcript import fmt_ms

log = logging.getLogger("medtrust.consult")
router = APIRouter(prefix="/api/consultations", tags=["consultations"])
CLOSED = ("completed", "cancelled")


def _room_code() -> str:
    a = string.ascii_lowercase
    return "-".join("".join(secrets.choice(a) for _ in range(n)) for n in (3, 4, 3))


def _parse_when(value: str | None) -> datetime:
    try:
        when = datetime.fromisoformat((value or now_iso()).replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(422, "scheduled_at must be ISO-8601")
    return when if when.tzinfo else when.replace(tzinfo=timezone.utc)


def _consultation_for(cid: str, user: dict) -> dict:
    c = get_consultation(cid)
    ensure_consultation_access(user, c)
    return c


def _require_attending(user: dict, c: dict, action: str) -> None:
    if not (user["id"] == c["doctor_id"] or is_admin(user)):
        raise HTTPException(403, f"Only the attending doctor or an administrator can {action}")


async def _with_presence(items: list[dict]) -> list[dict]:
    live = await hub.live_summary()
    for o in items:
        o["presence"] = live.get(o["id"], {"admitted": 0, "waiting": 0})
    return items


def _hide_drafts(user: dict, items: list[dict]) -> list[dict]:
    if user["role"] == "patient":
        for o in items:
            if o["case_sheet_status"] != "approved":
                o["case_sheet_id"] = None
    return items


@router.get("")
async def list_consultations(status: str | None = Query(None, pattern="^(scheduled|live|completed|cancelled)$"),
                             patient_id: str | None = Query(None, max_length=64),
                             limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0),
                             user: dict = Depends(current_user)):
    scope, params = consultation_scope(user)
    where, args = [scope], list(params)
    if patient_id and user["role"] != "patient":
        where.append("c.patient_id=?")
        args.append(patient_id)
    if status:
        where.append("c.status=?")
        args.append(status)
    rows = many(CONSULT_SQL + " WHERE " + " AND ".join(where) + " ORDER BY c.scheduled_at DESC" + page(limit, offset),
                tuple(args))
    return _hide_drafts(user, await _with_presence([consultation_out(r) for r in rows]))


@router.post("", status_code=201)
def create_consultation(body: ConsultationIn, user: dict = Depends(staff_only)):
    patient = one("SELECT * FROM patients WHERE id=?", (body.patient_id,))
    if not patient:
        raise HTTPException(404, "Patient not found")
    if user["role"] == "doctor":
        doctor_id = body.doctor_id or user["id"]
        if doctor_id != user["id"] and not is_admin(user):
            raise HTTPException(403, "Only administrators can book consultations for another doctor")
        student_id = body.student_id
    else:  # students book for themselves with a supervising doctor
        doctor_id, student_id = body.doctor_id, user["id"]
    doctor = one("SELECT * FROM users WHERE id=? AND role='doctor' AND disabled=0", (doctor_id,)) if doctor_id else None
    if not doctor:
        raise HTTPException(422, "A valid attending doctor is required")
    if student_id and not one("SELECT 1 FROM users WHERE id=? AND role='student' AND disabled=0", (student_id,)):
        raise HTTPException(422, "student_id is not an active student")
    start = _parse_when(body.scheduled_at)
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
            log.warning("Google Meet provisioning failed: %s", type(e).__name__)
            meet = {"provider": "in_app", "google_error": "Google Meet provisioning failed; in-app room is active"}
    with tx() as c:
        c.execute("""INSERT INTO consultations (id,room_code,patient_id,doctor_id,student_id,reason,scheduled_at,
                     meet_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)""",
                  (cid, code, patient["id"], doctor["id"], student_id, body.reason,
                   start.isoformat(timespec="seconds"), json.dumps(meet), now_iso()))
        audit(c, user["id"], "create", "consultation", cid)
    return consultation_out(get_consultation(cid))


@router.get("/demo/scenarios")
def scenarios(user: dict = Depends(staff_only)):
    return samples.list_scenarios()


@router.get("/{cid}")
async def get_one(cid: str, user: dict = Depends(current_user)):
    c = _consultation_for(cid, user)
    out = _hide_drafts(user, await _with_presence([consultation_out(c)]))[0]
    out["ice_servers"] = get_settings().ice_servers()
    out["you_are_assigned"] = user["role"] == "patient" or is_assigned(user, c)
    return out


@router.patch("/{cid}")
async def patch_consultation(cid: str, body: ConsultationPatch, user: dict = Depends(staff_only)):
    c = _consultation_for(cid, user)
    if c["status"] in CLOSED:
        raise HTTPException(409, f"Consultation is {c['status']}")
    data = body.model_dump(exclude_unset=True)
    if "scheduled_at" in data:
        if c["status"] != "scheduled":
            raise HTTPException(409, "Only scheduled consultations can be rescheduled")
        data["scheduled_at"] = _parse_when(data["scheduled_at"]).isoformat(timespec="seconds")
    if data.get("student_id") == "":
        data["student_id"] = None
    if data.get("student_id") and not one("SELECT 1 FROM users WHERE id=? AND role='student' AND disabled=0",
                                          (data["student_id"],)):
        raise HTTPException(422, "student_id is not an active student")
    if "doctor_id" in data:
        if user["role"] != "doctor":
            raise HTTPException(403, "Only doctors can reassign the attending doctor")
        _require_attending(user, c, "reassign the attending doctor")
        if not one("SELECT 1 FROM users WHERE id=? AND role='doctor' AND disabled=0", (data["doctor_id"],)):
            raise HTTPException(422, "doctor_id is not an active doctor")
    if data.get("status") == "cancelled":
        _require_attending(user, c, "cancel this consultation")
        if c["status"] == "live":
            raise HTTPException(409, "End the live consultation instead of cancelling it")
    elif "cancel_reason" in data:
        data.pop("cancel_reason")
    if data.get("status") == "scheduled":
        data.pop("status")
    if data:
        with tx() as conn:
            conn.execute(f"UPDATE consultations SET {', '.join(f'{k}=?' for k in data)} WHERE id=?",
                         (*data.values(), c["id"]))
            audit(conn, user["id"], "cancel" if data.get("status") == "cancelled" else "update", "consultation",
                  c["id"], data)
    out = consultation_out(get_consultation(c["id"]))
    if out["status"] == "cancelled":
        await hub.close_room(out["id"], 4409, "Consultation cancelled", {"type": "status", "status": "cancelled"})
    return out


def _set_status(c: dict, status: str, user: dict) -> dict:
    with tx() as conn:
        if status == "live" and c["status"] == "scheduled":
            cur = conn.execute("UPDATE consultations SET status='live', started_at=? WHERE id=? AND status='scheduled'",
                               (now_iso(), c["id"]))
        elif status == "completed" and c["status"] in ("live", "scheduled"):
            ts = now_iso()
            cur = conn.execute("UPDATE consultations SET status='completed', ended_at=?, "
                               "started_at=COALESCE(started_at,?) WHERE id=? AND status IN ('live','scheduled')",
                               (ts, ts, c["id"]))
        else:
            return consultation_out(c)
        if cur.rowcount:
            audit(conn, user["id"], status, "consultation", c["id"])
    return consultation_out(get_consultation(c["id"]))


@router.post("/{cid}/start")
async def start(cid: str, user: dict = Depends(staff_only)):
    c = _consultation_for(cid, user)
    out = _set_status(c, "live", user)
    await hub.broadcast(out["id"], {"type": "status", "status": out["status"], "started_at": out["started_at"]})
    return out


@router.post("/{cid}/end")
async def end(cid: str, user: dict = Depends(current_user)):
    c = _consultation_for(cid, user)
    if user["role"] != "doctor":
        raise HTTPException(403, "Only the attending doctor can end the consultation")
    _require_attending(user, c, "end this consultation")
    out = _set_status(c, "completed", user)
    await hub.close_room(out["id"], 4409, "Consultation ended",
                         {"type": "status", "status": "completed", "ended_at": out["ended_at"]})
    return out


# ------------------------------------------------------------------ transcripts
def _offset_ms(c: dict) -> int:
    if not c.get("started_at"):
        return 0
    return max(0, int((datetime.now(timezone.utc) - datetime.fromisoformat(c["started_at"])).total_seconds() * 1000))


def _transcript_writable(c: dict, *, live: bool = False) -> None:
    """The transcript is evidence for a signed record: frozen once approved; live speech only while open."""
    if c["case_sheet_status"] == "approved":
        raise HTTPException(409, "The case sheet is approved; the transcript is locked")
    if c["status"] == "cancelled":
        raise HTTPException(409, "Consultation is cancelled")
    if live and c["status"] in CLOSED:
        raise HTTPException(409, "Consultation has ended")


def _insert_segment(c: dict, *, client_id: str, role: str, user_id: str | None, name: str, text: str,
                    language: str, offset_ms: int, source: str) -> dict | None:
    sid = new_id("seg")
    with tx() as conn:
        cur = conn.execute("""INSERT INTO transcript_segments (id,consultation_id,client_id,speaker_role,
                    speaker_user_id,speaker_name,text,language,offset_ms,source,created_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING""",
                           (sid, c["id"], client_id, role, user_id, name, text.strip(), language, offset_ms, source,
                            now_iso()))
        if cur.rowcount == 0:
            return None
    return segment_out(one("SELECT * FROM transcript_segments WHERE id=?", (sid,)))  # type: ignore[arg-type]


@router.get("/{cid}/transcript")
def get_transcript(cid: str, user: dict = Depends(current_user)):
    c = _consultation_for(cid, user)
    return [segment_out(s) for s in many(
        "SELECT * FROM transcript_segments WHERE consultation_id=? ORDER BY offset_ms, created_at", (c["id"],))]


@router.post("/{cid}/transcript", status_code=201)
async def add_segment(cid: str, body: TranscriptIn, user: dict = Depends(current_user)):
    c = _consultation_for(cid, user)
    # Patients may only add while the consultation is open; staff may add notes until approval.
    _transcript_writable(c, live=user["role"] == "patient")
    # Speakers are attributed to the authenticated user; only staff may attribute text to another role
    role = body.speaker_role if (body.speaker_role and user["role"] != "patient") else user["role"]
    name = user["name"] if role == user["role"] else role.capitalize()
    seg = _insert_segment(c, client_id=body.client_id or uuid.uuid4().hex, role=role, user_id=user["id"],
                          name=name, text=body.text, language=body.language,
                          offset_ms=body.offset_ms if body.offset_ms is not None else _offset_ms(c),
                          source="manual" if user["role"] != "patient" else "live")
    if seg:
        await hub.broadcast(c["id"], {"type": "transcript.final", "segment": seg})
    return seg or {"duplicate": True}


def _segment(c: dict, seg_id: str) -> dict:
    s = one("SELECT * FROM transcript_segments WHERE id=? AND consultation_id=?", (seg_id, c["id"]))
    if not s:
        raise HTTPException(404, "Transcript segment not found")
    return s


@router.patch("/{cid}/transcript/{seg_id}")
async def edit_segment(cid: str, seg_id: str, body: SegmentPatch, user: dict = Depends(staff_only)):
    """Correct a speech-recognition error or a wrong speaker. The first original text is preserved."""
    c = _consultation_for(cid, user)
    _transcript_writable(c)
    s = _segment(c, seg_id)
    data = body.model_dump(exclude_unset=True, exclude_none=True)
    if not data:
        return segment_out(s)
    if "text" in data:
        data["text"] = data["text"].strip()
    with tx() as conn:
        conn.execute(f"""UPDATE transcript_segments SET {', '.join(f'{k}=?' for k in data)},
                         original_text=COALESCE(original_text, ?), edited_by=?, edited_at=? WHERE id=?""",
                     (*data.values(), s["text"], user["id"], now_iso(), s["id"]))
        audit(conn, user["id"], "edit_segment", "consultation", c["id"],
              {"segment": s["id"], "fields": sorted(data), "before": s["text"][:500]})
    seg = segment_out(_segment(c, seg_id))
    await hub.broadcast(c["id"], {"type": "transcript.reload"})
    return seg


@router.delete("/{cid}/transcript/{seg_id}", status_code=204)
async def delete_segment(cid: str, seg_id: str, user: dict = Depends(staff_only)):
    c = _consultation_for(cid, user)
    _transcript_writable(c)
    s = _segment(c, seg_id)
    with tx() as conn:
        conn.execute("DELETE FROM transcript_segments WHERE id=?", (s["id"],))
        audit(conn, user["id"], "delete_segment", "consultation", c["id"],
              {"segment": s["id"], "speaker": s["speaker_name"], "text": s["text"][:500]})
    await hub.broadcast(c["id"], {"type": "transcript.reload"})


def _safe_filename(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]", "", s)[:40] or "consultation"


@router.get("/{cid}/transcript.txt", response_class=PlainTextResponse)
def export_transcript(cid: str, user: dict = Depends(current_user)):
    c = _consultation_for(cid, user)
    segs = many("SELECT * FROM transcript_segments WHERE consultation_id=? ORDER BY offset_ms, created_at", (c["id"],))
    head = [f"{get_settings().hospital_name} - consultation transcript",
            f"Patient: {c['patient_name']} ({c['patient_mrn']})", f"Doctor: {c['doctor_name']}",
            f"Student: {c['student_name'] or '-'}", f"Scheduled: {c['scheduled_at']}", f"Status: {c['status']}",
            f"Consultation: {c['id']}", "-" * 60, ""]
    body = [f"[{fmt_ms(s['offset_ms'])}] {s['speaker_name']} ({s['speaker_role']}): {s['text']}" for s in segs]
    with tx() as conn:
        audit(conn, user["id"], "export_transcript", "consultation", c["id"])
    return PlainTextResponse("\n".join(head + (body or ["(no transcript recorded)"])) + "\n", headers={
        "Content-Disposition": f'attachment; filename="transcript-{_safe_filename(c["room_code"])}.txt"'})


@router.post("/{cid}/transcript/demo", status_code=201)
async def load_demo(cid: str, body: DemoTranscriptIn, user: dict = Depends(staff_only)):
    c = _consultation_for(cid, user)
    _transcript_writable(c)
    sc = samples.get_scenario(body.scenario)
    if not sc:
        raise HTTPException(404, "Unknown scenario")
    existing = one("SELECT COUNT(*) AS n FROM transcript_segments WHERE consultation_id=?", (c["id"],))["n"]  # type: ignore[index]
    if existing and not body.replace:
        raise HTTPException(409, f"Transcript already has {existing} segment(s). Send replace=true to clear it first.")
    added = 0
    with tx() as conn:
        if existing:
            conn.execute("DELETE FROM transcript_segments WHERE consultation_id=?", (c["id"],))
            audit(conn, user["id"], "clear_transcript", "consultation", c["id"], {"removed": existing})
        for i, t in enumerate(sc["turns"]):
            mm, ss = t["timestamp"].split(":")
            added += 1 if _insert_segment(c, client_id=f"demo-{body.scenario}-{i}", role=t["speaker"], user_id=None,
                                          name=t["speaker_name"], text=t["text"], language="en-IN",
                                          offset_ms=(int(mm) * 60 + int(ss)) * 1000, source="demo") else 0
    await hub.broadcast(c["id"], {"type": "transcript.reload"})
    return {"added": added, "scenario": body.scenario}


_NAME_NOISE = re.compile(r"\b(dr|doctor|prof|mr|mrs|ms|mbbs|md)\b\.?", re.I)


def _name_tokens(name: str) -> set[str]:
    return {t for t in re.findall(r"[a-z]+", _NAME_NOISE.sub(" ", name.lower())) if len(t) >= 2}


def speaker_role_for(display_name: str, doctor: str | None, student: str | None) -> str:
    """Map a Meet display name to a role. Whole-name-token match only: "Raj" must not match "Rajesh"."""
    tokens = _name_tokens(display_name)
    if tokens:
        for role, name in (("doctor", doctor), ("student", student)):
            if name and tokens <= _name_tokens(name):
                return role
    return "patient"


@router.post("/{cid}/transcript/import-google")
async def import_google(cid: str, user: dict = Depends(staff_only)):
    c = _consultation_for(cid, user)
    _transcript_writable(c)
    meet = json.loads(c["meet_json"] or "{}")
    if not get_settings().google_meet_enabled:
        raise HTTPException(400, "Google Meet API is not configured on this server")
    if not meet.get("space_name"):
        raise HTTPException(400, "This consultation has no Google Meet space")
    try:
        entries = google_meet.fetch_transcript_entries(meet["space_name"])
    except Exception as e:
        log.warning("Google Meet import failed: %s", e)
        raise HTTPException(502, "Google Meet API error; try again later")
    doctor = one("SELECT name FROM users WHERE id=?", (c["doctor_id"],))
    student = one("SELECT name FROM users WHERE id=?", (c["student_id"],)) if c["student_id"] else None
    n = 0
    for e in entries:
        if not (e.get("text") or "").strip():
            continue
        if _insert_segment(c, client_id=e["entry_id"][:64],
                           role=speaker_role_for(e["speaker_name"], doctor and doctor["name"], student and student["name"]),
                           user_id=None, name=e["speaker_name"][:120], text=e["text"][:4000],
                           language=e["language"][:10], offset_ms=max(0, e["offset_ms"]), source="google_meet"):
            n += 1
    with tx() as conn:
        audit(conn, user["id"], "import_google", "consultation", c["id"], {"imported": n})
    await hub.broadcast(c["id"], {"type": "transcript.reload"})
    return {"imported": n, "total_entries": len(entries)}


# ------------------------------------------------------------------ realtime
async def _receive(ws: WebSocket) -> dict | None:
    raw = await ws.receive_text()
    if len(raw) > get_settings().ws_max_message_bytes:
        await ws.close(code=1009, reason="Message too large")
        raise WebSocketDisconnect(1009)
    try:
        msg = json.loads(raw)
    except ValueError:
        return None
    return msg if isinstance(msg, dict) else None


@router.websocket("/{cid}/ws")
async def consultation_ws(ws: WebSocket, cid: str, ticket: str = Query(..., max_length=2000)):
    """Realtime channel. See docs/API_CONTRACT.md section 4 for the message protocol."""
    try:
        c = get_consultation(cid)
        user = user_from_ws_ticket(ticket, f"consultation:{c['id']}")
    except HTTPException as e:
        await ws.close(code=4401 if e.status_code == 401 else 4404, reason=str(e.detail)[:120])
        return
    if not can_access_consultation(user, c):
        await ws.close(code=4403, reason="Not a participant")
        return
    if c["status"] in CLOSED:
        await ws.accept()
        await ws.send_json({"type": "status", "status": c["status"]})
        await ws.close(code=4409, reason="Consultation is closed")
        return
    await ws.accept()
    cid = c["id"]
    # Assigned staff enter directly. Patients (and admins observing) wait in the lobby,
    # unless they were already admitted to this consultation and are only reconnecting.
    admitted = (user["role"] != "patient" and is_assigned(user, c)) or await hub.was_admitted(cid, user["id"])
    peer = Peer(peer_id=hub.new_peer_id(), ws=ws, user=user, admitted=admitted, cid=cid)
    await hub.join(peer)
    staff = user["role"] in ("doctor", "student")
    others = [p for p in await hub.peers(cid) if p["peer_id"] != peer.peer_id]
    await ws.send_json({"type": "welcome", "peer_id": peer.peer_id, "admitted": peer.admitted,
                        "ice_servers": get_settings().ice_servers(),
                        "peers": [p for p in others if p["admitted"]] if peer.admitted else [],
                        "consultation": {"status": c["status"], "started_at": c["started_at"]},
                        "doctor_present": any(p["role"] == "doctor" and p["admitted"] for p in others)})

    async def roster() -> None:
        await hub.broadcast(cid, {"type": "roster", "peers": await hub.peers(cid)})

    if peer.admitted:
        await hub.remember_admitted(cid, user["id"])
        await hub.broadcast(cid, {"type": "peer.joined", "peer": peer.public()}, exclude=peer.peer_id)
    else:
        await hub.broadcast(cid, {"type": "waiting.joined", "peer": peer.public()})
        await hub.notify_watchers({"type": "waiting", "consultation_id": cid, "name": user["name"],
                                   "doctor_id": c["doctor_id"], "student_id": c["student_id"]})
    await roster()
    try:
        while True:
            msg = await _receive(ws)
            if msg is None:
                continue
            if not peer.allow():
                await ws.send_json({"type": "error", "code": "rate_limited", "detail": "Slow down"})
                continue
            t = msg.get("type")
            if t == "ping":
                await ws.send_json({"type": "pong"})
            elif t in ("admit", "deny") and staff and peer.admitted:
                target_id = str(msg.get("peer_id", ""))[:32]
                if t == "admit":
                    target = await hub.set_admitted(cid, target_id)
                    if target:
                        await hub.send_to(cid, target_id, {"type": "admitted", "peers": [
                            p for p in await hub.peers(cid) if p["admitted"] and p["peer_id"] != target_id]})
                        await hub.broadcast(cid, {"type": "peer.joined", "peer": target}, exclude=target_id)
                        await roster()
                else:
                    target = await hub.peer(cid, target_id)
                    if target and not target["admitted"]:
                        await hub.send_to(cid, target_id, {"type": "denied"})
            elif not peer.admitted:
                continue  # waiting-room peers may only ping
            elif t == "signal":
                target_id = str(msg.get("to", ""))[:32]
                target = await hub.peer(cid, target_id)
                data = msg.get("data")
                if target and target["admitted"] and isinstance(data, dict):
                    await hub.send_to(cid, target_id, {"type": "signal", "from": peer.peer_id, "data": data})
            elif t == "media":
                media = msg.get("media") if isinstance(msg.get("media"), dict) else {}
                await hub.set_media(peer, {k: bool(v) for k, v in media.items() if k in ("audio", "video", "screen")})
                await hub.broadcast(cid, {"type": "media", "peer_id": peer.peer_id, "media": peer.media},
                                    exclude=peer.peer_id)
            elif t == "transcript.interim":
                text = str(msg.get("text", ""))[:1000]
                await hub.broadcast(cid, {"type": "transcript.interim", "peer_id": peer.peer_id, "name": user["name"],
                                          "role": user["role"], "text": text}, exclude=peer.peer_id)
            elif t == "transcript.final":
                text = str(msg.get("text", "")).strip()[:4000]
                if not text:
                    continue
                fresh = get_consultation(cid)
                try:
                    _transcript_writable(fresh, live=True)
                except HTTPException as e:
                    await ws.send_json({"type": "error", "code": "transcript_locked", "detail": e.detail})
                    continue
                seg = _insert_segment(fresh, client_id=str(msg.get("client_id") or uuid.uuid4().hex)[:64],
                                      role=user["role"], user_id=user["id"], name=user["name"], text=text,
                                      language=str(msg.get("language") or "en-IN")[:10],
                                      offset_ms=_offset_ms(fresh), source="live")
                if seg:
                    await hub.broadcast(cid, {"type": "transcript.final", "segment": seg})
                else:  # duplicate client_id (a resend after reconnect): acknowledge so the client stops retrying
                    await ws.send_json({"type": "transcript.ack", "client_id": str(msg.get("client_id"))[:64]})
            elif t == "chat":
                text = str(msg.get("text", "")).strip()[:1000]
                if text:
                    await hub.broadcast(cid, {"type": "chat", "from": user["name"], "role": user["role"],
                                              "text": text, "at": now_iso()})
    except (WebSocketDisconnect, RuntimeError):
        pass
    except Exception as e:
        log.info("ws closed: %s", type(e).__name__)
    finally:
        await hub.leave(peer)
        await hub.broadcast(cid, {"type": "peer.left", "peer_id": peer.peer_id}, admitted_only=False)
        await roster()
