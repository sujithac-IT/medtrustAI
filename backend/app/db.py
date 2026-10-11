"""SQLite persistence: schema, connection helpers, audit log, seed data."""
import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from .config import get_settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    mrn TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    gender TEXT NOT NULL,
    blood_group TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    allergies_json TEXT NOT NULL DEFAULT '[]',
    conditions_json TEXT NOT NULL DEFAULT '[]',
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('doctor','student','patient')),
    password_hash TEXT,
    registration_number TEXT,
    specialization TEXT,
    designation TEXT,
    patient_id TEXT REFERENCES patients(id),
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS consultations (
    id TEXT PRIMARY KEY,
    room_code TEXT UNIQUE NOT NULL,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    doctor_id TEXT NOT NULL REFERENCES users(id),
    student_id TEXT REFERENCES users(id),
    reason TEXT,
    scheduled_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled','live','completed','cancelled')),
    started_at TEXT,
    ended_at TEXT,
    meet_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS transcript_segments (
    id TEXT PRIMARY KEY,
    consultation_id TEXT NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL,
    speaker_role TEXT NOT NULL,
    speaker_user_id TEXT,
    speaker_name TEXT NOT NULL,
    text TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'en-IN',
    offset_ms INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'live',
    created_at TEXT NOT NULL,
    UNIQUE (consultation_id, client_id)
);
CREATE INDEX IF NOT EXISTS ix_seg_consult ON transcript_segments(consultation_id, offset_ms);
CREATE TABLE IF NOT EXISTS case_sheets (
    id TEXT PRIMARY KEY,
    consultation_id TEXT UNIQUE NOT NULL REFERENCES consultations(id),
    patient_id TEXT NOT NULL REFERENCES patients(id),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
    version INTEGER NOT NULL DEFAULT 1,
    source TEXT NOT NULL,
    sections_json TEXT NOT NULL,
    summaries_json TEXT NOT NULL DEFAULT '{}',
    approval_json TEXT,
    content_hash TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    detail TEXT
);
"""

DEMO_PASSWORD = "MedTrust@123"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def age_from_dob(dob: str) -> int | None:
    try:
        born = date.fromisoformat(dob[:10])
    except ValueError:
        return None
    today = date.today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def connect() -> sqlite3.Connection:
    path = Path(get_settings().db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


@contextmanager
def tx() -> Iterator[sqlite3.Connection]:
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def one(sql: str, params: tuple = ()) -> dict[str, Any] | None:
    with tx() as c:
        r = c.execute(sql, params).fetchone()
        return dict(r) if r else None


def many(sql: str, params: tuple = ()) -> list[dict[str, Any]]:
    with tx() as c:
        return [dict(r) for r in c.execute(sql, params).fetchall()]


def audit(conn: sqlite3.Connection, user_id: str | None, action: str, entity: str, entity_id: str,
          detail: dict | None = None) -> None:
    conn.execute("INSERT INTO audit_log (at,user_id,action,entity,entity_id,detail) VALUES (?,?,?,?,?,?)",
                 (now_iso(), user_id, action, entity, entity_id, json.dumps(detail or {})))


def next_mrn(conn: sqlite3.Connection) -> str:
    year = date.today().year
    n = conn.execute("SELECT COUNT(*) FROM patients").fetchone()[0] + 1
    while True:
        mrn = f"MT-{year}-{n:05d}"
        if not conn.execute("SELECT 1 FROM patients WHERE mrn=?", (mrn,)).fetchone():
            return mrn
        n += 1


def init_db() -> None:
    with tx() as c:
        c.executescript(SCHEMA)
        if c.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
            _seed(c)


def _seed(c: sqlite3.Connection) -> None:
    from .security import hash_password

    ts = now_iso()
    pw = hash_password(DEMO_PASSWORD)
    patients = [
        ("pat_sundaram", "Sundaram", "Krishnamoorthy", "1968-05-14", "Male", "B+", "+919840123456",
         "patient@medtrust.demo", "42 Temple View Road, Mylapore, Chennai", "Radha Sundaram", "+919840123457",
         ["Penicillin"], ["Essential hypertension"]),
        ("pat_lakshmi", "Lakshmi", "Narayanan", "1974-08-22", "Female", "O+", "+919841234567",
         "lakshmi@medtrust.demo", "15 Anna Salai, Guindy, Chennai", "Narayanan S", "+919841234568",
         [], ["Type 2 diabetes mellitus"]),
        ("pat_vikram", "Vikram", "Singh", "1992-11-05", "Male", "AB+", "+919811055443",
         "vikram@medtrust.demo", "204 Green Glen Layout, Bengaluru", "Ananya Singh", "+919811055444",
         ["Sulfa drugs"], []),
    ]
    for p in patients:
        mrn = next_mrn(c)
        c.execute("""INSERT INTO patients (id,mrn,first_name,last_name,date_of_birth,gender,blood_group,phone,email,
                     address,emergency_contact_name,emergency_contact_phone,allergies_json,conditions_json,created_by,
                     created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                  (p[0], mrn, *p[1:11], json.dumps(p[11]), json.dumps(p[12]), "seed", ts, ts))
    users = [
        ("usr_doctor", "doctor@medtrust.demo", "Dr. Rajesh Sharma", "doctor", "TNMC-84920",
         "Internal Medicine & Cardiology", "Senior Consultant", None),
        ("usr_doctor2", "meera@medtrust.demo", "Dr. Meera Iyer", "doctor", "TNMC-77310",
         "Endocrinology", "Associate Professor", None),
        ("usr_student", "student@medtrust.demo", "Sneha Patel", "student", "MBBS-2022-092",
         "Final year MBBS", "Clinical intern", None),
        ("usr_patient", "patient@medtrust.demo", "Sundaram Krishnamoorthy", "patient", None, None, None,
         "pat_sundaram"),
        ("usr_lakshmi", "lakshmi@medtrust.demo", "Lakshmi Narayanan", "patient", None, None, None, "pat_lakshmi"),
    ]
    for u in users:
        c.execute("""INSERT INTO users (id,email,name,role,password_hash,registration_number,specialization,
                     designation,patient_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)""",
                  (u[0], u[1], u[2], u[3], pw, u[4], u[5], u[6], u[7], ts))
