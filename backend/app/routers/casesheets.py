import json

from fastapi import APIRouter, Depends, HTTPException, Query

from ..db import audit, many, new_id, now_iso, one, tx
from ..schemas import ApproveIn, CaseSheetPatch
from ..security import current_user, doctor_only, public_user, staff_only
from ..serializers import case_sheet_out, ensure_patient_access, get_consultation, patient_out
from ..services import casesheet as engine
from ..services.transcript import normalize_turns

router = APIRouter(prefix="/api", tags=["case-sheets"])


def _context(c: dict) -> tuple[list[dict], dict]:
    patient = patient_out(one("SELECT * FROM patients WHERE id=?", (c["patient_id"],)))  # type: ignore[arg-type]
    doctor = one("SELECT * FROM users WHERE id=?", (c["doctor_id"],))
    student = one("SELECT * FROM users WHERE id=?", (c["student_id"],)) if c["student_id"] else None
    segs = many("SELECT * FROM transcript_segments WHERE consultation_id=? ORDER BY offset_ms, created_at", (c["id"],))
    return normalize_turns(segs), engine.record_for(patient, doctor, student, c)  # type: ignore[arg-type]


@router.get("/consultations/{cid}/turns")
def normalized_turns(cid: str, user: dict = Depends(staff_only)):
    turns, _ = _context(get_consultation(cid))
    return turns


@router.post("/consultations/{cid}/case-sheet", status_code=201)
def generate_case_sheet(cid: str, user: dict = Depends(staff_only)):
    c = get_consultation(cid)
    turns, record = _context(c)
    if not turns:
        raise HTTPException(422, "Transcript is empty - record or import the conversation first")
    existing = one("SELECT * FROM case_sheets WHERE consultation_id=?", (c["id"],))
    if existing and existing["status"] == "approved":
        raise HTTPException(409, "Case sheet is approved and locked")
    sections, source = engine.generate(turns, record)
    sums = engine.summaries(sections)
    ts = now_iso()
    with tx() as conn:
        if existing:
            conn.execute("""UPDATE case_sheets SET sections_json=?, summaries_json=?, source=?, version=version+1,
                            updated_at=? WHERE id=?""",
                         (json.dumps(sections, ensure_ascii=False), json.dumps(sums, ensure_ascii=False), source, ts,
                          existing["id"]))
            sid = existing["id"]
            audit(conn, user["id"], "regenerate", "case_sheet", sid, {"source": source})
        else:
            sid = new_id("cs")
            conn.execute("""INSERT INTO case_sheets (id,consultation_id,patient_id,source,sections_json,summaries_json,
                            created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)""",
                         (sid, c["id"], c["patient_id"], source, json.dumps(sections, ensure_ascii=False),
                          json.dumps(sums, ensure_ascii=False), ts, ts))
            audit(conn, user["id"], "generate", "case_sheet", sid, {"source": source})
    return case_sheet_out(one("SELECT * FROM case_sheets WHERE id=?", (sid,)))  # type: ignore[arg-type]


@router.get("/case-sheets")
def list_case_sheets(status: str | None = Query(None), patient_id: str | None = None,
                     user: dict = Depends(current_user)):
    where, params = ["1=1"], []
    if user["role"] == "patient":
        where += ["cs.patient_id=?", "cs.status='approved'"]
        params.append(user.get("patient_id"))
    elif patient_id:
        where.append("cs.patient_id=?")
        params.append(patient_id)
    if status:
        where.append("cs.status=?")
        params.append(status)
    rows = many(f"""SELECT cs.id, cs.consultation_id, cs.patient_id, cs.status, cs.version, cs.source, cs.created_at,
                    cs.updated_at, cs.approval_json, cs.sections_json, p.first_name || ' ' || p.last_name AS patient_name,
                    p.mrn AS patient_mrn, d.name AS doctor_name, c.scheduled_at
                    FROM case_sheets cs JOIN patients p ON p.id=cs.patient_id
                    JOIN consultations c ON c.id=cs.consultation_id JOIN users d ON d.id=c.doctor_id
                    WHERE {' AND '.join(where)} ORDER BY cs.updated_at DESC""", tuple(params))
    out = []
    for r in rows:
        sec = json.loads(r.pop("sections_json"))
        appr = r.pop("approval_json")
        r["approval"] = json.loads(appr) if appr else None
        r["chief_complaint"] = sec.get("chief_complaint", "")
        r["assessment"] = sec.get("assessment", "")
        out.append(r)
    return out


