# MedTrust AI - Product Requirements Document (v3)

## 1. Problem
In a teaching hospital, medical students and doctors consult patients over video. The conversation contains the clinical history, but writing the case sheet afterwards is slow, inconsistent and often incomplete. We need the conversation to be transcribed live, turned into a structured case sheet by AI, and signed off by the attending doctor as a trustworthy medical record.

## 2. Users and roles
| Role | Can |
|------|-----|
| Doctor (attending) | Everything a student can, plus end consultations and approve/sign case sheets. |
| Student | Create/run consultations, manage patients, add transcript, generate and edit draft case sheets. Cannot approve. |
| Patient | Join their own consultations (via waiting lobby), see their history and approved case sheets with multilingual summary. |

## 3. Goals / non-goals
Goals: reliable cross-device video, per-speaker live transcript, 17-section AI case sheet with no fabricated content, server-enforced approval workflow, patient record management.
Non-goals (v3): EHR/HL7/FHIR export, e-prescriptions, billing, SFU media server for >6 participants, native mobile apps.

## 4. Functional requirements
### FR1 Consultation & video
- FR1.1 Staff create a consultation (patient, attending doctor, optional student, time, reason). A unique room URL `/room/{code}` is generated.
- FR1.2 If Google OAuth is configured, a real Google Meet space and Calendar event are also created (Meet REST `spaces.create`, Calendar `conferenceData`). Failure never blocks the in-app room.
- FR1.3 Pre-join screen: live webcam preview, microphone waveform, mute/camera toggles, permission errors with retry.
- FR1.4 In-call: WebRTC video tiles, call timer, mute, camera, screen share, leave; doctor can "End for all".
- FR1.5 Waiting lobby: patients wait until a doctor/student admits or denies them; staff get a dashboard notification.
- FR1.6 Reconnect automatically on network loss (WebSocket backoff, ICE restart).
### FR2 Transcription
- FR2.1 Each participant's own microphone is transcribed in their browser (Web Speech API), giving exact speaker attribution; languages en/ta/hi/te/ml/kn (India).
- FR2.2 Interim captions broadcast to everyone; final segments are persisted (idempotent by `client_id`) and broadcast.
- FR2.3 Alternative sources: Google Meet transcript import (`conferenceRecords/*/transcripts/*/entries`), manual entry, and demonstration transcripts (5 clinical scenarios, clearly labelled `demo`).
- FR2.4 Turns are normalised (dedupe, merge consecutive same-speaker segments within 8 s) before AI processing.
### FR3 Case sheet
- FR3.1 17 sections: Patient Info, Chief Complaint, HPI, Symptoms, Duration, Past Medical History, Medications, Allergies, Family History, Social History, Doctor Observations (+ vitals), Investigations, Assessment, Treatment Plan, Follow-up, Missing Information, Uncertain Information.
- FR3.2 Gemini structured extraction with a strict JSON schema; when unavailable, a grounded local extractor. Neither may invent facts; gaps go to Missing Information, ambiguities to Uncertain Information.
- FR3.3 Edit / Preview toggle, inline editing, symptoms and medications tables with add/remove, optimistic concurrency (`version`).
- FR3.4 Print/PDF layout with hospital branding and signature block.
- FR3.5 Patient summary in 6 languages with browser voice playback; AI translations flagged for verification.
### FR4 Approval
- FR4.1 Only doctors approve, via a verification modal showing credentials and a mandatory review checkbox.
- FR4.2 Approval records approver snapshot, timestamp, statement and SHA-256 of the content; record becomes read-only server-side.
- FR4.3 All generate/edit/approve actions are written to an audit log viewable by staff.
### FR5 Patient management
- FR5.1 Search by name, MRN, phone. FR5.2 Create with validated demographics (DOB not in future, phone format, email), auto age, auto MRN `MT-YYYY-NNNNN`. FR5.3 Allergy and condition tags, editable by staff.
### FR6 History
- FR6.1 Per-patient consultation timeline with status and case sheet links; full 17-section viewer; dashboard cross-consultation views (live, upcoming, awaiting approval, recently approved).
### FR7 Authentication
- FR7.1 Email/password with JWT sessions; FR7.2 optional Firebase Google sign-in (server-verified); FR7.3 demo accounts when `DEMO_MODE=true`; FR7.4 protected routes and role guards on API and sockets; staff self-registration requires invite code.

## 5. Non-functional requirements
- Security: no PHI in localStorage except the session token; all authorisation server-side; HTTPS required for camera/mic outside localhost; TURN for restrictive networks.
- Reliability: transcript writes idempotent; case sheet edits versioned; the AI provider is optional.
- Performance: room join < 3 s on LAN; case sheet generation < 20 s with Gemini.
- Accessibility: keyboard reachable controls, labelled buttons, colour-independent status text.
- Portability: runs with Python 3.10+ / Node 18+; single process serves API + SPA.

## 6. Milestones
| M | Scope | Status |
|---|-------|--------|
| M1 | Audit, PRD, API contract | Done |
| M2 | Backend: auth, patients, consultations, transcript, case sheets, approval, realtime hub, tests | Done |
| M3 | Frontend: auth, dashboard, patients, consultations, room (WebRTC + captions), case sheet editor, approval | Done |
| M4 | Integrations: Gemini, Google Meet/Calendar, Firebase - code complete, need credentials | Needs keys |
| M5 | Production: Postgres, TURN deployment, HTTPS, SFU for larger rooms, FHIR export | Planned |
