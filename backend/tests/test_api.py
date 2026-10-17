from datetime import date

from app.db import age_from_dob


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_password_login_and_bad_password(client):
    assert client.post("/api/auth/login", json={"email": "doctor@medtrust.demo", "password": "MedTrust@123"}).status_code == 200
    assert client.post("/api/auth/login", json={"email": "doctor@medtrust.demo", "password": "nope"}).status_code == 401


def test_requires_auth(client):
    assert client.get("/api/patients").status_code == 401


def test_patient_register_creates_record(client):
    r = client.post("/api/auth/register", json={"email": "new.pt@example.com", "password": "secret123",
                                                  "name": "Anu Raman", "role": "patient",
                                                  "date_of_birth": "1990-01-02", "gender": "Female",
                                                  "phone": "+919000000001"})
    assert r.status_code == 201, r.text
    assert r.json()["user"]["patient_id"]
    assert client.post("/api/auth/register", json={"email": "new.pt@example.com", "password": "secret123",
                                                    "name": "Anu Raman"}).status_code == 409


def test_age_calc():
    today = date.today()
    assert age_from_dob(f"{today.year - 30}-{today.month:02d}-{today.day:02d}") == 30
    assert age_from_dob("bad") is None


def test_patient_crud_and_validation(client, doctor, patient):
    h, _ = doctor
    bad = client.post("/api/patients", headers=h, json={"first_name": "A", "last_name": "B", "date_of_birth": "2999-01-01",
                                                         "gender": "Male", "phone": "123"})
    assert bad.status_code == 422
    r = client.post("/api/patients", headers=h, json={"first_name": "Ravi", "last_name": "Kumar",
                                                       "date_of_birth": "1980-03-04", "gender": "Male",
                                                       "phone": "+91 98765 43210", "allergies": ["Penicillin", "penicillin"],
                                                       "conditions": ["Asthma"]})
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["mrn"].startswith("MT-") and p["age"] >= 40 and p["allergies"] == ["Penicillin"]
    assert any(x["id"] == p["id"] for x in client.get("/api/patients?q=Ravi", headers=h).json())
    ph, _ = patient
    assert client.get("/api/patients", headers=ph).status_code == 403
    assert client.get(f"/api/patients/{p['id']}", headers=ph).status_code == 403


