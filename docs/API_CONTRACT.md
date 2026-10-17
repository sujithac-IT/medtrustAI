# MedTrust AI - API Contract (v3)

Base URL: same origin, prefix `/api`. JSON everywhere. Interactive OpenAPI: `/docs`.
Auth: `Authorization: Bearer <jwt>`. WebSockets take a one-minute ticket from `POST /auth/ws-ticket` as `?ticket=` (session tokens never go in URLs).
Access: patients see only their own records; doctors and students see consultations they are assigned to (attending doctor / student); administrators (`is_admin`) see all. Pagination: list endpoints take `limit` (default 100, max 500) and `offset`. Errors: `{"detail": string | ValidationError[]}`.
Roles: `doctor`, `student` (together "staff"), `patient`.

## 1. Auth
| Method | Path | Who | Body | Response |
|---|---|---|---|---|
| GET | /auth/config | public | - | `{demo_mode, firebase_enabled, doctor_signup_requires_invite, demo_accounts}` |
| POST | /auth/login | public | `{email, password}` | `{token, user}`; 401 bad credentials; 403 account disabled; 429 + `Retry-After` after 5 failures/email or 50/IP within 300 s |
| POST | /auth/demo | public (DEMO_MODE) | `{role}` | `{token, user}`; 403 if disabled |
| POST | /auth/register | public | `{email, password>=8, name, role, invite_code?, registration_number?, date_of_birth?, gender?, phone?}` | 201 `{token, user}`; 403 bad invite, 409 email exists, 422 |
| POST | /auth/firebase | public | `{id_token, role}` | `{token, user}`; 401 invalid token; 403 account disabled |
| POST | /auth/ws-ticket | any | `{consultation_id?}` | `{ticket, expires_in: 60}`; scoped to that consultation, or to staff notifications when omitted; 403 if not a participant |
| GET | /auth/me | any | - | `User` |
| PATCH | /auth/me | any | `{name?, phone?, specialization?, designation?}` | `User` |
| POST | /auth/password | any | `{current_password, new_password}` (8+ chars, letters and a digit, not common, not your email) | `{token, user}`; 400 wrong current password; 422 if unchanged. All previously issued tokens become invalid (JWT carries a password fingerprint `pwv`). |

Tokens of disabled users are rejected with 401.

`User = {id, email, name, role, registration_number?, specialization?, designation?, patient_id?, phone?, disabled}`

## 2. Patients
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | /patients?q= | staff | search name / MRN / phone |
| POST | /patients | staff | `PatientIn` -> 201 `Patient` |
| GET | /patients/{id} | staff, own patient | |
| PATCH | /patients/{id} | staff | phone, email, address, blood_group, emergency contact, allergies[], conditions[] |
| GET | /patients/{id}/history | staff, own patient | `{patient, consultations: Consultation[]}` |

`PatientIn = {first_name, last_name, date_of_birth (YYYY-MM-DD, not future), gender: Male|Female|Other, phone, email?, blood_group?, address?, emergency_contact_name?, emergency_contact_phone?, allergies[], conditions[]}`
`Patient = PatientIn + {id, mrn, full_name, age, created_at, updated_at}`

## 3. Consultations & transcript
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | /consultations?status=&patient_id= | any (patients: own) | includes live `presence {admitted, waiting}` |
| POST | /consultations | staff | `{patient_id, doctor_id?, student_id?, reason?, scheduled_at?, create_google_meet}` -> 201 |
| GET | /consultations/{id or room_code} | participant | adds `ice_servers` |
| PATCH | /consultations/{id} | staff | `{scheduled_at?, reason?, student_id?, doctor_id? (doctor only), status?: cancelled, cancel_reason?}`; reschedule only while `scheduled`; 409 cancelling a live/completed consultation; cancel is audited and broadcast as `status` |
| POST | /consultations/{id}/start | staff | status -> live, sets started_at, broadcasts `status` |
| POST | /consultations/{id}/end | doctor | status -> completed, closes room |
| GET | /consultations/{id}/transcript | participant | `Segment[]` ordered |
| POST | /consultations/{id}/transcript | participant | `{text, client_id?, language?, speaker_role? (staff only), offset_ms?}` -> 201; idempotent by client_id; 409 if ended |
| GET | /consultations/demo/scenarios | staff | `Scenario[]` |
| POST | /consultations/{id}/transcript/demo | staff | `{scenario, replace?: bool}` -> `{added}`; 409 if a transcript already exists and `replace` is not true |
| PATCH | /consultations/{id}/transcript/{seg_id} | staff | `{text?, speaker_role?}` -> `Segment`; first original text preserved; audited; 409 if case sheet approved or consultation cancelled |
| DELETE | /consultations/{id}/transcript/{seg_id} | staff | 204; audited; same 409 rules |
| GET | /consultations/{id}/transcript.txt | participant | plain-text attachment |
| POST | /consultations/{id}/transcript/import-google | staff | `{imported, total_entries}`; 400 not configured; 502 Google error |
| GET | /consultations/{id}/turns | staff | normalised turns used for AI |

`Consultation = {id, cancel_reason?, room_code, join_path, patient_id, patient_name, patient_mrn, doctor_id, doctor_name, doctor_specialization, student_id?, student_name?, reason?, scheduled_at, status: scheduled|live|completed|cancelled, started_at?, ended_at?, duration_seconds?, case_sheet_id?, case_sheet_status?: draft|approved, segment_count, meet: {provider: in_app|google_meet, meeting_uri?, meeting_code?, space_name?, calendar_html_link?, google_error?}}`
`Segment = {id, client_id, speaker_role, speaker_user_id?, speaker_name, text, language, offset_ms, source: live|manual|demo|google_meet, created_at, edited, original_text?, edited_at?}`

