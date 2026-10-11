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
