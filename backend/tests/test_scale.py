"""Horizontal scaling: two API instances share PostgreSQL + Redis; a call spans both.

Runs only when TEST_DATABASE_URL and TEST_REDIS_URL are exported (see README, "Scaling out")."""
import asyncio
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest

websockets = pytest.importorskip("websockets")
ROOT = Path(__file__).resolve().parents[1]
pytestmark = pytest.mark.skipif(not (os.environ.get("TEST_DATABASE_URL") and os.environ.get("TEST_REDIS_URL")),
                                reason="needs TEST_DATABASE_URL and TEST_REDIS_URL")


def _port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


@pytest.fixture(scope="module")
def two_instances():
    env = {**os.environ, "FRONTEND_DIST": "/none", "DATABASE_URL": os.environ["TEST_DATABASE_URL"],
           "REDIS_URL": os.environ["TEST_REDIS_URL"], "JWT_SECRET": "shared-test-secret-" + "y" * 40}
    procs, bases = [], []
    for _ in range(2):
        port = _port()
        procs.append(subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(port)], cwd=ROOT,
                                      env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        bases.append(f"http://127.0.0.1:{port}")
    for b in bases:
        for _ in range(100):
            try:
                if httpx.get(b + "/api/health", timeout=0.5).json()["realtime_backend"] == "RedisHub":
                    break
            except (httpx.HTTPError, ValueError, KeyError):
                time.sleep(0.1)
    yield bases
    for p in procs:
        p.terminate()
        p.wait(5)


async def _until(ws, kind):
    while True:
        m = json.loads(await asyncio.wait_for(ws.recv(), 5))
        if m["type"] == kind:
            return m


def test_room_spans_instances(two_instances):
    a, b = two_instances

    async def run():
        d = httpx.post(a + "/api/auth/demo", json={"role": "doctor"}).json()["token"]
        p = httpx.post(b + "/api/auth/demo", json={"role": "patient"}).json()  # session from B works on A
        c = httpx.post(a + "/api/consultations", headers={"Authorization": f"Bearer {d}"},
                       json={"patient_id": p["user"]["patient_id"]}).json()

        def ticket(base, tok):
            return httpx.post(base + "/api/auth/ws-ticket", headers={"Authorization": f"Bearer {tok}"},
                              json={"consultation_id": c["id"]}).json()["ticket"]
        path = f"/api/consultations/{c['id']}/ws?ticket="
        async with websockets.connect(a.replace("http", "ws") + path + ticket(a, d)) as dws:
            dw = await _until(dws, "welcome")
            async with websockets.connect(b.replace("http", "ws") + path + ticket(b, p["token"])) as pws:
                pw = await _until(pws, "welcome")
                assert pw["admitted"] is False
                await _until(dws, "waiting.joined")  # lobby event crossed B -> A
                summary = httpx.get(b + "/api/dashboard", headers={"Authorization": f"Bearer {d}"}).json()
                assert any(x["id"] == c["id"] and x["presence"]["waiting"] == 1 for x in summary["live"])
                await dws.send(json.dumps({"type": "admit", "peer_id": pw["peer_id"]}))
                adm = await _until(pws, "admitted")  # admit crossed A -> B
                assert adm["peers"][0]["peer_id"] == dw["peer_id"]
                await pws.send(json.dumps({"type": "signal", "to": dw["peer_id"], "data": {"sdp": "offer"}}))
                assert (await _until(dws, "signal"))["data"] == {"sdp": "offer"}
                await pws.send(json.dumps({"type": "transcript.final", "client_id": "s1", "text": "I have fever"}))
                assert (await _until(dws, "transcript.final"))["segment"]["text"] == "I have fever"
                # ending on A closes the patient's socket on B
                httpx.post(a + f"/api/consultations/{c['id']}/end", headers={"Authorization": f"Bearer {d}"})
                assert (await _until(pws, "status"))["status"] == "completed"
    asyncio.run(run())
