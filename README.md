# ⚕️ MedTrust AI — Hospital Teleconsultation & Clinical Case Sheet Platform

[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF.svg)](https://vitejs.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](https://fastapi.tiangolo.com/)
[![Gemini AI](https://img.shields.io/badge/Google_Gemini-1.5_Pro-4285F4.svg)](https://ai.google.dev/)
[![Google Cloud Run](https://img.shields.io/badge/Deploy-Cloud_Run-4285F4.svg)](https://cloud.google.com/run)

**MedTrust AI** is a state-of-the-art telemedicine platform designed for teaching hospitals and clinical teams. During live doctor-student-patient teleconsultations, the platform streams real-time bidirectional speech-to-text transcription and automatically generates an audit-ready, 17-section structured clinical case sheet powered by **Google Gemini AI** (with an offline rule-based clinical NLP fallback).

---

## 🌟 Key Features

### 1. 📹 Interactive Video Consultation Suite
- **WebRTC Camera & Audio Preview**: Real-time webcam feed with live canvas-rendered audio frequency waveforms.
- **Google Meet Embedded Integration**: Instant virtual meeting room embed with dynamic meeting URL generation.
- **Clinical Call Controls**: Camera flip/toggle, microphone mute/unmute, screen sharing, and live consultation duration timer.

### 2. 🎙️ Real-Time Clinical Speech-to-Text
- **Speech Recognition**: Powered by the browser Web Speech API (`webkitSpeechRecognition`) with continuous interim results.
- **Smart Turn Separation**: Heuristically detects clinical dialogue cues between attending physician and patient/student.
- **Interactive Clinical Demo Replay**: Built-in Cardiology case simulation with audio transcript simulation for instant evaluation.

### 3. 🤖 AI-Generated 17-Section Clinical Case Sheet
Powered by **Google Gemini 1.5 Pro / Flash** (with instant local regex/NLP fallback if no API key is set):
1. **Patient Information & Demographics**: Name, age, gender, blood group, contact, address.
2. **Chief Complaint**: Standardized primary symptom summary.
3. **History of Present Illness (HPI)**: Chronological narrative of onset, duration, severity, aggravating factors.
4. **Symptoms**: Categorized clinical symptom tags.
5. **Duration**: Timeline of symptomatic progression.
6. **Past Medical History**: Chronic conditions, past surgical history.
7. **Current Medications**: Structured dosage table with drug name, dosage, frequency, and duration.
8. **Allergies**: High-visibility drug & food allergy alerts (e.g., Penicillin, Sulfa).
9. **Family History**: Hereditary risks (cardiovascular, diabetes, oncological).
10. **Social History**: Lifestyle, occupational exposure, smoking/alcohol habits.
11. **Doctor Observations & Examination**: Vital signs (BP, Pulse, SpO2), physical exam findings.
12. **Investigations Ordered**: 12-lead ECG, Echo, cardiac enzymes, blood panels.
13. **Assessment / Clinical Impression**: Primary differential diagnosis.
14. **Treatment Plan**: Prescribed regimens, pharmacotherapy, monitoring protocol.
15. **Follow-Up Instructions**: Timeline and red flag warning signs.
16. **Missing Information**: Clinically relevant omissions flagged by AI.
17. **Uncertain Information**: Ambiguous statements flagged for physician clarification.

### 4. ✍️ Electronic Physician Sign-off & Audit Trail
- Multi-point clinical checklist validation before locking.
- Attending physician digital signature timestamp and license metadata.
- Immutability protection: Approved case sheets are locked to preserve clinical audit compliance.

### 5. 🌐 Multilingual Accessibility & Text-to-Speech (TTS)
- Native support for **6 Indian Languages**: English, தமிழ் (Tamil), हिन्दी (Hindi), తెలుగు (Telugu), മലയാളം (Malayalam), and ಕನ್ನಡ (Kannada).
- Built-in speech synthesis playback for patient comprehension and accessibility.

### 6. 🖨️ Hospital-Branded Print & PDF Export
- Dedicated print stylesheet formatting the 17 clinical sections into an official hospital case file.

---

## 🏗️ Architecture

```
medtrustAI/
├── frontend/                     # Vite + React 19 + TypeScript + CSS Design System
│   ├── src/
│   │   ├── components/           # MeetRoom, AudioWaveform, LiveTranscript, CaseSheetForm, Layout
│   │   ├── pages/                # LoginPage, DashboardPage, ConsultationPage, PatientsPage, HistoryPage, CaseSheetPage
│   │   ├── services/             # firebase.ts, gemini.ts (Gemini + Local NLP fallback)
│   │   ├── i18n/                 # Multilingual localization config
│   │   ├── types/                # Strict TypeScript clinical data types
│   │   └── index.css             # Glassmorphism dark/teal design system
│   ├── Dockerfile                # Nginx SPA production container
│   └── nginx.conf
│
├── backend/                      # Python FastAPI Clinical Intelligence API
│   ├── app/
│   │   ├── models/schemas.py     # Pydantic models for case sheets, vitals, patients
│   │   ├── routers/              # patients, consultations, casesheet
│   │   ├── services/             # gemini_service.py (Gemini 1.5 + local NLP)
│   │   └── main.py               # FastAPI entrypoint with CORS & Cloud Run config
│   ├── Dockerfile                # Google Cloud Run optimized container
│   └── requirements.txt
│
├── docker-compose.yml            # Local multi-container orchestration
└── .env.example                  # Environment configuration template
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** >= 18 (Node 22+ recommended)
- **Python** >= 3.10 (optional for backend API)

---

### Option 1: Frontend (Instant Demo Mode — Zero Keys Required)

The frontend includes a self-contained clinical demo mode that persists to browser storage without requiring external API keys.

```powershell
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

Visit **`http://localhost:3000`** in your browser:
- Click **"Doctor Demo Sign In"** to access the clinician workspace.
- Click **"📹 Start Consultation"**, select patient **Arjun Krishnamurthy**, select **"Demo Mode"**, and begin the consultation!
- Watch the live speech transcript stream, then click **"🤖 Generate Case Sheet"** to extract the complete 17 sections.

---

### Option 2: Full-Stack with Python FastAPI Backend

```powershell
# 1. Setup Backend
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 2. Setup Frontend (in separate terminal)
cd frontend
npm run dev
```

The FastAPI OpenAPI documentation is available at **`http://localhost:8000/docs`**.

---

### Option 3: Docker Compose

```bash
docker-compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`

---

## ☁️ Deployment to Google Cloud Run

The backend is pre-configured for Google Cloud Run:

```bash
# Build and submit container image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/medtrust-api backend/

# Deploy to Cloud Run
gcloud run deploy medtrust-api \
  --image gcr.io/YOUR_PROJECT_ID/medtrust-api \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY="your-gemini-key"
```

---

## 🔒 Security & Medical Compliance
- **Local Fallback**: Works completely offline without patient health data leaving the browser when running in demo/fallback mode.
- **Audit Locking**: Case sheets are sealed with cryptographic timestamps upon attending physician sign-off.
- **Safety Flags**: Explicit sections dedicated to uncertain findings and missing diagnostic metrics.

---

## 📄 License
MIT License. Developed for clinical teaching institutions and hospital teleconsultation programs.
