"""Persistence: schema, migrations, connection handling, audit log, seed data.

Two backends behind one tiny API (`tx`, `one`, `many`):
- SQLite (default): zero-dependency, low-RAM, one connection reused per thread.
- PostgreSQL (`DATABASE_URL=postgresql://...`): pooled connections for multi-instance deployments.

SQL is written once with `?` placeholders and portable syntax (`ON CONFLICT DO NOTHING`, `||`).
"""
import json
import logging
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from .config import get_settings

log = logging.getLogger("medtrust.db")

TABLES = """
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
    created_at TEXT NOT NULL,
    disabled INTEGER NOT NULL DEFAULT 0,
    phone TEXT,
    is_admin INTEGER NOT NULL DEFAULT 0
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
    created_at TEXT NOT NULL,
    cancel_reason TEXT
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
    original_text TEXT,
    edited_by TEXT,
    edited_at TEXT,
    UNIQUE (consultation_id, client_id)
);
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
    updated_at TEXT NOT NULL,
    guardrails_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS audit_log (
    id {autoinc},
    at TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    detail TEXT
);
CREATE TABLE IF NOT EXISTS rate_events (
    key TEXT NOT NULL,
    at REAL NOT NULL
);
"""
INDEXES = [
    "CREATE INDEX IF NOT EXISTS ix_seg_consult ON transcript_segments(consultation_id, offset_ms)",
    "CREATE INDEX IF NOT EXISTS ix_audit_entity ON audit_log(entity, entity_id)",
    "CREATE INDEX IF NOT EXISTS ix_consult_patient ON consultations(patient_id, scheduled_at)",
    "CREATE INDEX IF NOT EXISTS ix_consult_doctor ON consultations(doctor_id, scheduled_at)",
    "CREATE INDEX IF NOT EXISTS ix_consult_student ON consultations(student_id, scheduled_at)",
    "CREATE INDEX IF NOT EXISTS ix_consult_sched ON consultations(scheduled_at)",
    "CREATE INDEX IF NOT EXISTS ix_cs_patient ON case_sheets(patient_id, updated_at)",
    "CREATE INDEX IF NOT EXISTS ix_rate_key ON rate_events(key, at)",
]

# Forward-only migrations for databases created by older releases. Append; never edit a shipped entry.
# A fresh database is created from TABLES (already the latest shape) and stamped with len(MIGRATIONS).
MIGRATIONS: list[list[str]] = [
    [  # 1: transcript corrections + staff account lifecycle
        "ALTER TABLE transcript_segments ADD COLUMN original_text TEXT",
        "ALTER TABLE transcript_segments ADD COLUMN edited_by TEXT",
        "ALTER TABLE transcript_segments ADD COLUMN edited_at TEXT",
        "ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN phone TEXT",
        "ALTER TABLE consultations ADD COLUMN cancel_reason TEXT",
    ],
    [  # 2: admin role, AI guardrail report, shared rate limiting
        "ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE case_sheets ADD COLUMN guardrails_json TEXT NOT NULL DEFAULT '{}'",
        "CREATE TABLE IF NOT EXISTS rate_events (key TEXT NOT NULL, at REAL NOT NULL)",
        "UPDATE users SET is_admin=1 WHERE id='usr_doctor'",
    ],
]

DEMO_PASSWORD = "MedTrust@123"


class Row(dict):
    """Dict row that also supports positional access (`row[0]`), for both drivers."""

    def __getitem__(self, k: Any) -> Any:
        if isinstance(k, int):
            return list(self.values())[k]
        return super().__getitem__(k)


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


# ------------------------------------------------------------------ drivers
class _Conn:
    """Thin adapter giving sqlite3 and psycopg the same `execute()` surface."""

    def __init__(self, raw: Any, dialect: str) -> None:
        self.raw, self.dialect = raw, dialect

    def execute(self, sql: str, params: tuple | list = ()) -> Any:
        if self.dialect == "postgres":
            sql = sql.replace("%", "%%").replace("?", "%s")
        return self.raw.execute(sql, tuple(params))


def _sqlite_row(cursor: sqlite3.Cursor, values: tuple) -> Row:
    return Row(zip([d[0] for d in cursor.description], values))