## 4. Realtime: `WS /api/consultations/{id}/ws?ticket=`
Close codes: 4401 bad/expired ticket or account disabled, 4403 not a participant, 4404 not found, 4409 consultation closed (also sent to everyone when the doctor ends or cancels), 1009 message > 64 KB.
Assigned staff are admitted directly; patients and observing administrators wait in the lobby. A patient admitted once is re-admitted automatically after a reconnect. Inbound messages are rate limited per socket (`{type:"error", code:"rate_limited"}`). `transcript.final` is refused with `{type:"error", code:"transcript_locked"}` once the case sheet is signed or the consultation has ended; a duplicate `client_id` is answered with `{type:"transcript.ack", client_id}` so clients can safely resend after a reconnect.
Staff are admitted immediately; patients enter the waiting lobby.

Server -> client
| type | payload |
|---|---|
| welcome | `{peer_id, admitted, ice_servers, peers: Peer[], consultation: {status, started_at}, doctor_present}` |
| admitted | `{peers: Peer[]}` - you were let in |
| denied | - |
| roster | `{peers: Peer[]}` (includes waiting peers, `admitted:false`) |
| waiting.joined | `{peer}` |
| peer.joined / peer.left | `{peer}` / `{peer_id}` |
| signal | `{from, data: {description?} | {candidate?}}` |
| media | `{peer_id, media: {audio, video, screen}}` |
| transcript.interim | `{peer_id, name, role, text}` |
| transcript.final | `{segment: Segment}` (sent to everyone, including the author) |
| transcript.reload | - (bulk import happened; refetch) |
| status | `{status}` |
| chat | `{from, role, text, at}` (not persisted) |
| pong | - |

Client -> server: `ping`, `admit {peer_id}` (staff), `deny {peer_id}` (staff), `signal {to, data}`, `media {media}`, `transcript.interim {text}`, `transcript.final {text, client_id, language}`, `chat {text}`. Waiting peers may only `ping`.

WebRTC: full mesh, "perfect negotiation". The newcomer creates the connections to existing peers; the polite side is the lexicographically larger `peer_id`.

`Peer = {peer_id, user_id, name, role, admitted, media}`

Staff notifications: `WS /api/ws/staff?ticket=` -> `{type: "waiting", consultation_id, name}`, delivered only to that consultation's doctor/student and administrators.

## 5. Case sheets
| Method | Path | Who | Notes |
|---|---|---|---|
| POST | /consultations/{id}/case-sheet?overwrite= | assigned staff | generate; 201 `CaseSheet`; 422 empty transcript; 409 approved, or a draft exists and `overwrite=true` was not sent; 429 after 20 AI calls / 10 min per user |
| GET | /case-sheets?status=&patient_id= | any (patients: own approved) | `CaseSheetListItem[]` |
| GET | /case-sheets/{id} | staff, own patient if approved | `CaseSheet + section_titles + section_order` |
| PATCH | /case-sheets/{id} | staff | `{version, sections: Partial<Sections>}`; 409 version mismatch or approved |
| POST | /case-sheets/{id}/summaries | staff | regenerate multilingual summaries |
| POST | /case-sheets/{id}/approve | attending doctor only | `{version, confirm_reviewed: true}`; rebuilds the patient summary from the signed sections; the hash covers sections + summary; 409 if stale/approved or the consultation is still live; marks a scheduled consultation completed |
| GET | /case-sheets/{id}/audit | staff | `[{at, action, detail, user_name, user_role}]` |

`CaseSheet = {id, consultation_id, patient_id, status: draft|approved, version, source: gemini|local, sections: Sections, summaries: {machine_translated, source, texts: {en,ta,hi,te,ml,kn}}, approval?: {approved_by: User, approved_at, content_hash: "sha256:...", version, statement}, content_hash?, guardrails: {removed[], flagged[], grounding_checked, transcript_truncated}, integrity_ok?: boolean (signed sheets: stored content re-hashed and compared), attending_doctor_id, created_at, updated_at}`

`Sections` (17 keys, fixed order):
`patient_info{}`, `chief_complaint`, `history_of_present_illness`, `symptoms[{name, severity, duration, notes}]`, `duration`, `past_medical_history[]`, `medications[{name, dose, frequency, route, duration, instructions}]`, `allergies[]`, `family_history`, `social_history`, `doctor_observations{summary, vitals{blood_pressure, pulse, temperature, spo2, respiratory_rate, weight}}`, `investigations[]`, `assessment`, `treatment_plan`, `follow_up`, `missing_information[]`, `uncertain_information[]`.

## 6. Meta
| GET /health | public | `{status, gemini, google_meet, firebase, demo_mode, turn}` |
|---|---|---|
| GET /config | public | hospital name, languages, features |
| GET /users?role=&include_disabled= | staff | staff directory (`include_disabled` honoured for administrators only) |
| POST /users | administrator | create doctor/student `{email, password>=8, name, role, registration_number? (required for doctors), specialization?, designation?}` -> 201; 409 email exists; 422 |
| PATCH /users/{id} | administrator | `{disabled?, is_admin?, specialization?, designation?}`; disabling closes the user's open sockets; 404 unknown; 422 when disabling yourself, removing your own admin role, or making a student an admin |
| GET /dashboard | any | staff: `{stats, live, upcoming, awaiting_approval, recent_approved}`; patient: `{upcoming, past}` |