def test_full_consultation_flow(client, doctor, student, patient):
    dh, _ = doctor
    sh, _ = student
    ph, pdata = patient
    pid = pdata["user"]["patient_id"]
    c = client.post("/api/consultations", headers=dh, json={"patient_id": pid, "reason": "Chest pain",
                                                             "student_id": "usr_student"})
    assert c.status_code == 201, c.text
    c = c.json()
    assert c["meet"]["provider"] == "in_app" and c["join_path"].startswith("/room/")
    cid = c["id"]
    assert client.get(f"/api/consultations/{c['room_code']}", headers=ph).status_code == 200

    # Realtime: doctor joins (admitted), patient waits, doctor admits, transcript fan-out
    r = client.post(f"/api/consultations/{cid}/transcript", headers=ph, json={
        "text": "I have had chest pain for 4 days when climbing stairs. I am allergic to sulfa drugs.",
        "client_id": "p1", "speaker_role": "doctor"})
    assert r.json()["speaker_role"] == "patient"  # patients cannot impersonate other roles
    assert client.post(f"/api/consultations/{cid}/transcript", headers=ph,
                       json={"text": "dup", "client_id": "p1"}).json() == {"duplicate": True}
    client.post(f"/api/consultations/{cid}/start", headers=dh)

    client.post(f"/api/consultations/{cid}/transcript", headers=dh, json={
        "text": "Your BP is 150/90 and pulse 88. This is likely stable angina. Take Aspirin 75 mg once daily "
                "and Atorvastatin 20 mg at bedtime. Get an ECG and troponin today. Follow up after 1 week.",
        "client_id": "d1"})
    seg = client.get(f"/api/consultations/{cid}/transcript", headers=dh).json()
    assert len(seg) == 2

    # Patient cannot end call or generate
    assert client.post(f"/api/consultations/{cid}/end", headers=ph).status_code == 403
    assert client.post(f"/api/consultations/{cid}/case-sheet", headers=ph).status_code == 403
    assert client.post(f"/api/consultations/{cid}/end", headers=dh).json()["status"] == "completed"

    cs = client.post(f"/api/consultations/{cid}/case-sheet", headers=sh)
    assert cs.status_code == 201, cs.text
    cs = cs.json()
    s = cs["sections"]
    assert cs["source"] == "local" and len(cs["summaries"]["texts"]) == 6
    assert "chest pain" in s["chief_complaint"].lower()
    assert s["doctor_observations"]["vitals"]["blood_pressure"] == "150/90 mmHg"
    names = {m["name"].lower() for m in s["medications"]}
    assert {"aspirin", "atorvastatin"} <= names
    assert any("ECG" in i for i in s["investigations"])
    assert "Penicillin" in s["allergies"]
    assert "angina" in s["assessment"].lower()
    assert any("Family history" in m for m in s["missing_information"])

    # Patient cannot see draft
    assert client.get(f"/api/case-sheets/{cs['id']}", headers=ph).status_code == 403

    # Edit with optimistic concurrency
    s["family_history"] = "Father had MI at 60"
    s["medications"].append({"name": "Sorbitrate", "dose": "5 mg", "frequency": "SOS"})
    e = client.patch(f"/api/case-sheets/{cs['id']}", headers=dh, json={"version": cs["version"], "sections": s})
    assert e.status_code == 200, e.text
    assert client.patch(f"/api/case-sheets/{cs['id']}", headers=dh,
                        json={"version": cs["version"], "sections": s}).status_code == 409
    v = e.json()["version"]

    # Approval: student forbidden, checkbox required, then lock
    assert client.post(f"/api/case-sheets/{cs['id']}/approve", headers=sh,
                       json={"version": v, "confirm_reviewed": True}).status_code == 403
    assert client.post(f"/api/case-sheets/{cs['id']}/approve", headers=dh,
                       json={"version": v, "confirm_reviewed": False}).status_code == 422
    a = client.post(f"/api/case-sheets/{cs['id']}/approve", headers=dh, json={"version": v, "confirm_reviewed": True})
    assert a.status_code == 200 and a.json()["status"] == "approved"
    assert a.json()["approval"]["approved_by"]["registration_number"] == "TNMC-84920"
    assert a.json()["content_hash"].startswith("sha256:")
    assert client.patch(f"/api/case-sheets/{cs['id']}", headers=dh, json={"version": v + 1, "sections": s}).status_code == 409
    assert client.post(f"/api/consultations/{cid}/case-sheet", headers=dh).status_code == 409

    # Patient now sees it, in history too
    assert client.get(f"/api/case-sheets/{cs['id']}", headers=ph).status_code == 200
    hist = client.get(f"/api/patients/{pid}/history", headers=ph).json()
    assert any(x["case_sheet_id"] == cs["id"] for x in hist["consultations"])
    actions = [x["action"] for x in client.get(f"/api/case-sheets/{cs['id']}/audit", headers=dh).json()]
    assert actions == ["generate", "edit", "approve"]


def test_demo_transcript_and_local_extractor(client, doctor):
    dh, _ = doctor
    c = client.post("/api/consultations", headers=dh, json={"patient_id": "pat_lakshmi"}).json()
    r = client.post(f"/api/consultations/{c['id']}/transcript/demo", headers=dh, json={"scenario": "diabetes"})
    assert r.json()["added"] > 3
    cs = client.post(f"/api/consultations/{c['id']}/case-sheet", headers=dh).json()
    meds = {m["name"].lower() for m in cs["sections"]["medications"]}
    assert "metformin" in meds
    assert cs["sections"]["patient_info"]["name"] == "Lakshmi Narayanan"


def test_empty_transcript_rejected(client, doctor):
    dh, _ = doctor
    c = client.post("/api/consultations", headers=dh, json={"patient_id": "pat_vikram"}).json()
    assert client.post(f"/api/consultations/{c['id']}/case-sheet", headers=dh).status_code == 422


def test_ws_rejects_bad_token(client, doctor):
    dh, _ = doctor
    c = client.post("/api/consultations", headers=dh, json={"patient_id": "pat_vikram"}).json()
    import pytest
    from starlette.websockets import WebSocketDisconnect
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(f"/api/consultations/{c['id']}/ws?ticket=bad") as ws:
            ws.receive_json()


def test_other_patient_forbidden(client, doctor):
    dh, _ = doctor
    c = client.post("/api/consultations", headers=dh, json={"patient_id": "pat_vikram"}).json()
    r = client.post("/api/auth/login", json={"email": "lakshmi@medtrust.demo", "password": "MedTrust@123"})
    lh = {"Authorization": f"Bearer {r.json()['token']}"}
    assert client.get(f"/api/consultations/{c['id']}", headers=lh).status_code == 403