class _SQLite:
    dialect = "sqlite"

    def __init__(self, path: str) -> None:
        self.path = path
        self.local = threading.local()
        Path(path).parent.mkdir(parents=True, exist_ok=True)

    def acquire(self) -> sqlite3.Connection:
        conn = getattr(self.local, "conn", None)
        if conn is None:
            conn = sqlite3.connect(self.path, timeout=15, check_same_thread=False, isolation_level=None)
            conn.row_factory = _sqlite_row
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA foreign_keys=ON")
            conn.execute("PRAGMA synchronous=NORMAL")
            conn.execute("PRAGMA busy_timeout=15000")
            conn.execute("PRAGMA cache_size=-4000")  # ~4 MB page cache per connection: friendly to small devices
            self.local.conn = conn
        return conn

    def release(self, conn: Any, broken: bool = False) -> None:
        if broken:
            try:
                conn.close()
            finally:
                self.local.conn = None

    def begin(self, conn: sqlite3.Connection, immediate: bool) -> None:
        conn.execute("BEGIN IMMEDIATE" if immediate else "BEGIN")

    def commit(self, conn: sqlite3.Connection) -> None:
        conn.execute("COMMIT")

    def rollback(self, conn: sqlite3.Connection) -> None:
        if conn.in_transaction:
            conn.execute("ROLLBACK")

    def close(self) -> None:
        conn = getattr(self.local, "conn", None)
        if conn is not None:
            conn.close()
            self.local.conn = None


class _Postgres:
    dialect = "postgres"

    def __init__(self, url: str, max_size: int) -> None:
        import psycopg
        from psycopg_pool import ConnectionPool

        def row_factory(cursor: Any) -> Any:
            names = [c.name for c in cursor.description] if cursor.description else []
            return lambda values: Row(zip(names, values))

        def configure(conn: Any) -> None:
            conn.row_factory = row_factory

        self.psycopg = psycopg
        self.pool = ConnectionPool(url, min_size=1, max_size=max_size, configure=configure, open=True,
                                   kwargs={"autocommit": False})

    def acquire(self) -> Any:
        return self.pool.getconn()

    def release(self, conn: Any, broken: bool = False) -> None:
        self.pool.putconn(conn)

    def begin(self, conn: Any, immediate: bool) -> None:
        if immediate:  # serialise read-then-write sections (MRN allocation) across all instances
            conn.execute("SELECT pg_advisory_xact_lock(4242)")

    def commit(self, conn: Any) -> None:
        conn.commit()

    def rollback(self, conn: Any) -> None:
        conn.rollback()

    def close(self) -> None:
        self.pool.close()


_driver: Any = None
_driver_lock = threading.Lock()
_tx_state = threading.local()


def driver() -> Any:
    global _driver
    if _driver is None:
        with _driver_lock:
            if _driver is None:
                s = get_settings()
                _driver = (_Postgres(s.database_url, s.db_pool_size) if s.database_url.startswith("postgres")
                           else _SQLite(s.db_path))
    return _driver


def dialect() -> str:
    return driver().dialect


def integrity_errors() -> tuple[type[Exception], ...]:
    errs: list[type[Exception]] = [sqlite3.IntegrityError]
    try:
        import psycopg
        errs.append(psycopg.errors.IntegrityError)
    except ImportError:
        pass
    return tuple(errs)


IntegrityError = integrity_errors()


@contextmanager
def tx(immediate: bool = False) -> Iterator[_Conn]:
    """Transaction scope. Nested calls on the same thread join the outer transaction.

    `immediate=True` takes the write lock up front (serialises read-then-write logic)."""
    depth = getattr(_tx_state, "depth", 0)
    if depth:
        _tx_state.depth = depth + 1
        try:
            yield _tx_state.conn
        finally:
            _tx_state.depth = depth
        return
    d = driver()
    raw = d.acquire()
    broken = False
    conn = _Conn(raw, d.dialect)
    _tx_state.conn, _tx_state.depth = conn, 1
    try:
        d.begin(raw, immediate)
        yield conn
        d.commit(raw)
    except BaseException:
        try:
            d.rollback(raw)
        except Exception:
            broken = True
        raise
    finally:
        _tx_state.depth, _tx_state.conn = 0, None
        d.release(raw, broken)


def one(sql: str, params: tuple = ()) -> dict[str, Any] | None:
    with tx() as c:
        r = c.execute(sql, params).fetchone()
        return dict(r) if r else None


def many(sql: str, params: tuple = ()) -> list[dict[str, Any]]:
    with tx() as c:
        return [dict(r) for r in c.execute(sql, params).fetchall()]


