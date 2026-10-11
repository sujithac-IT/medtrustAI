# MedTrust AI

Teleconsultation platform for teaching hospitals. Doctors, students and patients meet over live video. Each speaker is transcribed in real time, Gemini drafts a 17-section clinical case sheet from the conversation, and the attending doctor reviews, edits and electronically signs it. After signing, the record is locked.

```
Browser (React 18 + Vite)                       Server (FastAPI, single process)
 ├ WebRTC mesh video  <── peer-to-peer ──>       ├ REST  /api/*      (JWT auth, role guards)
 ├ Web Speech captions ── WS transcript ───>     ├ WS    /api/consultations/{id}/ws  (signalling, lobby, captions)
 └ Case sheet editor  ── REST ─────────────>     ├ SQLite (patients, consultations, segments, case sheets, audit)
                                                 ├ Gemini structured extraction / grounded local fallback
                                                 └ Google Meet REST + Calendar (optional)
```

## Quick start
Requirements: Python 3.10+, Node 18+.
```bash
cp .env.example .env      # optional - everything works in demo mode without keys
./run_app.sh              # installs deps, builds the UI, serves http://localhost:8000
```
Development with hot reload:
```bash
cd backend && ../.venv/bin/uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev          # http://localhost:5173 (proxies /api + websockets)
```
Tests: `cd backend && ../.venv/bin/python -m pytest -q`

Docker: `docker compose up --build`. The UI is served on http://localhost:3000, and nginx proxies the REST API and WebSockets to the backend.

## Demo accounts (password `MedTrust@123`, or one-click buttons on the login page)
| Role | Email |
|---|---|
| Doctor | doctor@medtrust.demo (Dr. Rajesh Sharma, TNMC-84920) |
| Doctor | meera@medtrust.demo |
| Student | student@medtrust.demo |
| Patient | patient@medtrust.demo (K. Sundaram) |
| Patient | lakshmi@medtrust.demo |

## Try the full flow
1. Sign in as **Doctor**. Click **New consultation**, pick a patient and a student, then **Create room**.
2. Click **Join video room**. In another browser or incognito window, sign in as **Patient** and open the same room link. The patient waits in the lobby; the doctor clicks **Admit**.
3. Talk. Each person's microphone is transcribed and attributed to them. Without a microphone, use **Load a demonstration transcript** on the consultation page.
4. Click **Generate case sheet**. Review the 17 sections in Edit mode, then click **Review & approve**. The sheet is now signed and read-only.
5. As the patient, open **My case sheets**. The signed record is there, with a summary in 6 languages and voice playback.

Also available: transcript correction (edit/delete segments before approval, originals kept), transcript export, reschedule/cancel with reason, profile and password change, and a **Clinical staff** page where doctors add or disable doctor/student accounts.

Operational notes: the SQLite schema migrates automatically on startup (`PRAGMA user_version`); logins are rate-limited (5 failures per email / 50 per IP in 5 minutes); changing a password signs out all other sessions.

## Configuration (`.env`)
| Feature | Variables | Without it |
|---|---|---|
| AI extraction and translations | `GEMINI_API_KEY`, `GEMINI_MODEL` | A grounded local extractor; summaries use templates |
| Google Meet link, Calendar event, transcript import | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | The in-app WebRTC room only |
| Firebase Google sign-in | `FIREBASE_PROJECT_ID` plus `VITE_FIREBASE_*` at build time | Email/password only |
| TURN relay | `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` | STUN only; strict NATs may block video |
| Production hardening | `DEMO_MODE=false`, a strong `JWT_SECRET`, `DOCTOR_INVITE_CODE` | Demo logins are enabled |

Camera and microphone access requires **HTTPS** on any host other than `localhost`. Live captions use the browser Web Speech API, which needs Chrome or Edge with internet access.

## Docs
[Audit](docs/AUDIT.md) · [PRD](docs/PRD.md) · [API contract](docs/API_CONTRACT.md)

## Layout
```
backend/app   config, db, security, schemas, serializers, realtime, routers/, services/ (casesheet, transcript, google_meet, samples)
backend/tests API, extractor and realtime (real socket) tests
frontend/src  api/, auth/, rtc/ (useRoom WebRTC + signalling, useSpeech, useMedia), components/, pages/
```