def _load(sid: str, user: dict) -> dict:
    cs = one("SELECT * FROM case_sheets WHERE id=?", (sid,))
    if not cs:
        raise HTTPException(404, "Case sheet not found")
    ensure_patient_access(user, cs["patient_id"])
    if user["role"] == "patient" and cs["status"] != "approved":
        raise HTTPException(403, "Case sheet is awaiting doctor approval")
    return cs


@router.get("/case-sheets/{sid}")
def get_case_sheet(sid: str, user: dict = Depends(current_user)):
    cs = case_sheet_out(_load(sid, user))
    cs["section_titles"] = engine.SECTION_TITLES
    cs["section_order"] = engine.SECTION_KEYS
    return cs


@router.patch("/case-sheets/{sid}")
def update_case_sheet(sid: str, body: CaseSheetPatch, user: dict = Depends(staff_only)):
    cs = _load(sid, user)
    if cs["status"] == "approved":
        raise HTTPException(409, "Approved case sheets are read-only")
    if body.version != cs["version"]:
        raise HTTPException(409, f"Case sheet was modified by someone else (current version {cs['version']})")
    current = json.loads(cs["sections_json"])
    merged = {**current, **{k: v for k, v in body.sections.items() if k in engine.SECTION_KEYS}}
    sections = engine.normalize_sections(merged, current["patient_info"])
    if isinstance(body.sections.get("patient_info"), dict):  # allow editing free-text patient fields
        sections["patient_info"].update({k: v for k, v in body.sections["patient_info"].items()
                                         if k in ("reason_for_visit", "blood_group")})
    with tx() as conn:
        conn.execute("UPDATE case_sheets SET sections_json=?, version=version+1, updated_at=? WHERE id=? AND version=?",
                     (json.dumps(sections, ensure_ascii=False), now_iso(), sid, body.version))
        audit(conn, user["id"], "edit", "case_sheet", sid, {"sections": sorted(body.sections)})
    return get_case_sheet(sid, user)


@router.post("/case-sheets/{sid}/summaries")
def refresh_summaries(sid: str, user: dict = Depends(staff_only)):
    cs = _load(sid, user)
    if cs["status"] == "approved":
        raise HTTPException(409, "Approved case sheets are read-only")
    sums = engine.summaries(json.loads(cs["sections_json"]))
    with tx() as conn:
        conn.execute("UPDATE case_sheets SET summaries_json=?, updated_at=? WHERE id=?",
                     (json.dumps(sums, ensure_ascii=False), now_iso(), sid))
    return sums


@router.post("/case-sheets/{sid}/approve")
def approve(sid: str, body: ApproveIn, user: dict = Depends(doctor_only)):
    cs = _load(sid, user)
    if cs["status"] == "approved":
        raise HTTPException(409, "Already approved")
    if body.version != cs["version"]:
        raise HTTPException(409, "Case sheet changed since you opened it; reload and review again")
    sections = json.loads(cs["sections_json"])
    h = engine.content_hash(sections)
    approval = {"approved_by": public_user(user), "approved_at": now_iso(), "content_hash": h,
                "statement": "I have reviewed this AI-assisted case sheet and confirm it is clinically accurate."}
    with tx() as conn:
        conn.execute("""UPDATE case_sheets SET status='approved', approval_json=?, content_hash=?, updated_at=?
                        WHERE id=? AND status='draft'""", (json.dumps(approval), h, now_iso(), sid))
        audit(conn, user["id"], "approve", "case_sheet", sid, {"hash": h})
    return get_case_sheet(sid, user)


@router.get("/case-sheets/{sid}/audit")
def case_sheet_audit(sid: str, user: dict = Depends(staff_only)):
    _load(sid, user)
    return many("""SELECT a.at, a.action, a.detail, u.name AS user_name, u.role AS user_role FROM audit_log a
                   LEFT JOIN users u ON u.id=a.user_id WHERE a.entity='case_sheet' AND a.entity_id=? ORDER BY a.id""",
                (sid,))