def audit(conn: _Conn, user_id: str | None, action: str, entity: str, entity_id: str,
          detail: dict | None = None) -> None:
    conn.execute("INSERT INTO audit_log (at,user_id,action,entity,entity_id,detail) VALUES (?,?,?,?,?,?)",
                 (now_iso(), user_id, action, entity, entity_id, json.dumps(detail or {}, default=str)))


def next_mrn(conn: _Conn) -> str:
    """Next MRN for this year. Call inside `tx(immediate=True)` so concurrent creates cannot collide."""
    year = date.today().year
    prefix = f"MT-{year}-"
    start = len(prefix) + 1  # integer literal: avoids driver-specific parameter typing inside substr()
    last = conn.execute(f"SELECT MAX(CAST(substr(mrn, {start}) AS INTEGER)) FROM patients WHERE mrn LIKE ?",
                        (prefix + "%",)).fetchone()[0]
    n = (last or 0) + 1
    while True:
        mrn = f"MT-{year}-{n:05d}"
        if not conn.execute("SELECT 1 FROM patients WHERE mrn=?", (mrn,)).fetchone():
            return mrn
        n += 1


# ------------------------------------------------------------------ schema management
def _table_exists(c: _Conn, name: str) -> bool:
    if c.dialect == "sqlite":
        return bool(c.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone())
    return c.execute("SELECT to_regclass(?) AS t", (name,)).fetchone()["t"] is not None


def schema_version(c: _Conn) -> int:
    if c.dialect == "sqlite":
        return c.execute("PRAGMA user_version").fetchone()[0]
    c.execute("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)")
    r = c.execute("SELECT version FROM schema_version").fetchone()
    return r["version"] if r else 0


def _set_version(c: _Conn, v: int) -> None:
    if c.dialect == "sqlite":
        c.execute(f"PRAGMA user_version={int(v)}")
    else:
        c.execute("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)")
        c.execute("DELETE FROM schema_version")
        c.execute("INSERT INTO schema_version (version) VALUES (?)", (v,))


def _create_tables(c: _Conn) -> None:
    autoinc = "INTEGER PRIMARY KEY AUTOINCREMENT" if c.dialect == "sqlite" else "BIGSERIAL PRIMARY KEY"
    for stmt in TABLES.replace("{autoinc}", autoinc).split(";"):
        if stmt.strip():
            c.execute(stmt)


def migrate(c: _Conn) -> int:
    fresh = not _table_exists(c, "users")
    _create_tables(c)
    if fresh:
        _set_version(c, len(MIGRATIONS))
    version = schema_version(c)
    for i, stmts in enumerate(MIGRATIONS[version:], start=version + 1):
        for sql in stmts:
            if c.dialect == "postgres" and sql.startswith("ALTER TABLE") and "ADD COLUMN" in sql:
                sql = sql.replace("ADD COLUMN", "ADD COLUMN IF NOT EXISTS")
            try:
                c.execute(sql)
            except sqlite3.OperationalError as e:
                if "duplicate column" not in str(e):
                    raise
        _set_version(c, i)
        log.info("Applied database migration %d", i)
    for sql in INDEXES:
        c.execute(sql)
    return len(MIGRATIONS)


def init_db() -> None:
    with tx(immediate=True) as c:
        migrate(c)
        if c.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
            _seed(c)


def _seed(c: _Conn) -> None:
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
         "Internal Medicine & Cardiology", "Senior Consultant", None, 1),
        ("usr_doctor2", "meera@medtrust.demo", "Dr. Meera Iyer", "doctor", "TNMC-77310",
         "Endocrinology", "Associate Professor", None, 0),
        ("usr_student", "student@medtrust.demo", "Sneha Patel", "student", "MBBS-2022-092",
         "Final year MBBS", "Clinical intern", None, 0),
        ("usr_patient", "patient@medtrust.demo", "Sundaram Krishnamoorthy", "patient", None, None, None,
         "pat_sundaram", 0),
        ("usr_lakshmi", "lakshmi@medtrust.demo", "Lakshmi Narayanan", "patient", None, None, None, "pat_lakshmi", 0),
    ]
    for u in users:
        c.execute("""INSERT INTO users (id,email,name,role,password_hash,registration_number,specialization,
                     designation,patient_id,is_admin,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                  (u[0], u[1], u[2], u[3], pw, u[4], u[5], u[6], u[7], u[8], ts))
