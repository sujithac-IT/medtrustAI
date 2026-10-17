"""Runtime configuration loaded from environment variables."""
import logging
import os
import secrets
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "backend" / ".env")
log = logging.getLogger("medtrust.config")

_INSECURE_SECRETS = {"", "change-me", "change-me-to-a-long-random-string", "secret", "dev"}


def _bool(name: str, default: bool) -> bool:
    v = os.getenv(name)
    return default if v is None else v.strip().lower() in {"1", "true", "yes", "on"}


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


class ConfigError(RuntimeError):
    pass


class Settings:
    def __init__(self) -> None:
        self.app_name = "MedTrust AI"
        self.hospital_name = os.getenv("HOSPITAL_NAME", "MedTrust University Teaching Hospital")
        db = Path(os.getenv("DATABASE_PATH", "backend/data/medtrust.db"))
        self.db_path = str(db if db.is_absolute() else ROOT / db)
        self.database_url = os.getenv("DATABASE_URL", "").strip()
        self.db_pool_size = _int("DB_POOL_SIZE", 10)
        self.redis_url = os.getenv("REDIS_URL", "").strip()
        self.data_dir = Path(os.getenv("DATA_DIR", str(Path(self.db_path).parent)))
        self.demo_mode = _bool("DEMO_MODE", True)
        self.jwt_ttl_hours = _int("JWT_TTL_HOURS", 12)
        self.jwt_secret = self._jwt_secret()
        self.doctor_invite_code = os.getenv("DOCTOR_INVITE_CODE", "")
        self.cors_origins = [o.strip() for o in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://localhost:8000,http://127.0.0.1:5173").split(",") if o.strip()]
        self.frontend_dist = Path(os.getenv("FRONTEND_DIST", str(ROOT / "frontend" / "dist")))
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        self.ai_concurrency = max(1, _int("AI_CONCURRENCY", 2))
        self.firebase_project_id = os.getenv("FIREBASE_PROJECT_ID", "").strip()
        self.google_client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
        self.google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
        self.google_refresh_token = os.getenv("GOOGLE_REFRESH_TOKEN", "").strip()
        self.google_calendar_id = os.getenv("GOOGLE_CALENDAR_ID", "primary")
        self.stun_urls = os.getenv("STUN_URLS", "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302")
        self.turn_url = os.getenv("TURN_URL", "")
        self.turn_username = os.getenv("TURN_USERNAME", "")
        self.turn_credential = os.getenv("TURN_CREDENTIAL", "")
        self.max_body_bytes = _int("MAX_BODY_BYTES", 1_000_000)
        self.ws_max_message_bytes = _int("WS_MAX_MESSAGE_BYTES", 64_000)
        self.expose_docs = _bool("EXPOSE_API_DOCS", self.demo_mode)

    def _jwt_secret(self) -> str:
        """Never fall back to a value that is published in source code.

        - JWT_SECRET set: must be >= 32 chars outside demo mode.
        - unset, single-node demo: a random secret is generated once and kept in DATA_DIR (0600).
        - unset, production or a shared database: refuse to start (instances must agree on one secret)."""
        env = os.getenv("JWT_SECRET", "").strip()
        if env and env not in _INSECURE_SECRETS:
            if len(env) < 32 and not self.demo_mode:
                raise ConfigError("JWT_SECRET must be at least 32 characters when DEMO_MODE=false")
            return env
        if not self.demo_mode or self.database_url:
            raise ConfigError("JWT_SECRET is required (DEMO_MODE=false or DATABASE_URL set). "
                              "Generate one with: python -c 'import secrets; print(secrets.token_urlsafe(48))'")
        path = self.data_dir / ".jwt_secret"
        try:
            if path.exists():
                value = path.read_text().strip()
                if len(value) >= 32:
                    return value
            self.data_dir.mkdir(parents=True, exist_ok=True)
            value = secrets.token_urlsafe(48)
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, "w") as f:
                f.write(value)
            log.warning("JWT_SECRET not set: generated a random signing key in %s (demo mode only)", path)
            return value
        except OSError:
            log.warning("JWT_SECRET not set and %s is not writable: using an ephemeral key", path)
            return secrets.token_urlsafe(48)

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
