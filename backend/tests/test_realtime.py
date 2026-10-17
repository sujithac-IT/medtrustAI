"""Realtime hub against a real uvicorn process (TestClient isolates sockets per event loop)."""
import asyncio
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import httpx
import pytest

websockets = pytest.importorskip("websockets")
ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def server():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    env = {**os.environ, "DATABASE_PATH": os.path.join(tempfile.mkdtemp(), "rt.db"), "FRONTEND_DIST": "/none"}
    proc = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(port)], cwd=ROOT,
                            env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f"http://127.0.0.1:{port}"
    for _ in range(50):
        try:
            httpx.get(base + "/api/health", timeout=0.5)
            break
        except httpx.HTTPError:
            time.sleep(0.1)
    yield base
    proc.terminate()
    proc.wait(5)


async def _until(ws, kind):
    while True:
        m = json.loads(await asyncio.wait_for(ws.recv(), 5))
        if m["type"] == kind:
            return m


def test_waiting_room_signalling_and_transcript(server):
    async def run():
        d = httpx.post(server + "/api/auth/demo", json={"role": "doctor"}).json()["token"]
        p = httpx.post(server + "/api/auth/demo", json={"role": "patient"}).json()
        c = httpx.post(server + "/api/consultations", headers={"Authorization": f"Bearer {d}"},
                       json={"patient_id": p["user"]["patient_id"]}).json()
        url = server.replace("http", "ws") + f"/api/consultations/{c['id']}/ws?ticket="

        def ticket(tok):
            return httpx.post(server + "/api/auth/ws-ticket", headers={"Authorization": f"Bearer {tok}"},
                              json={"consultation_id": c["id"]}).json()["ticket"]
        async with websockets.connect(url + ticket(d)) as dws:
            dw = await _until(dws, "welcome")
            async with websockets.connect(url + ticket(p["token"])) as pws:
                pw = await _until(pws, "welcome")
                assert pw["admitted"] is False
                # waiting peer cannot signal
                await pws.send(json.dumps({"type": "signal", "to": dw["peer_id"], "data": {}}))
                await _until(dws, "waiting.joined")
                await dws.send(json.dumps({"type": "admit", "peer_id": pw["peer_id"]}))
                adm = await _until(pws, "admitted")
                assert adm["peers"][0]["peer_id"] == dw["peer_id"]
                await pws.send(json.dumps({"type": "signal", "to": dw["peer_id"], "data": {"sdp": "offer"}}))
                sig = await _until(dws, "signal")
                assert sig["from"] == pw["peer_id"] and sig["data"] == {"sdp": "offer"}
                await pws.send(json.dumps({"type": "transcript.interim", "text": "I have"}))
                assert (await _until(dws, "transcript.interim"))["role"] == "patient"
                await pws.send(json.dumps({"type": "transcript.final", "client_id": "x1", "text": "I have fever"}))
                seg = (await _until(dws, "transcript.final"))["segment"]
                assert seg["speaker_role"] == "patient" and seg["text"] == "I have fever"
                left = await asyncio.wait_for(asyncio.shield(asyncio.sleep(0)), 1)
                assert left is None
            assert (await _until(dws, "peer.left"))["peer_id"] == pw["peer_id"]
    asyncio.run(run())
