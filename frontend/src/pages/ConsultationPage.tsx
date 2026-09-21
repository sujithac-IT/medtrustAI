import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import MeetRoom from '../components/MeetRoom'
import LiveTranscript from '../components/LiveTranscript'
import CaseSheetForm from '../components/CaseSheetForm'
import { generateCaseSheet, DEMO_TRANSCRIPT } from '../services/gemini'
import type { TranscriptEntry, CaseSheet, Patient } from '../types'

const DEMO_PATIENTS: Patient[] = [
  { id: 'p1', name: 'Arjun Krishnamurthy', dob: '1985-06-15', age: 39, gender: 'male', phone: '+91 98765 43210', bloodGroup: 'B+', allergies: ['Penicillin'], conditions: ['Hypertension'], createdAt: '2024-01-10', updatedAt: '2024-09-20' },
  { id: 'p2', name: 'Priya Sundaram', dob: '1992-03-22', age: 32, gender: 'female', phone: '+91 87654 32109', bloodGroup: 'O+', allergies: [], conditions: ['Type 2 Diabetes'], createdAt: '2024-02-15', updatedAt: '2024-09-18' },
]

type Stage = 'setup' | 'active' | 'review'

export default function ConsultationPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()

  const [stage, setStage] = useState<Stage>('setup')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [interimText, setInterimText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [caseSheet, setCaseSheet] = useState<CaseSheet | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [consultationId] = useState(`c_${Date.now()}`)
  const [reason, setReason] = useState('')
  const [demoMode, setDemoMode] = useState(false)
  const [activeTab, setActiveTab] = useState<'transcript' | 'casesheet'>('transcript')

  const recognitionRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const demoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const demoIndexRef = useRef(0)

  // Timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isRecording])

  const startSpeechRecognition = useCallback(() => {
    const SpeechRec = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    if (!SpeechRec) return

    const rec = new SpeechRec()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-IN'
    rec.maxAlternatives = 1

    let speakerToggle = user?.role === 'doctor' // doctor speaks first
    let wordCount = 0

    rec.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        if (result.isFinal) {
          const text = result[0].transcript.trim()
          if (text) {
            wordCount += text.split(' ').length
            // Toggle speaker every ~20 words or detect speaker cue words
            if (wordCount > 20 || /^(doctor|patient|i am|my name)/i.test(text)) {
              speakerToggle = !speakerToggle
              wordCount = 0
            }
            const entry: TranscriptEntry = {
              id: `t_${Date.now()}_${Math.random()}`,
              speaker: speakerToggle ? 'doctor' : 'patient',
              text,
              timestamp: elapsedSeconds * 1000,
            }
            setTranscript(prev => [...prev, entry])
            setInterimText('')
          }
        } else {
          interim += result[0].transcript
        }
      }
      setInterimText(interim)
    }

    rec.onerror = () => {}
    rec.onend = () => { if (isRecording) rec.start() }

    recognitionRef.current = rec
    rec.start()
  }, [user?.role, isRecording, elapsedSeconds])

  const stopSpeechRecognition = () => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setInterimText('')
  }

  // Demo mode: replay sample transcript
  const runDemoTranscript = useCallback(() => {
    if (demoIndexRef.current >= DEMO_TRANSCRIPT.length) return

    const entry = DEMO_TRANSCRIPT[demoIndexRef.current]
    setTranscript(prev => [...prev, { ...entry, timestamp: elapsedSeconds * 1000 }])
    demoIndexRef.current++

    const nextDelay = demoIndexRef.current < DEMO_TRANSCRIPT.length
      ? Math.max(2000, (DEMO_TRANSCRIPT[demoIndexRef.current]?.timestamp || 0) - entry.timestamp)
      : 99999

    demoTimeoutRef.current = setTimeout(runDemoTranscript, Math.min(nextDelay, 4000))
  }, [elapsedSeconds])

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false)
      if (demoMode) {
        if (demoTimeoutRef.current) clearTimeout(demoTimeoutRef.current)
      } else {
        stopSpeechRecognition()
      }
    } else {
      setIsRecording(true)
      if (demoMode) {
        demoIndexRef.current = 0
        runDemoTranscript()
      } else {
        startSpeechRecognition()
      }
    }
  }

  const handleGenerateCaseSheet = async () => {
    if (!selectedPatient) return
    setIsGenerating(true)
    setActiveTab('casesheet')
    try {
      const useTranscript = transcript.length > 0 ? transcript : DEMO_TRANSCRIPT
      const sheet = await generateCaseSheet(
        useTranscript,
        selectedPatient.name,
        user?.displayName || 'Dr. Unknown',
        consultationId,
        selectedPatient.id,
        user?.uid || 'doc-001',
      )
      sheet.patientInfo = {
        name: selectedPatient.name,
        age: selectedPatient.age.toString(),
        gender: selectedPatient.gender,
        bloodGroup: selectedPatient.bloodGroup || '',
        phone: selectedPatient.phone,
        address: '',
      }
      sheet.allergies = selectedPatient.allergies.length > 0 ? selectedPatient.allergies : sheet.allergies
      setCaseSheet(sheet)

      // Save to localStorage for demo
      const saved = JSON.parse(localStorage.getItem('medtrust_case_sheets') || '[]')
      saved.push(sheet)
      localStorage.setItem('medtrust_case_sheets', JSON.stringify(saved))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApprove = () => {
    if (!caseSheet) return
    const approved = {
      ...caseSheet,
      isApproved: true,
      isReadOnly: true,
      approvedAt: new Date().toISOString(),
      approvedBy: user?.displayName || 'Doctor',
    }
    setCaseSheet(approved)

    const saved = JSON.parse(localStorage.getItem('medtrust_case_sheets') || '[]')
    const idx = saved.findIndex((s: CaseSheet) => s.id === caseSheet.id)
    if (idx >= 0) saved[idx] = approved
    localStorage.setItem('medtrust_case_sheets', JSON.stringify(saved))
  }

  // ─── Stage: Setup ──────────────────────────────────────────────────────────
  if (stage === 'setup') {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div className="section-header">
          <div>
            <h1 className="section-title">New Consultation</h1>
            <p className="section-subtitle">Set up a video consultation session</p>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>
            <span>👥</span> Select Patient
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DEMO_PATIENTS.map(p => (
              <div
                key={p.id}
                onClick={() => setSelectedPatient(p)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  border: `2px solid ${selectedPatient?.id === p.id ? 'var(--color-teal)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-md)',
                  background: selectedPatient?.id === p.id ? 'var(--color-teal-dim)' : 'var(--color-bg-glass)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div className="avatar avatar-teal">
                  {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {p.age}y · {p.gender} · {p.bloodGroup} · {p.conditions.join(', ') || 'No conditions'}
                  </div>
                </div>
                {p.allergies.length > 0 && <span className="badge badge-warning">⚠ {p.allergies[0]}</span>}
                {selectedPatient?.id === p.id && <span style={{ color: 'var(--color-teal)', fontSize: 20 }}>✓</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 12 }}><span>📝</span> Consultation Details</div>
          <div className="form-group">
            <label className="form-label">Reason for Consultation</label>
            <input
              className="form-input"
              placeholder="e.g., Chest pain evaluation, Diabetes follow-up"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title" style={{ marginBottom: 12 }}><span>🎙️</span> Transcription Mode</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              onClick={() => setDemoMode(false)}
              style={{
                padding: 16, borderRadius: 'var(--radius-md)',
                border: `2px solid ${!demoMode ? 'var(--color-teal)' : 'var(--color-border)'}`,
                background: !demoMode ? 'var(--color-teal-dim)' : 'var(--color-bg-glass)',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start',
                color: !demoMode ? 'var(--color-teal)' : 'var(--color-text-secondary)',
              }}
            >
              <span style={{ fontSize: 22 }}>🎙️</span>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Live Microphone</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Real speech-to-text via browser</div>
            </button>
            <button
              onClick={() => setDemoMode(true)}
              style={{
                padding: 16, borderRadius: 'var(--radius-md)',
                border: `2px solid ${demoMode ? 'var(--color-teal)' : 'var(--color-border)'}`,
                background: demoMode ? 'var(--color-teal-dim)' : 'var(--color-bg-glass)',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start',
                color: demoMode ? 'var(--color-teal)' : 'var(--color-text-secondary)',
              }}
            >
              <span style={{ fontSize: 22 }}>🤖</span>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Demo Mode</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Clinical sample transcript replay</div>
            </button>
          </div>
        </div>

        <button
          id="begin-consultation-btn"
          className="btn btn-primary"
          style={{ width: '100%', padding: 16, fontSize: 16 }}
          disabled={!selectedPatient}
          onClick={() => setStage('active')}
        >
          📹 Begin Consultation {selectedPatient ? `with ${selectedPatient.name.split(' ')[0]}` : ''}
        </button>
      </div>
    )
  }

  // ─── Stage: Active + Review ────────────────────────────────────────────────
  return (
    <div style={{ height: 'calc(100vh - 130px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top bar */}
      <div className="flex-between" style={{ flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text-primary)' }}>
            {selectedPatient?.name}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            {reason || 'General consultation'} · {selectedPatient?.age}y {selectedPatient?.gender}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {transcript.length > 0 && !caseSheet && (
            <button
              id="generate-case-sheet-btn"
              className="btn btn-primary"
              onClick={handleGenerateCaseSheet}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <><span className="animate-spin" style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(10,22,40,0.3)', borderTop: '2px solid rgba(10,22,40,0.8)', borderRadius: '50%' }} /> Generating AI Case Sheet...</>
              ) : (
                <><span>🤖</span> Generate Case Sheet</>
              )}
            </button>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => {
              setIsRecording(false)
              stopSpeechRecognition()
              if (demoTimeoutRef.current) clearTimeout(demoTimeoutRef.current)
              navigate('/dashboard')
            }}
          >
            End Session
          </button>
        </div>
      </div>

      {/* Main 3-column layout */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 16, minHeight: 0 }}>
        {/* Col 1: Video */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
          <MeetRoom
            onTranscriptUpdate={setTranscript}
            isRecording={isRecording}
            onToggleRecording={toggleRecording}
            elapsedSeconds={elapsedSeconds}
          />
        </div>

        {/* Col 2: Transcript */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 16 }}>
          <LiveTranscript
            entries={transcript}
            isActive={isRecording}
            interimText={interimText}
          />
        </div>

        {/* Col 3: Case Sheet */}
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          {!caseSheet ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center' }}>
              <span style={{ fontSize: 48 }}>🤖</span>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)' }}>AI Case Sheet</h3>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', maxWidth: 240 }}>
                {transcript.length === 0
                  ? 'Start recording the consultation, then click "Generate Case Sheet" to extract clinical data with Gemini AI'
                  : `${transcript.length} transcript entries ready. Click "Generate Case Sheet" to create the 17-section clinical document.`}
              </p>
              {transcript.length > 0 && !isGenerating && (
                <button
                  className="btn btn-primary"
                  onClick={handleGenerateCaseSheet}
                  style={{ marginTop: 8 }}
                >
                  🤖 Generate with AI
                </button>
              )}
              {isGenerating && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, border: '3px solid rgba(0,212,170,0.2)', borderTop: '3px solid var(--color-teal)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <p style={{ fontSize: 12, color: 'var(--color-teal)' }}>Processing transcript with Gemini AI...</p>
                </div>
              )}
            </div>
          ) : (
            <CaseSheetForm
              caseSheet={caseSheet}
              onUpdate={setCaseSheet}
              onApprove={handleApprove}
              isDoctor={user?.role === 'doctor'}
            />
          )}
        </div>
      </div>
    </div>
  )
}
