# MedTrust AI

Teleconsultation platform for teaching hospitals. Doctors, students and patients meet over live video. Each speaker is transcribed in real time, Gemini drafts a 17-section clinical case sheet from the conversation, and the attending doctor reviews, edits and electronically signs it. After signing, the record is locked.

```
Browser (React 18 + Vite)                       API (FastAPI; 1 process, or N behind a load balancer)
 ├ WebRTC mesh video  <── peer-to-peer ──>       ├ REST  /api/*      (JWT auth, assignment-based access)
 ├ Web Speech captions ── WS (ticket) ─────>     ├ WS    /api/consultations/{id}/ws  (signalling, lobby, captions)
 └ Case sheet editor  ── REST ─────────────>     ├ Security layer: CSP + headers, body/WS size limits, rate limits
                                                 ├ DB: SQLite (default)  |  PostgreSQL (DATABASE_URL)
                                                 ├ Realtime hub: in-process (default)  |  Redis pub/sub (REDIS_URL)
                                                 ├ Gemini extraction + AI guardrails / grounded local fallback
                                                 └ Google Meet REST + Calendar (optional)
```

## Quick start
Requirements: Python 3.10+, Node 18+.

**Linux / macOS:**
```bash
cp .env.example .env      # optional - everything works in demo mode without keys
./run_app.sh              # installs deps, builds the UI, serves http://localhost:8000
```

**Windows:**
```powershell
Copy-Item .env.example .env   # optional
.\run_app.ps1                 # or run run_app.bat
```
Development with hot reload:
```bash
cd backend && ../.venv/bin/uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev          # http://localhost:5173 (proxies /api + websockets)
```
Tests: `cd backend && ../.venv/bin/pip install -r requirements-dev.txt && ../.venv/bin/python -m pytest -q`
(the same suite runs on PostgreSQL + Redis with `TEST_DATABASE_URL=postgresql://... TEST_REDIS_URL=redis://...`, which also enables the two-instance scaling test).

Docker: `docker compose up --build`. The UI is served on http://localhost:3000, and nginx proxies the REST API and WebSockets to the backend.

## Deploy to Vercel (Frontend)
The frontend can be deployed directly to Vercel with automatic continuous integration:
1. Import this repository into [Vercel](https://vercel.com/new).
2. The included `vercel.json` automatically configures the build command (`cd frontend && npm install && npm run build`) and SPA client-side routing.
3. Set `VITE_API_BASE_URL` and `VITE_WS_BASE_URL` in the Vercel Environment Variables to point to your backend API server or public tunnel URL.

## Small machines
The default install needs no database server or cache: one uvicorn worker, SQLite and in-process rooms use about 90 MB of RAM (measured), so it runs on a 1 GB VPS or a Raspberry Pi 4. The browser side adapts too: on devices with 4 GB RAM or less, 4 or fewer cores, or a slow/data-saver connection, the camera is captured at 640x360 / 15 fps; audio meters draw at 15 fps and pause in background tabs; pages load as separate chunks (first load about 65 KB of gzipped JS). `AI_CONCURRENCY` (default 2) caps simultaneous Gemini calls.

## Scaling out
Set three variables and run as many API processes as you like behind any load balancer (no sticky sessions needed):
```bash
DATABASE_URL=postgresql://user:pass@db/medtrust   # shared records (pooled; DB_POOL_SIZE per process)
REDIS_URL=redis://cache:6379/0                    # shared rooms, lobby, presence and rate limits
JWT_SECRET=$(openssl rand -base64 48)             # the same on every instance
WORKERS=4 ./run_app.sh                            # or: docker compose -f docker-compose.yml -f docker-compose.scale.yml up --scale backend=3
```
WebRTC media stays peer-to-peer; only signalling passes through the API, so each instance handles thousands of sockets. For calls with more than about 5 participants, add an SFU (see PRD M5).

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

## Security model
- Access: patients see only their own records; doctors and students see consultations they are assigned to; administrators (`is_admin`, set on the Clinical staff page) see everything and manage accounts. Only the attending doctor can sign or end a consultation.
- Signed records are locked: the transcript is frozen, the patient summary is rebuilt from the signed sections, and a SHA-256 fingerprint of both is re-verified each time the sheet is opened.
- Sessions: HS256 JWTs with required issuer/type/password-fingerprint claims; WebSockets use one-minute scoped tickets; changing a password or disabling an account closes live sockets.
- Abuse limits: 1 MB request bodies, 64 KB WebSocket messages with per-socket rate limiting, login (5 per account / 50 per IP per 5 min), registration and AI-generation throttles; nginx adds per-IP rate zones.
- Headers: CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS over HTTPS, `no-store` on all API responses. API docs are hidden when `DEMO_MODE=false`.
- AI guardrails: the transcript is treated as untrusted input; every fact the model returns must be traceable to the transcript or the patient record, otherwise it is removed and flagged for the doctor (see docs/AUDIT.md).

Operational notes: the schema migrates automatically on startup; `GET /api/health` returns 503 when the database or Redis is unreachable (used by the Docker healthcheck).

## Configuration (`.env`)
| Feature | Variables | Without it |
|---|---|---|
| AI extraction and translations | `GEMINI_API_KEY`, `GEMINI_MODEL` | A grounded local extractor; summaries use templates |
| Google Meet link, Calendar event, transcript import | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | The in-app WebRTC room only |
| Firebase Google sign-in | `FIREBASE_PROJECT_ID` plus `VITE_FIREBASE_*` at build time | Email/password only |
| TURN relay | `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` | STUN only; strict NATs may block video |
| Production hardening | `DEMO_MODE=false`, a strong `JWT_SECRET` (required, 32+ chars), `DOCTOR_INVITE_CODE` | Demo logins are enabled; a random signing key is generated in the data directory |
| Scale-out | `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `WORKERS` | SQLite + in-process rooms (single node) |

Camera and microphone access requires **HTTPS** on any host other than `localhost`. Live captions use the browser Web Speech API, which needs Chrome or Edge with internet access.

## Docs
[Audit](docs/AUDIT.md) · [PRD](docs/PRD.md) · [API contract](docs/API_CONTRACT.md)

## Layout
```
backend/app   config, db, security, schemas, serializers, realtime, routers/, services/ (casesheet, transcript, google_meet, samples)
backend/app   + ratelimit.py, services/guardrails.py (AI input/output checks)
backend/tests API, management, security regressions, extractor, realtime (real socket) and two-instance scale tests
frontend/src  api/, auth/, rtc/ (useRoom WebRTC + signalling, useSpeech, useMedia), components/, pages/
```
