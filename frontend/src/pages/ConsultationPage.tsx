import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import MeetRoom from '../components/MeetRoom'
import LiveTranscript from '../components/LiveTranscript'
import { generateCaseSheet, DEMO_TRANSCRIPT } from '../services/gemini'
import type { TranscriptEntry, CaseSheet, Patient } from '../types'
import {
  StethoscopeIcon,
  HospitalCrossIcon,
  PulseIcon,
  PillIcon,
  ClipboardMedicalIcon,
  VideoMeetIcon,
  WaitingRoomIcon,
  DoctorHostIcon,
  PatientIcon,
  GlobeLanguageIcon,
  SparklesIcon,
  ShieldCheckIcon,
} from '../components/MedicalIcons'
import {
  getWaitingPatients,
  admitPatientToSession,
  subscribeToConsultationSync,
  type WaitingPatient,
} from '../services/consultationSync'

function useLatestRef<T>(value: T) {
  const ref = useRef(value)
  ref.current = value
  return ref
}

const CURRENT_PATIENT: Patient = {
  id: 'p_sundaram',
  name: 'K. Sundaram',
  mrn: 'MT-2026-0841',
  dob: '1968-05-14',
  age: 58,
  gender: 'male',
  phone: '+91 98401 23456',
  bloodGroup: 'B+',
  allergies: ['Penicillin (urticaria)', 'Enalapril (dry cough)'],
  conditions: ['Essential Hypertension', 'Mild Dyslipidemia'],
  createdAt: '2024-01-10',
  updatedAt: '2026-09-22',
  lastVisit: '15 Sep 2026',
}

const MULTILINGUAL_LANGUAGES = [
  { code: 'en-IN', name: 'English (India)' },
  { code: 'hi-IN', name: 'हिन्दी (Hindi)' },
  { code: 'ta-IN', name: 'தமிழ் (Tamil)' },
  { code: 'te-IN', name: 'తెలుగు (Telugu)' },
  { code: 'kn-IN', name: 'ಕನ್ನಡ (Kannada)' },
  { code: 'bn-IN', name: 'বাংলা (Bengali)' },
  { code: 'mr-IN', name: 'मराठी (Marathi)' },
  { code: 'es-ES', name: 'Español (Spanish)' },
  { code: 'zh-CN', name: '中文 (Mandarin)' },
  { code: 'ar-SA', name: 'العربية (Arabic)' },
  { code: 'fr-FR', name: 'Français (French)' },
]

