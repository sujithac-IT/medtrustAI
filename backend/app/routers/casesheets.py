import json

from fastapi import APIRouter, Depends, HTTPException, Query

from ..db import audit, many, new_id, now_iso, one, tx
from ..ratelimit import limiter
from ..schemas import ApproveIn, CaseSheetPatch
from ..security import current_user, doctor_only, public_user, staff_only
from ..serializers import (case_sheet_out, consultation_scope, ensure_consultation_access, get_consultation, page,
                           patient_out)
from ..services import casesheet as engine
from ..services.transcript import normalize_turns

router = APIRouter(prefix="/api", tags=["case-sheets"])
AI_LIMIT, AI_WINDOW = 20, 600  # per user: AI generations / summary refreshes per 10 minutes


def _context(c: dict) -> tuple[list[dict], dict]:
    patient = patient_out(one("SELECT * FROM patients WHERE id=?", (c["patient_id"],)))  # type: ignore[arg-type]
    doctor = one("SELECT * FROM users WHERE id=?", (c["doctor_id"],))
    student = one("SELECT * FROM users WHERE id=?", (c["student_id"],)) if c["student_id"] else None
    segs = many("SELECT * FROM transcript_segments WHERE consultation_id=? ORDER BY offset_ms, created_at", (c["id"],))
    return normalize_turns(segs), engine.record_for(patient, doctor, student, c)  # type: ignore[arg-type]


def _signed_payload(sections: dict, summaries: dict) -> dict:
    """What the approval hash covers: the clinical sections AND the patient-facing summary."""
    return {"sections": sections, "summaries": summaries.get("texts", {})}


@router.get("/consultations/{cid}/turns")
def normalized_turns(cid: str, user: dict = Depends(staff_only)):
    c = get_consultation(cid)
    ensure_consultation_access(user, c)
    turns, _ = _context(c)
    return turns


@router.post("/consultations/{cid}/case-sheet", status_code=201)
def generate_case_sheet(cid: str, overwrite: bool = Query(False), user: dict = Depends(staff_only)):
    c = get_consultation(cid)
    ensure_consultation_access(user, c)
    existing = one("SELECT * FROM case_sheets WHERE consultation_id=?", (c["id"],))
    if existing and existing["status"] == "approved":
        raise HTTPException(409, "Case sheet is approved and locked")
    if existing and not overwrite:
        raise HTTPException(409, f"A draft already exists (version {existing['version']}). Regenerating replaces "
                                 "every edit made to it; send overwrite=true to confirm.")
    turns, record = _context(c)
    if not turns:
        raise HTTPException(422, "Transcript is empty - record or import the conversation first")
    limiter.hit(f"ai:{user['id']}", AI_LIMIT, AI_WINDOW, "AI generation limit reached")
    sections, source, report = engine.generate(turns, record)
    sums = engine.summaries(sections)
    ts = now_iso()
    with tx() as conn:
        if existing:
            cur = conn.execute("""UPDATE case_sheets SET sections_json=?, summaries_json=?, source=?, guardrails_json=?,
                            version=version+1, updated_at=? WHERE id=? AND version=? AND status='draft'""",
                               (json.dumps(sections, ensure_ascii=False), json.dumps(sums, ensure_ascii=False), source,
                                json.dumps(report), ts, existing["id"], existing["version"]))
            if not cur.rowcount:
                raise HTTPException(409, "The case sheet changed while it was being regenerated; reload and retry")
            sid = existing["id"]
            audit(conn, user["id"], "regenerate", "case_sheet", sid, {"source": source, "replaced_version":
                                                                       existing["version"]})
        else:
            sid = new_id("cs")
            conn.execute("""INSERT INTO case_sheets (id,consultation_id,patient_id,source,sections_json,summaries_json,
                            guardrails_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)""",
                         (sid, c["id"], c["patient_id"], source, json.dumps(sections, ensure_ascii=False),
                          json.dumps(sums, ensure_ascii=False), json.dumps(report), ts, ts))
            audit(conn, user["id"], "generate", "case_sheet", sid, {"source": source,
                                                                     "guardrail_removed": len(report["removed"])})
    return case_sheet_out(one("SELECT * FROM case_sheets WHERE id=?", (sid,)))  # type: ignore[arg-type]


