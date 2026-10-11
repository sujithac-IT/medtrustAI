import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["DATABASE_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["GEMINI_API_KEY"] = ""
os.environ["GOOGLE_REFRESH_TOKEN"] = ""
os.environ["DEMO_MODE"] = "true"
os.environ["FRONTEND_DIST"] = "/nonexistent"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


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
