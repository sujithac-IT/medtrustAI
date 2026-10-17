import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["DATABASE_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")
# Run the same suite against PostgreSQL/Redis by exporting TEST_DATABASE_URL / TEST_REDIS_URL.
if os.environ.get("TEST_DATABASE_URL"):
    os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
    os.environ.setdefault("JWT_SECRET", "test-secret-" + "x" * 40)
if os.environ.get("TEST_REDIS_URL"):
    os.environ["REDIS_URL"] = os.environ["TEST_REDIS_URL"]
os.environ["GEMINI_API_KEY"] = ""
os.environ["GOOGLE_REFRESH_TOKEN"] = ""
os.environ["DEMO_MODE"] = "true"
os.environ["FRONTEND_DIST"] = "/nonexistent"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:  # runs the lifespan (migrations, realtime hub)
        yield c


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    from app.ratelimit import limiter
    yield
    try:
        limiter.clear()
    except Exception:
        pass


def _login(client, role):
    r = client.post("/api/auth/demo", json={"role": role})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()


@pytest.fixture(scope="session")
def doctor(client):
    return _login(client, "doctor")


@pytest.fixture(scope="session")
def student(client):
    return _login(client, "student")


@pytest.fixture(scope="session")
def patient(client):
    return _login(client, "patient")
