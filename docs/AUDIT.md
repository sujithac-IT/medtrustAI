# MedTrust AI - Audit of the previous codebase (v2)

Audit date: 2026-10-11. Scope: everything on `main` before the v3 rebuild.

| # | Area | Finding | Severity | Resolution in v3 |
|---|------|---------|----------|------------------|
| 1 | Build | Frontend depended on Vite 8 / TypeScript 6 which do not run on Node 18; `npm run build` failed, so nothing could be deployed. | Blocker | Vite 5 + React 18 + TS 5.6, `engines.node >= 18`; build verified. |
| 2 | Data | Patients, consultations and case sheets lived in browser `localStorage`. Data was per-device, lost on cache clear, and visible to anyone using the browser. | Critical | SQLite (WAL) on the server, single source of truth, audit log table. |
| 3 | Realtime | "Realtime" used `BroadcastChannel`, which only works between tabs of the same browser. Doctor and patient on different devices never saw each other. | Critical | Server WebSocket hub per consultation (signalling, roster, transcript fan-out). |
| 4 | Video | No WebRTC. A Google Meet iframe was embedded (Meet forbids framing) and meeting codes were randomly generated strings that did not exist. | Critical | Native WebRTC mesh (perfect negotiation, ICE restart, TURN support) + optional real Meet space via Meet REST / Calendar API. |
| 5 | Backend | Imports mixed `app.*` and `backend.app.*`; the server only started from one specific working directory. Two parallel router trees (`api/` and `routers/`). | High | One package `app`, run from `backend/`. Legacy trees removed. |
| 6 | Auth | Global "current user" variable on the server; login needed no password; Firebase ID tokens were never verified. Any caller could act as any doctor. | Critical | PBKDF2 passwords, signed JWT (HS256) per request, RS256 Firebase token verification against Google certs, role guards on every route and socket. |
| 7 | AI | Gemini path called an undefined `urllib_request`, so it always threw and silently fell back. | High | `httpx` client with JSON response schema, timeout and error handling. |
| 8 | Patient safety | "Local NLP" fallback returned hard-coded clinical content (diagnoses, drugs) regardless of the transcript. | Critical | Grounded extractor: every field is quoted or derived from the transcript; gaps go to *Missing Information*. Nothing is invented. |
| 9 | Tests | Tests imported modules that no longer existed; suite could not run. | High | 27 API, management, extractor and real-socket realtime tests (`pytest`). |
| 10 | Approval | "Approved" was a UI flag; the API still accepted edits. No record of who approved or what. | Critical | Server-enforced lock (409 on edit), optimistic versioning, approver snapshot, SHA-256 content hash, audit trail. |
| 11 | Privacy | Patients could open any consultation id; drafts were visible to patients. | High | Per-record access checks; patients see only their own approved sheets. |
| 12 | Ops | Dockerfiles pointed at wrong paths; nginx did not proxy WebSocket upgrades. | Medium | Fixed Dockerfiles, compose and nginx upgrade headers. |

## Follow-up hardening (v3.1)
| Area | Gap found after v3 | Resolution |
|---|---|---|
| Data | MRN generation could race; no schema migrations | `BEGIN IMMEDIATE` transactions, MAX-based MRN sequence, `PRAGMA user_version` migrations |
| Auth | Tokens survived a password change; no brute-force limit; no account disable | Password fingerprint in JWT, login rate limit (429), disabled accounts rejected |
| Transcript | Demo transcripts could be appended twice, mixing patients; no way to correct ASR errors | 409 unless `replace`; audited segment edit/delete preserving original text |
| AI fallback | Local extractor produced coarse medication and symptom fields | Per-drug dose/frequency/route/duration, negation-aware symptoms, doctor-endorsed assessment only |

## v4 security and stability review (2026-10-16)
Each item below was reproduced against v3.1 and has a regression test in `backend/tests/test_security.py`.

| # | Area | Finding | Severity | Resolution in v4 |
|---|------|---------|----------|------------------|
| 1 | Auth | Default `JWT_SECRET` was published in source and fixed seed user ids made tokens forgeable; tokens without `pwv` skipped the password check. | Critical | No default secret: random per-install key in demo mode, startup refusal in production or with a shared database; `typ`, `iss`, `pwv` claims required. |
| 2 | Record integrity | Transcript could change after a case sheet was signed (REST notes, live WebSocket, Google import). Ended calls kept sockets open. | Critical | Transcript frozen once signed; live speech only while open; ending/cancelling closes every socket in the room. |
| 3 | Patient safety | Patient summary was generated from the AI draft and never rebuilt, so patients saw content the doctor had corrected; the hash did not cover it. | High | Summary rebuilt at signing, hash covers sections + summary, `integrity_ok` recomputed on every read. |
| 4 | Privacy | Every doctor and student could open, join and read every consultation. | High | Assignment-based access (attending doctor, assigned student); administrators see all and wait in the lobby when observing. |
| 5 | Authority | Any doctor could sign, end or manage staff for any consultation. | High | Only the attending doctor signs and ends; staff management and cross-doctor booking need `is_admin`. |
| 6 | Secrets | Gemini key sent as a URL query parameter, which httpx logs at INFO. | High | Key sent in `x-goog-api-key`; httpx request logging silenced. |
| 7 | Data loss | Regenerating a case sheet silently replaced the doctor's edits. | Medium | `overwrite=true` required (UI asks to confirm); version-checked update. |
| 8 | Concurrency | Edit/approve races wrote audit entries and returned success when the guarded UPDATE matched no row. | Medium | Row counts checked; 409 on a lost race. |
| 9 | Transport | Session token in WebSocket URLs (access logs); spoofable `X-Forwarded-For` defeated the IP login limit. | Medium | One-minute scoped WS tickets; nginx overwrites `X-Forwarded-For`. |
| 10 | Abuse | No limits on request size, WebSocket message size/rate, registrations or AI calls. | Medium | 1 MB bodies, 64 KB WS messages + per-socket token bucket, registration and AI throttles, nginx rate zones. |
| 11 | Data quality | Google Meet speaker mapping matched substrings ("Raj" became Dr. Rajesh). | Medium | Whole-name-token matching. |
| 12 | Reliability | Live speech sent during a reconnect was dropped; a network blip sent the patient back to the lobby; speech recognition spun on network errors. | Medium | Client resend queue with server de-duplication and acks; admitted users re-admitted; exponential backoff. |

## v4 AI guardrails
- Input: transcript treated as untrusted (prompt instructs the model to ignore instructions inside it), control characters and prompt delimiters neutralised, length capped at 60k characters.
- Output: every drug, symptom, test, allergy and history item the model returns must appear in the transcript or patient record; doses and vitals must use numbers that were actually spoken. Unsupported items are removed and listed under Uncertain Information; the report is stored with the sheet and shown to staff.
- Summaries: rejected (falls back to the template) if they are too long, contain markup, or introduce numbers that are not on the case sheet.

## v4 scale and footprint
- Default single node: SQLite (WAL, per-thread connections), in-process realtime, about 90 MB RSS measured; about 420 authenticated requests/s on one worker.
- Scale-out: `DATABASE_URL` (PostgreSQL, pooled) + `REDIS_URL` (shared rooms over pub/sub, shared rate limits). `tests/test_scale.py` runs one call across two API processes.
