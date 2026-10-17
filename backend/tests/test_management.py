"""Transcript corrections, demo replace, consultation management, accounts, staff admin, robustness."""
from app.db import dialect, next_mrn, schema_version, tx, MIGRATIONS


def _h(r):
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_demo_load_requires_replace(client, doctor):
    dh, _ = doctor
    c = client.post("/api/consultations", headers=dh, json={"patient_id": "pat_lakshmi"}).json()
    assert client.post(f"/api/consultations/{c['id']}/transcript/demo", headers=dh,
                       json={"scenario": "diabetes"}).status_code == 201
    r = client.post(f"/api/consultations/{c['id']}/transcript/demo", headers=dh, json={"scenario": "cardiology"})
    assert r.status_code == 409
    r = client.post(f"/api/consultations/{c['id']}/transcript/demo", headers=dh,
                    json={"scenario": "cardiology", "replace": True})
    assert r.status_code == 201
    segs = client.get(f"/api/consultations/{c['id']}/transcript", headers=dh).json()
    assert segs and not any("Lakshmi" in s["speaker_name"] for s in segs)


def test_segment_edit_delete_export_and_lock(client, doctor, student, patient):
    dh, _ = doctor
    sh, _ = student
    ph, pdata = patient
    c = client.post("/api/consultations", headers=dh, json={"patient_id": pdata["user"]["patient_id"],
                                                             "student_id": "usr_student"}).json()
    cid = c["id"]
    a = client.post(f"/api/consultations/{cid}/transcript", headers=ph,
                    json={"text": "I have chest pane for 2 days.", "client_id": "x1"}).json()
    b = client.post(f"/api/consultations/{cid}/transcript", headers=dh,
                    json={"text": "background noise", "client_id": "x2"}).json()
    # patients cannot edit
    assert client.patch(f"/api/consultations/{cid}/transcript/{a['id']}", headers=ph,
                        json={"text": "x"}).status_code == 403
    e = client.patch(f"/api/consultations/{cid}/transcript/{a['id']}", headers=sh,
                     json={"text": "I have chest pain for 2 days."})
    assert e.status_code == 200 and e.json()["edited"] and e.json()["original_text"] == "I have chest pane for 2 days."
    e2 = client.patch(f"/api/consultations/{cid}/transcript/{a['id']}", headers=sh, json={"text": "I have chest pain."})
    assert e2.json()["original_text"] == "I have chest pane for 2 days."  # first original preserved
    assert client.delete(f"/api/consultations/{cid}/transcript/{b['id']}", headers=dh).status_code == 204
    assert client.delete(f"/api/consultations/{cid}/transcript/{b['id']}", headers=dh).status_code == 404
    txt = client.get(f"/api/consultations/{cid}/transcript.txt", headers=ph)
    assert txt.status_code == 200 and "I have chest pain." in txt.text and "background noise" not in txt.text
    assert "attachment" in txt.headers["content-disposition"]
    # approve -> transcript locked
    cs = client.post(f"/api/consultations/{cid}/case-sheet", headers=dh).json()
    client.post(f"/api/case-sheets/{cs['id']}/approve", headers=dh, json={"version": cs["version"], "confirm_reviewed": True})
    assert client.patch(f"/api/consultations/{cid}/transcript/{a['id']}", headers=dh,
                        json={"text": "y"}).status_code == 409


def test_reschedule_assign_cancel(client, doctor, student, patient):
    dh, _ = doctor
    sh, _ = student
    ph, pdata = patient
    c = client.post("/api/consultations", headers=dh, json={"patient_id": pdata["user"]["patient_id"],
                                                             "student_id": "usr_student"}).json()
    r = client.patch(f"/api/consultations/{c['id']}", headers=sh,
                     json={"scheduled_at": "2030-01-02T10:30:00+05:30", "student_id": "usr_student"})
    assert r.status_code == 200 and r.json()["student_name"] == "Sneha Patel"
    assert r.json()["scheduled_at"].startswith("2030-01-02T10:30")
    assert client.patch(f"/api/consultations/{c['id']}", headers=dh, json={"scheduled_at": "soon"}).status_code == 422
    assert client.patch(f"/api/consultations/{c['id']}", headers=dh, json={"student_id": "usr_doctor"}).status_code == 422
    assert client.patch(f"/api/consultations/{c['id']}", headers=sh, json={"doctor_id": "usr_doctor2"}).status_code == 403
    assert client.patch(f"/api/consultations/{c['id']}", headers=ph, json={"status": "cancelled"}).status_code == 403
    x = client.patch(f"/api/consultations/{c['id']}", headers=dh,
                     json={"status": "cancelled", "cancel_reason": "Patient requested"})
    assert x.json()["status"] == "cancelled" and x.json()["cancel_reason"] == "Patient requested"
    assert client.patch(f"/api/consultations/{c['id']}", headers=dh, json={"reason": "x"}).status_code == 409
    past = client.get("/api/dashboard", headers=ph).json()["past"]
    assert any(p["id"] == c["id"] and p["status"] == "cancelled" for p in past)


