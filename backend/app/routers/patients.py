import json
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Query

from ..db import audit, many, new_id, next_mrn, now_iso, one, tx
from ..schemas import PatientIn, PatientPatch
from ..security import current_user, staff_only
from ..serializers import CONSULT_SQL, consultation_out, ensure_patient_access, patient_out

router = APIRouter(prefix="/api/patients", tags=["patients"])


@router.get("")
def list_patients(q: str | None = Query(None, max_length=80), user: dict = Depends(staff_only)):
    if q:
        like = f"%{q.strip()}%"
        rows = many("""SELECT * FROM patients WHERE first_name || ' ' || last_name LIKE ? OR mrn LIKE ?
                       OR phone LIKE ? OR email LIKE ? ORDER BY updated_at DESC""", (like, like, like, like))
    else:
        rows = many("SELECT * FROM patients ORDER BY updated_at DESC")
    return [patient_out(r) for r in rows]


@router.post("", status_code=201)
def create_patient(body: PatientIn, user: dict = Depends(staff_only)):
    pid = new_id("pat")
    ts = now_iso()
    try:
        with tx() as c:
            mrn = next_mrn(c)
            c.execute("""INSERT INTO patients (id,mrn,first_name,last_name,date_of_birth,gender,blood_group,phone,email,
                         address,emergency_contact_name,emergency_contact_phone,allergies_json,conditions_json,
                         created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                      (pid, mrn, body.first_name.strip(), body.last_name.strip(), body.date_of_birth.isoformat(),
                       body.gender, body.blood_group, body.phone, body.email, body.address,
                       body.emergency_contact_name, body.emergency_contact_phone, json.dumps(body.allergies),
                       json.dumps(body.conditions), user["id"], ts, ts))
            audit(c, user["id"], "create", "patient", pid)
    except sqlite3.IntegrityError as e:
        raise HTTPException(409, f"Could not create patient: {e}")
    return patient_out(one("SELECT * FROM patients WHERE id=?", (pid,)))  # type: ignore[arg-type]


@router.get("/{pid}")
def get_patient(pid: str, user: dict = Depends(current_user)):
    ensure_patient_access(user, pid)
    p = one("SELECT * FROM patients WHERE id=?", (pid,))
    if not p:
        raise HTTPException(404, "Patient not found")
    return patient_out(p)


@router.patch("/{pid}")
def update_patient(pid: str, body: PatientPatch, user: dict = Depends(staff_only)):
    if not one("SELECT id FROM patients WHERE id=?", (pid,)):
        raise HTTPException(404, "Patient not found")
    data = body.model_dump(exclude_unset=True)
    cols, vals = [], []
    for k, v in data.items():
        if k in ("allergies", "conditions"):
            cols.append(f"{k}_json=?")
            vals.append(json.dumps([t.strip() for t in (v or []) if t.strip()]))
        else:
            cols.append(f"{k}=?")
            vals.append(v)
    if cols:
        with tx() as c:
            c.execute(f"UPDATE patients SET {', '.join(cols)}, updated_at=? WHERE id=?", (*vals, now_iso(), pid))
            audit(c, user["id"], "update", "patient", pid, {"fields": list(data)})
    return patient_out(one("SELECT * FROM patients WHERE id=?", (pid,)))  # type: ignore[arg-type]


@router.get("/{pid}/history")
def patient_history(pid: str, user: dict = Depends(current_user)):
    ensure_patient_access(user, pid)
    p = one("SELECT * FROM patients WHERE id=?", (pid,))
    if not p:
        raise HTTPException(404, "Patient not found")
    rows = many(CONSULT_SQL + " WHERE c.patient_id=? ORDER BY c.scheduled_at DESC", (pid,))
    items = [consultation_out(r) for r in rows]
    if user["role"] == "patient":
        for i in items:
            if i["case_sheet_status"] != "approved":
                i["case_sheet_id"] = None
    return {"patient": patient_out(p), "consultations": items}
