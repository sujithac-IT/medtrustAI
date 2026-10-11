"""Row -> API object mappers and shared access checks."""
import json
from typing import Any

from fastapi import HTTPException

from .db import age_from_dob, one


def patient_out(p: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": p["id"], "mrn": p["mrn"], "first_name": p["first_name"], "last_name": p["last_name"],
        "full_name": f"{p['first_name']} {p['last_name']}", "date_of_birth": p["date_of_birth"],
        "age": age_from_dob(p["date_of_birth"]), "gender": p["gender"], "blood_group": p.get("blood_group"),
        "phone": p["phone"], "email": p.get("email"), "address": p.get("address"),
        "emergency_contact_name": p.get("emergency_contact_name"),
        "emergency_contact_phone": p.get("emergency_contact_phone"),
        "allergies": json.loads(p.get("allergies_json") or "[]"),
        "conditions": json.loads(p.get("conditions_json") or "[]"),
        "created_at": p["created_at"], "updated_at": p["updated_at"],
    }


CONSULT_SQL = """
SELECT c.*, p.first_name || ' ' || p.last_name AS patient_name, p.mrn AS patient_mrn,
       d.name AS doctor_name, d.specialization AS doctor_specialization, s.name AS student_name,
       cs.id AS case_sheet_id, cs.status AS case_sheet_status,
       (SELECT COUNT(*) FROM transcript_segments t WHERE t.consultation_id = c.id) AS segment_count
FROM consultations c
JOIN patients p ON p.id = c.patient_id
JOIN users d ON d.id = c.doctor_id
LEFT JOIN users s ON s.id = c.student_id
LEFT JOIN case_sheets cs ON cs.consultation_id = c.id
"""


def consultation_out(c: dict[str, Any]) -> dict[str, Any]:
    out = {k: c.get(k) for k in ("id", "room_code", "patient_id", "patient_name", "patient_mrn", "doctor_id",
                                 "doctor_name", "doctor_specialization", "student_id", "student_name", "reason",
                                 "scheduled_at", "status", "started_at", "ended_at", "case_sheet_id",
                                 "case_sheet_status", "segment_count", "created_at")}
    out["join_path"] = f"/room/{c['room_code']}"
    out["meet"] = json.loads(c.get("meet_json") or "{}")
    if out["started_at"] and out["ended_at"]:
        from datetime import datetime
        out["duration_seconds"] = int((datetime.fromisoformat(out["ended_at"]) -
                                       datetime.fromisoformat(out["started_at"])).total_seconds())
    else:
        out["duration_seconds"] = None
    return out


def get_consultation(cid: str) -> dict[str, Any]:
    c = one(CONSULT_SQL + " WHERE c.id = ? OR c.room_code = ?", (cid, cid))
    if not c:
        raise HTTPException(404, "Consultation not found")
    return c


def can_access_consultation(user: dict[str, Any], c: dict[str, Any]) -> bool:
    if user["role"] == "doctor":
        return True
    if user["role"] == "student":
        return True
    return user.get("patient_id") == c["patient_id"]


def ensure_consultation_access(user: dict[str, Any], c: dict[str, Any]) -> None:
    if not can_access_consultation(user, c):
        raise HTTPException(403, "You are not a participant of this consultation")


def ensure_patient_access(user: dict[str, Any], patient_id: str) -> None:
    if user["role"] == "patient" and user.get("patient_id") != patient_id:
        raise HTTPException(403, "Patients can only access their own record")


def segment_out(s: dict[str, Any]) -> dict[str, Any]:
    return {k: s[k] for k in ("id", "client_id", "speaker_role", "speaker_user_id", "speaker_name", "text",
                              "language", "offset_ms", "source", "created_at")}


def case_sheet_out(cs: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": cs["id"], "consultation_id": cs["consultation_id"], "patient_id": cs["patient_id"],
        "status": cs["status"], "version": cs["version"], "source": cs["source"],
        "sections": json.loads(cs["sections_json"]), "summaries": json.loads(cs["summaries_json"] or "{}"),
        "approval": json.loads(cs["approval_json"]) if cs.get("approval_json") else None,
        "content_hash": cs.get("content_hash"), "created_at": cs["created_at"], "updated_at": cs["updated_at"],
    }