export default function ConsultationPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const meetingCode = searchParams.get('room') || 'abc-defg-hij'

  // Consultation states
  const [elapsedSeconds, setElapsedSeconds] = useState(785) // In progress: 13m 05s
  const [isRecording, setIsRecording] = useState(true)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(DEMO_TRANSCRIPT)
  const [interimText, setInterimText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('en-IN')
  const [selectedSample, setSelectedSample] = useState('Cardiology - Chest Pain')
  const [copySuccess, setCopySuccess] = useState(false)

  // Waiting Room Management
  const [waitingPatients, setWaitingPatients] = useState<WaitingPatient[]>([])
  const [admitSuccessToast, setAdmitSuccessToast] = useState<string | null>(null)

  const recognitionRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = useLatestRef(elapsedSeconds)
  const isRecordingRef = useLatestRef(isRecording)
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync waiting patients queue
  useEffect(() => {
    setWaitingPatients(getWaitingPatients(meetingCode))
    const unsubscribe = subscribeToConsultationSync((event) => {
      if (event.type === 'PATIENT_JOINED_WAITING_ROOM') {
        setWaitingPatients(getWaitingPatients(meetingCode))
      }
    })
    return () => unsubscribe()
  }, [meetingCode])

  // Live timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1)
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Multilingual Speech Recognition
  const startSpeechRecognition = useCallback(() => {
    const SpeechRec = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    if (!SpeechRec) return

    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }

    try {
      const rec = new SpeechRec()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = selectedLanguage

      let speakerToggle = user?.role === 'doctor'

      rec.onresult = (e: any) => {
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i]
          if (result.isFinal) {
            const text = result[0].transcript.trim()
            if (text) {
              speakerToggle = !speakerToggle
              const entry: TranscriptEntry = {
                id: `t_${Date.now()}_${Math.random()}`,
                speaker: speakerToggle ? 'doctor' : 'patient',
                text,
                timestamp: elapsedRef.current * 1000,
              }
              setTranscript((prev) => [...prev, entry])
              setInterimText('')
            }
          } else {
            interim += result[0].transcript
          }
        }
        setInterimText(interim)
      }

      rec.onerror = (e: any) => {
        if (e.error === 'no-speech') return
        console.warn('SpeechRecognition error:', e.error)
      }

      rec.onend = () => {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
        restartTimerRef.current = setTimeout(() => {
          if (isRecordingRef.current && recognitionRef.current === rec) {
            try { rec.start() } catch {}
          }
        }, 300)
      }

      recognitionRef.current = rec
      rec.start()
    } catch (err) {
      console.warn('SpeechRecognition start failed:', err)
    }
  }, [user?.role, selectedLanguage])

  const stopSpeechRecognition = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    setInterimText('')
  }, [])

  useEffect(() => {
    return () => {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch {}
        recognitionRef.current = null
      }
    }
  }, [])

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false)
      stopSpeechRecognition()
    } else {
      setIsRecording(true)
      startSpeechRecognition()
    }
  }

  const handleCopyMeetLink = () => {
    const fullUrl = `https://meet.google.com/${meetingCode}`
    navigator.clipboard?.writeText(fullUrl)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  // Doctor Host Action: Admit patient into session
  const handleAdmitPatient = (patient: WaitingPatient) => {
    admitPatientToSession(meetingCode, patient.id)
    setWaitingPatients((prev) => prev.filter((p) => p.id !== patient.id))
    setAdmitSuccessToast(`${patient.name} has been admitted to the live session.`)
    setTimeout(() => setAdmitSuccessToast(null), 3500)
  }

  const handleGenerateCaseSheet = async () => {
    setIsGenerating(true)
    try {
      const sheet = await generateCaseSheet(
        transcript,
        CURRENT_PATIENT.name,
        user?.displayName || 'Dr. Rajesh Sharma, MD',
        'c_102345',
        CURRENT_PATIENT.id,
        user?.uid || 'doc-001',
      )
      sheet.id = 'cs-sundaram'
      sheet.patientInfo = {
        name: CURRENT_PATIENT.name,
        age: '58',
        gender: 'Male',
        mrn: 'MT-2026-0841',
        dob: '1968-05-14',
        bloodGroup: 'B+',
        phone: '+91 98401 23456',
        address: '42 Temple View Road, Mylapore, Chennai',
      }
      sheet.chiefComplaint = 'Retrosternal chest tightness on stair climbing for 4 days; dry cough x 1 week'
      sheet.hpi = 'A 58-year-old male with essential hypertension presents with 4 days of dull retrosternal heaviness radiating to left shoulder on climbing stairs (NYHA II), relieved within 5 minutes of rest. Intractable dry cough developed after starting Enalapril 10mg.'
      sheet.medications = [
        { name: 'Telmisartan', dosage: '40mg', frequency: 'OD (Morning)', route: 'Oral', duration: '30 days' },
        { name: 'Aspirin (Ecosprin)', dosage: '75mg', frequency: 'OD (After lunch)', route: 'Oral', duration: '30 days' },
        { name: 'Atorvastatin', dosage: '20mg', frequency: 'OD (Bedtime)', route: 'Oral', duration: '30 days' },
        { name: 'Sorbitrate', dosage: '5mg', frequency: 'SOS (Sublingual)', route: 'Sublingual', duration: '10 tabs' },
      ]
      sheet.allergies = ['Penicillin', 'Enalapril (ACE inhibitor cough)']
      sheet.pastMedicalHistory = 'Essential Hypertension, Mild Dyslipidemia'
      sheet.familyHistory = 'Father - Myocardial Infarction at 62'

      const saved = JSON.parse(localStorage.getItem('medtrust_case_sheets') || '[]')
      const existingIdx = saved.findIndex((s: CaseSheet) => s.id === 'cs-sundaram')
      if (existingIdx >= 0) {
        saved[existingIdx] = sheet
      } else {
        saved.push(sheet)
      }
      localStorage.setItem('medtrust_case_sheets', JSON.stringify(saved))

      navigate('/case-sheet/cs-sundaram')
    } finally {
      setIsGenerating(false)
    }
  }

  const formatTimer = (s: number) => {
    const hours = Math.floor(s / 3600).toString().padStart(2, '0')
    const mins = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
    const secs = (s % 60).toString().padStart(2, '0')
    return `${hours}:${mins}:${secs}`
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      height: 'calc(100vh - 110px)',
      fontFamily: "'Inter', 'Roboto', system-ui, sans-serif",
    }}>
      {/* ─── WAITING ROOM ADMISSION ALERT (DOCTOR AS HOST) ─── */}
      {waitingPatients.length > 0 && (
        <div style={{
          backgroundColor: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: 12,
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 6px rgba(37, 99, 235, 0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: '#0B57D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
            }}>
              <WaitingRoomIcon size={18} color="#FFFFFF" />
            </div>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1E3A8A' }}>
                Waiting Room ({waitingPatients.length}):
              </span>
              <span style={{ fontSize: 13, color: '#1E40AF', marginLeft: 6 }}>
                {waitingPatients[0].name} ({waitingPatients[0].gender}, {waitingPatients[0].age}y) is ready for consultation
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => handleAdmitPatient(waitingPatients[0])}
              style={{
                backgroundColor: '#0B57D0',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 6,
                padding: '6px 16px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <StethoscopeIcon size={14} color="#FFFFFF" />
              Admit Patient to Session
            </button>
          </div>
        </div>
      )}

      {/* Toast notification on admission */}
      {admitSuccessToast && (
        <div style={{
          backgroundColor: '#ECFDF5',
          border: '1px solid #A7F3D0',
          color: '#065F46',
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 12,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span>✓</span>
          <span>{admitSuccessToast}</span>
        </div>
      )}

      {/* ─── TOP STATUS BANNER (GOOGLE MATERIAL MEDICAL THEME) ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        flexShrink: 0,
      }}>
        {/* Left: Title + Host Status + Timer + Google Meet Link */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 }}>
              Live Clinical Consultation
            </h1>
            <span style={{
              fontSize: 11,
              backgroundColor: '#EFF6FF',
              color: '#1D4ED8',
              padding: '2px 8px',
              borderRadius: 4,
              fontWeight: 700,
              border: '1px solid #DBEAFE',
            }}>
              HOST MODE
            </span>
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            backgroundColor: '#ECFDF5',
            borderRadius: 20,
            border: '1px solid #A7F3D0',
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#10B981',
              display: 'inline-block',
            }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#047857' }}>In Progress</span>
          </div>

          <span style={{
            fontSize: 15,
            fontWeight: 800,
            color: '#0F172A',
            fontFamily: 'monospace',
          }}>
            {formatTimer(elapsedSeconds)}
          </span>

          {/* Google Meet Share Link Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 12px',
            backgroundColor: '#F8FAFD',
            borderRadius: 8,
            border: '1px solid #E2E8F0',
          }}>
            <VideoMeetIcon size={16} color="#0B57D0" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#0B57D0' }}>Google Meet:</span>
            <span style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>
              meet.google.com/{meetingCode}
            </span>
            <button
              onClick={handleCopyMeetLink}
              style={{
                backgroundColor: copySuccess ? '#ECFDF5' : '#FFFFFF',
                color: copySuccess ? '#059669' : '#0F172A',
                border: '1px solid #CBD5E1',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {copySuccess ? '✓ Copied!' : 'Copy Link'}
            </button>
            <button
              onClick={() => window.open(`/waiting-room/${meetingCode}`, '_blank')}
              style={{
                backgroundColor: '#F1F5F9',
                color: '#475569',
                border: 'none',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: 500,
              }}
              title="Test patient entry into waiting room in new tab"
            >
              Patient View ↗
            </button>
          </div>
        </div>

        {/* Right: Host Profile Card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: '#0B57D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: 13,
            }}>
              RS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                Dr. Rajesh Sharma, MD
              </span>
              <span style={{ fontSize: 11, color: '#0B57D0', fontWeight: 600 }}>
                Permanent Session Host
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MAIN 2-COLUMN LAYOUT ─── */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: 14,
        minHeight: 0,
      }}>
        {/* Left Column: Doctor + Patient Feeds with Doctor Host Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <MeetRoom
            isRecording={isRecording}
            onToggleRecording={toggleRecording}
            elapsedSeconds={elapsedSeconds}
            meetLink={`meet.google.com/${meetingCode}`}
            doctorName="Dr. Rajesh Sharma, MD (Host)"
            patientName="K. Sundaram (Patient)"
            onEndCall={() => navigate('/history')}
            onAdmitPatient={() => waitingPatients[0] && handleAdmitPatient(waitingPatients[0])}
            waitingPatientCount={waitingPatients.length}
          />
        </div>

        {/* Right Column: Live Transcription + Multilingual STT + Case Sheet Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
          {/* Live Transcript Card */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: 14,
            minHeight: 240,
            overflow: 'hidden',
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            {/* Header with Multilingual Speech-to-Text Selector */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 10,
              borderBottom: '1px solid #F1F5F9',
              marginBottom: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <SparklesIcon size={16} color="#0B57D0" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                  AI Clinical Scribe
                </span>
              </div>

              {/* Language Selector for STT */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <GlobeLanguageIcon size={14} color="#64748B" />
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  style={{
                    fontSize: 11,
                    padding: '3px 6px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#F8FAFD',
                    color: '#0F172A',
                    fontWeight: 600,
                  }}
                >
                  {MULTILINGUAL_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <LiveTranscript
              entries={transcript}
              isActive={isRecording}
              interimText={interimText}
            />
          </div>

          {/* Quick Actions Card */}
          <div style={{
            padding: 14,
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#64748B',
              marginBottom: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Post-Consultation Workflow
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Primary Action: Generate Structured Case Sheet */}
              <button
                id="generate-case-sheet-btn"
                onClick={handleGenerateCaseSheet}
                disabled={isGenerating}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: '#0B57D0',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(11, 87, 208, 0.25)',
                  transition: 'all 0.2s',
                }}
              >
                <ClipboardMedicalIcon size={18} color="#FFFFFF" />
                <span>{isGenerating ? 'Compiling Medical Case Sheet...' : 'Generate AI Case Sheet'}</span>
              </button>

              {/* View Patient Longitudinal Records */}
              <button
                onClick={() => navigate('/history')}
                style={{
                  width: '100%',
                  padding: '9px 14px',
                  backgroundColor: '#F8FAFD',
                  color: '#1E293B',
                  border: '1px solid #E2E8F0',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <PulseIcon size={16} color="#007A64" />
                <span>View Patient Clinical History</span>
              </button>
            </div>
          </div>

          {/* NVIDIA & DeepStream Telehealth Infrastructure Card */}
          <div style={{
            padding: 12,
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                Video Infrastructure
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block' }} />
                <span style={{ fontSize: 10, color: '#047857', fontWeight: 600 }}>NVIDIA DeepStream Pipeline</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
              <div style={{
                padding: '6px 10px',
                backgroundColor: '#F8FAFD',
                borderRadius: 6,
                border: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
              }}>
                <span style={{ color: '#64748B' }}>Audio/Video Demuxer:</span>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>GPU Accelerated RTP</span>
              </div>
              <div style={{
                padding: '6px 10px',
                backgroundColor: '#F8FAFD',
                borderRadius: 6,
                border: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
              }}>
                <span style={{ color: '#64748B' }}>Recording:</span>
                <span style={{ fontWeight: 600, color: '#DC2626' }}>● Active (1080p WebM/PCM)</span>
              </div>
              <div style={{
                padding: '6px 10px',
                backgroundColor: '#F8FAFD',
                borderRadius: 6,
                border: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
              }}>
                <span style={{ color: '#64748B' }}>Multilingual Scribe:</span>
                <span style={{ fontWeight: 600, color: '#0B57D0' }}>11 Global & Indian Dialects</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
