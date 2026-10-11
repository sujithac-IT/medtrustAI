"""Runtime configuration loaded from environment variables."""
import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "backend" / ".env")


def _bool(name: str, default: bool) -> bool:
    v = os.getenv(name)
    return default if v is None else v.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    def __init__(self) -> None:
        self.app_name = "MedTrust AI"
        self.hospital_name = os.getenv("HOSPITAL_NAME", "MedTrust University Teaching Hospital")
        db = Path(os.getenv("DATABASE_PATH", "backend/data/medtrust.db"))
        self.db_path = str(db if db.is_absolute() else ROOT / db)
        self.jwt_secret = os.getenv("JWT_SECRET", "dev-only-change-me-" + "x" * 24)
        self.jwt_ttl_hours = int(os.getenv("JWT_TTL_HOURS", "12"))
        self.demo_mode = _bool("DEMO_MODE", True)
        self.doctor_invite_code = os.getenv("DOCTOR_INVITE_CODE", "")
        self.cors_origins = [o.strip() for o in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://localhost:8000,http://127.0.0.1:5173").split(",") if o.strip()]
        self.frontend_dist = Path(os.getenv("FRONTEND_DIST", str(ROOT / "frontend" / "dist")))
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        self.firebase_project_id = os.getenv("FIREBASE_PROJECT_ID", "").strip()
        self.google_client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
        self.google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
        self.google_refresh_token = os.getenv("GOOGLE_REFRESH_TOKEN", "").strip()
        self.google_calendar_id = os.getenv("GOOGLE_CALENDAR_ID", "primary")
        self.stun_urls = os.getenv("STUN_URLS", "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302")
        self.turn_url = os.getenv("TURN_URL", "")
        self.turn_username = os.getenv("TURN_USERNAME", "")
        self.turn_credential = os.getenv("TURN_CREDENTIAL", "")

    @property
    def gemini_enabled(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def google_meet_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret and self.google_refresh_token)

    @property
    def firebase_enabled(self) -> bool:
        return bool(self.firebase_project_id)

    def ice_servers(self) -> list[dict]:
        servers: list[dict] = [{"urls": [u.strip() for u in self.stun_urls.split(",") if u.strip()]}]
        if self.turn_url:
            servers.append({"urls": [self.turn_url], "username": self.turn_username,
                            "credential": self.turn_credential})
        return servers


@lru_cache
def get_settings() -> Settings:
    return Settings()