@router.get("/case-sheets")
def list_case_sheets(status: str | None = Query(None, pattern="^(draft|approved)$"),
                     patient_id: str | None = Query(None, max_length=64),
                     limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0),
                     user: dict = Depends(current_user)):
    scope, params = consultation_scope(user)
    where, args = [scope], list(params)
    if user["role"] == "patient":
        where.append("cs.status='approved'")
    elif patient_id:
        where.append("cs.patient_id=?")
        args.append(patient_id)
    if status:
        where.append("cs.status=?")
        args.append(status)
    rows = many(f"""SELECT cs.id, cs.consultation_id, cs.patient_id, cs.status, cs.version, cs.source, cs.created_at,
                    cs.updated_at, cs.approval_json, cs.sections_json, p.first_name || ' ' || p.last_name AS patient_name,
                    p.mrn AS patient_mrn, d.name AS doctor_name, c.scheduled_at
                    FROM case_sheets cs JOIN patients p ON p.id=cs.patient_id
                    JOIN consultations c ON c.id=cs.consultation_id JOIN users d ON d.id=c.doctor_id
                    WHERE {' AND '.join(where)} ORDER BY cs.updated_at DESC""" + page(limit, offset), tuple(args))
    out = []
    for r in rows:
        sec = json.loads(r.pop("sections_json"))
        appr = r.pop("approval_json")
        r["approval"] = json.loads(appr) if appr else None
        r["chief_complaint"] = sec.get("chief_complaint", "")
        r["assessment"] = sec.get("assessment", "")
        out.append(r)
    return out


def _load(sid: str, user: dict) -> tuple[dict, dict]:
    cs = one("SELECT * FROM case_sheets WHERE id=?", (sid,))
    if not cs:
        raise HTTPException(404, "Case sheet not found")
    c = get_consultation(cs["consultation_id"])
    ensure_consultation_access(user, c)
    if user["role"] == "patient" and cs["status"] != "approved":
        raise HTTPException(403, "Case sheet is awaiting doctor approval")
    return cs, c


def _out(cs: dict, c: dict) -> dict:
    out = case_sheet_out(cs)
    out["section_titles"] = engine.SECTION_TITLES
    out["section_order"] = engine.SECTION_KEYS
    out["attending_doctor_id"] = c["doctor_id"]
    if cs["status"] == "approved":
        # Tamper evidence: recompute the hash of what is stored and compare with the signature.
        out["integrity_ok"] = engine.content_hash(_signed_payload(out["sections"], out["summaries"])) == cs["content_hash"]
    return out


@router.get("/case-sheets/{sid}")
def get_case_sheet(sid: str, user: dict = Depends(current_user)):
    cs, c = _load(sid, user)
    return _out(cs, c)


