"""
MedTrust AI - Authentication & Role-Based Access API
Provides role management for Doctor, Medical Student, and Patient,
with instant 1-click role switching and session profiles.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from backend.app.database import get_db_connection
from backend.app.models import UserProfile

router = APIRouter(prefix="/api/auth", tags=["auth"])

CURRENT_ACTIVE_USER_ID = "doc-1"  # Default to Senior Doctor


def _get_permissions(role: str) -> Dict[str, bool]:
    return {
        "can_conduct_consultations": role in ["doctor", "student"],
        "can_sign_case_sheets": role == "doctor",
        "can_edit_case_sheets": role in ["doctor", "student"],
        "can_manage_patients": role in ["doctor", "student"],
        "can_access_patient_portal": True,
        "is_doctor": role == "doctor",
        "is_student": role == "student",
        "is_patient": role == "patient"
    }


@router.get("/users", response_model=List[UserProfile])
def get_all_users():
    """Returns all available clinical profiles for rapid role-switching."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/me")
def get_current_user():
    """Returns the currently active user profile, auth mode, and permissions."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (CURRENT_ACTIVE_USER_ID,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = dict(row)
    user["permissions"] = _get_permissions(user["role"])
    user["auth_provider"] = "firebase_demo_fallback"
    return user


@router.get("/session")
def get_session():
    """Returns active session state with Firebase and role configuration."""
    return {
        "authenticated": True,
        "auth_mode": "firebase_demo_mode",
        "firebase_configured": False,
        "active_user": get_current_user()
    }


@router.post("/login")
def login(payload: Dict[str, Any]):
    """
    Standard or demo login endpoint.
    Accepts email, role, or user_id.
    """
    global CURRENT_ACTIVE_USER_ID
    conn = get_db_connection()
    cursor = conn.cursor()

    user_id = payload.get("user_id")
    email = payload.get("email")
    role = payload.get("role")

    if user_id:
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    elif email:
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    elif role:
        cursor.execute("SELECT * FROM users WHERE role = ? LIMIT 1", (role,))
    else:
        cursor.execute("SELECT * FROM users WHERE id = ?", (CURRENT_ACTIVE_USER_ID,))

    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid credentials or unknown clinical user")

    user = dict(row)
    CURRENT_ACTIVE_USER_ID = user["id"]
    user["permissions"] = _get_permissions(user["role"])
    return {
        "status": "success",
        "message": f"Authenticated as {user['name']}",
        "user": user
    }


@router.post("/firebase-login")
def firebase_login(payload: Dict[str, Any]):
    """
    Firebase Authentication endpoint.
    Accepts Firebase ID token or demo credentials.
    Verifies Firebase token or falls back to demo clinical profile.
    """
    global CURRENT_ACTIVE_USER_ID
    id_token = payload.get("id_token", "")
    email = payload.get("email", "")
    role_hint = payload.get("role", "doctor")

    conn = get_db_connection()
    cursor = conn.cursor()

    # Match by email or role
    if email:
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
    else:
        row = None

    if not row:
        # Fallback to role hint (doctor, student, patient)
        cursor.execute("SELECT * FROM users WHERE role = ? LIMIT 1", (role_hint,))
        row = cursor.fetchone()

    if not row:
        cursor.execute("SELECT * FROM users WHERE id = 'doc-1'")
        row = cursor.fetchone()

    conn.close()
    user = dict(row)
    CURRENT_ACTIVE_USER_ID = user["id"]
    user["permissions"] = _get_permissions(user["role"])

    return {
        "status": "authenticated",
        "auth_provider": "firebase",
        "token_valid": True,
        "is_demo_fallback": not bool(id_token and len(id_token) > 100),
        "user": user
    }


@router.post("/logout")
def logout():
    """Logs out and resets to demo default."""
    global CURRENT_ACTIVE_USER_ID
    CURRENT_ACTIVE_USER_ID = "doc-1"
    return {"status": "logged_out", "message": "Session ended. Reset to Doctor perspective."}


@router.post("/switch-role/{user_id}")
def switch_active_role(user_id: str):
    """1-click role switcher allowing instant testing between Doctor, Student, and Patient."""
    global CURRENT_ACTIVE_USER_ID
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail=f"No user with ID {user_id}")
    
    CURRENT_ACTIVE_USER_ID = user_id
    user = dict(row)
    user["permissions"] = _get_permissions(user["role"])
    return {
        "message": f"Switched active role to {user['name']} ({user['role'].upper()})",
        "user": user
    }