def test_profile_and_password_change(client):
    r = client.post("/api/auth/register", json={"email": "pw.user@example.com", "password": "firstpass1",
                                                  "name": "Pw User", "phone": "+919000000009"})
    h = _h(r)
    p = client.patch("/api/auth/me", headers=h, json={"name": "Pw User Updated", "phone": "+919111111111",
                                                       "designation": "ignored for patients"})
    assert p.status_code == 200 and p.json()["name"] == "Pw User Updated" and p.json()["designation"] is None
    assert client.patch("/api/auth/me", headers=h, json={"phone": "12"}).status_code == 422
    assert client.post("/api/auth/password", headers=h,
                       json={"current_password": "wrong", "new_password": "secondpass2"}).status_code == 400
    n = client.post("/api/auth/password", headers=h, json={"current_password": "firstpass1", "new_password": "secondpass2"})
    assert n.status_code == 200
    assert client.get("/api/auth/me", headers=h).status_code == 401  # old token revoked
    assert client.get("/api/auth/me", headers=_h(n)).status_code == 200
    assert client.post("/api/auth/login", json={"email": "pw.user@example.com", "password": "secondpass2"}).status_code == 200


def test_login_rate_limit(client):
    for _ in range(5):
        assert client.post("/api/auth/login", json={"email": "meera@medtrust.demo", "password": "bad"}).status_code == 401
    r = client.post("/api/auth/login", json={"email": "meera@medtrust.demo", "password": "MedTrust@123"})
    assert r.status_code == 429 and "Retry-After" in r.headers


def test_staff_management(client, doctor, student):
    dh, _ = doctor
    sh, _ = student
    body = {"email": "new.student@medtrust.demo", "name": "Arjun Rao", "role": "student", "password": "studentpw1"}
    assert client.post("/api/users", headers=sh, json=body).status_code == 403
    assert client.post("/api/users", headers=dh, json={**body, "role": "doctor"}).status_code == 422
    u = client.post("/api/users", headers=dh, json=body)
    assert u.status_code == 201 and u.json()["role"] == "student"
    assert client.post("/api/users", headers=dh, json=body).status_code == 409
    uid = u.json()["id"]
    lr = client.post("/api/auth/login", json={"email": body["email"], "password": "studentpw1"})
    tok = _h(lr)
    assert client.patch("/api/users/usr_doctor", headers=dh, json={"disabled": True}).status_code == 422
    assert client.patch(f"/api/users/{uid}", headers=dh, json={"disabled": True}).json()["disabled"] is True
    assert client.get("/api/auth/me", headers=tok).status_code == 401
    assert client.post("/api/auth/login", json={"email": body["email"], "password": "studentpw1"}).status_code == 403
    assert uid not in [x["id"] for x in client.get("/api/users", headers=dh).json()]
    assert uid in [x["id"] for x in client.get("/api/users?include_disabled=true", headers=dh).json()]


def test_mrn_monotonic_and_migrations(client):
    with tx() as c:
        assert schema_version(c) == len(MIGRATIONS)
        mrn = next_mrn(c)
        assert mrn not in {r["mrn"] for r in c.execute("SELECT mrn FROM patients").fetchall()}
        row = c.execute("SELECT original_text, edited_at FROM transcript_segments LIMIT 1").fetchall()
        assert isinstance(row, list)
        assert c.execute("SELECT is_admin FROM users WHERE id='usr_doctor'").fetchone()["is_admin"] == 1
    assert dialect() in ("sqlite", "postgres")