@router.patch("/case-sheets/{sid}")
def update_case_sheet(sid: str, body: CaseSheetPatch, user: dict = Depends(staff_only)):
    cs, c = _load(sid, user)
    if cs["status"] == "approved":
        raise HTTPException(409, "Approved case sheets are read-only")
    if body.version != cs["version"]:
        raise HTTPException(409, f"Case sheet was modified by someone else (current version {cs['version']})")
    if len(json.dumps(body.sections, default=str)) > 200_000:
        raise HTTPException(413, "Case sheet content is too large")
    current = json.loads(cs["sections_json"])
    merged = {**current, **{k: v for k, v in body.sections.items() if k in engine.SECTION_KEYS}}
    sections = engine.normalize_sections(merged, current["patient_info"])
    if isinstance(body.sections.get("patient_info"), dict):  # allow editing free-text patient fields
        sections["patient_info"].update({k: str(v)[:300] for k, v in body.sections["patient_info"].items()
                                         if k in ("reason_for_visit", "blood_group")})
    with tx() as conn:
        cur = conn.execute("UPDATE case_sheets SET sections_json=?, version=version+1, updated_at=? "
                           "WHERE id=? AND version=? AND status='draft'",
                           (json.dumps(sections, ensure_ascii=False), now_iso(), sid, body.version))
        if not cur.rowcount:
            raise HTTPException(409, "Case sheet was modified by someone else; reload and retry")
        audit(conn, user["id"], "edit", "case_sheet", sid, {"sections": sorted(body.sections)})
    return get_case_sheet(sid, user)


@router.post("/case-sheets/{sid}/summaries")
def refresh_summaries(sid: str, user: dict = Depends(staff_only)):
    cs, _ = _load(sid, user)
    if cs["status"] == "approved":
        raise HTTPException(409, "Approved case sheets are read-only")
    limiter.hit(f"ai:{user['id']}", AI_LIMIT, AI_WINDOW, "AI generation limit reached")
    sums = engine.summaries(json.loads(cs["sections_json"]))
    with tx() as conn:
        conn.execute("UPDATE case_sheets SET summaries_json=?, updated_at=? WHERE id=? AND status='draft'",
                     (json.dumps(sums, ensure_ascii=False), now_iso(), sid))
    return sums


@router.post("/case-sheets/{sid}/approve")
def approve(sid: str, body: ApproveIn, user: dict = Depends(doctor_only)):
    cs, c = _load(sid, user)
    if user["id"] != c["doctor_id"]:
        raise HTTPException(403, "Only the attending doctor of this consultation can sign the case sheet")
    if cs["status"] == "approved":
        raise HTTPException(409, "Already approved")
    if body.version != cs["version"]:
        raise HTTPException(409, "Case sheet changed since you opened it; reload and review again")
    if c["status"] == "live":
        raise HTTPException(409, "End the consultation before signing, so the transcript is final")
    sections = json.loads(cs["sections_json"])
    # Rebuild the patient summary from the reviewed sections so patients never see a pre-edit AI draft.
    sums = engine.summaries(sections)
    h = engine.content_hash(_signed_payload(sections, sums))
    approval = {"approved_by": public_user(user), "approved_at": now_iso(), "content_hash": h, "version": cs["version"],
                "statement": "I have reviewed this AI-assisted case sheet and confirm it is clinically accurate."}
    ts = now_iso()
    with tx(immediate=True) as conn:
        cur = conn.execute("""UPDATE case_sheets SET status='approved', approval_json=?, content_hash=?, summaries_json=?,
                              updated_at=? WHERE id=? AND status='draft' AND version=?""",
                           (json.dumps(approval), h, json.dumps(sums, ensure_ascii=False), ts, sid, body.version))
        if not cur.rowcount:
            raise HTTPException(409, "Case sheet changed while signing; reload and review again")
        conn.execute("UPDATE consultations SET status='completed', ended_at=COALESCE(ended_at, ?), "
                     "started_at=COALESCE(started_at, ?) WHERE id=? AND status='scheduled'", (ts, ts, c["id"]))
        audit(conn, user["id"], "approve", "case_sheet", sid, {"hash": h})
    return get_case_sheet(sid, user)


@router.get("/case-sheets/{sid}/audit")
def case_sheet_audit(sid: str, user: dict = Depends(staff_only)):
    _load(sid, user)
    return many("""SELECT a.at, a.action, a.detail, u.name AS user_name, u.role AS user_role FROM audit_log a
                   LEFT JOIN users u ON u.id=a.user_id WHERE a.entity='case_sheet' AND a.entity_id=? ORDER BY a.id""",
                (sid,))
