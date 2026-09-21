import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import MeetRoom from '../components/MeetRoom'
import LiveTranscript from '../components/LiveTranscript'
import { generateCaseSheet, DEMO_TRANSCRIPT } from '../services/gemini'
import type { TranscriptEntry, CaseSheet, Patient } from '../types'

// Mirrors a value in a ref so callbacks always see the latest value without needing it in dep arrays
function useLatestRef<T>(value: T) {
  const ref = useRef(value)
  ref.current = value
  return ref
}


const CURRENT_PATIENT: Patient = {
  id: 'p_sundaram',
  name: 'K. Sundaram',
  mrn: '102345',
  dob: '1966-04-12',
  age: 58,
  gender: 'male',
  phone: '+91 98765 43210',
  bloodGroup: 'B+',
  allergies: ['Penicillin', 'Dust'],
  conditions: ['Hypertension', 'Type 2 Diabetes'],
  createdAt: '2024-01-10',
  updatedAt: '2024-09-20',
  lastVisit: '12 Apr 2025',
}

export default function ConsultationPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Consultation starts directly in progress at 00:12:34 to match reference
  const [elapsedSeconds, setElapsedSeconds] = useState(754) // 12m 34s
  const [isRecording, setIsRecording] = useState(true)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(DEMO_TRANSCRIPT)
  const [interimText, setInterimText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedSample, setSelectedSample] = useState('Cardiology - Chest Pain')
  const [copySuccess, setCopySuccess] = useState(false)

  const recognitionRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Refs that always hold the latest values so we can read them inside stable callbacks
  const elapsedRef = useLatestRef(elapsedSeconds)
  const isRecordingRef = useLatestRef(isRecording)
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)


  // Live timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds(s => s + 1)
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Real-time speech recognition.
  // CRITICAL: elapsedSeconds and isRecording are intentionally NOT in the dep array.
  // They are read from refs (elapsedRef / isRecordingRef) so this callback is stable
  // and the SpeechRecognition object is created only once — not on every timer tick.
  const startSpeechRecognition = useCallback(() => {
    const SpeechRec = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    if (!SpeechRec) return

    // Stop any existing instance before creating a new one
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }

    try {
      const rec = new SpeechRec()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-IN'

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
                // Use ref — current elapsed time without adding to callback deps
                timestamp: elapsedRef.current * 1000,
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

      rec.onerror = (e: any) => {
        // 'no-speech' fires when the mic is just quiet — not a real error
        if (e.error === 'no-speech') return
        console.warn('SpeechRecognition error:', e.error)
      }

      // Debounce restart: 300ms gap prevents InvalidStateError from calling
      // rec.start() before the browser has finished tearing down the prior session
      rec.onend = () => {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
        restartTimerRef.current = setTimeout(() => {
          if (isRecordingRef.current && recognitionRef.current === rec) {
            try { rec.start() } catch { /* browser denied restart — stop cleanly */ }
          }
        }, 300)
      }

      recognitionRef.current = rec
      rec.start()
    } catch (err) {
      console.warn('SpeechRecognition start failed:', err)
    }
  }, [user?.role]) // elapsedSeconds + isRecording read via refs — NOT listed as deps

  const stopSpeechRecognition = useCallback(() => {
    // Cancel any pending debounced restart first
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

  // Full cleanup on page unmount — prevents audio/timer leaks
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
    navigator.clipboard?.writeText('https://meet.google.com/abc-defg-hij')
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  const handleGenerateCaseSheet = async () => {
    setIsGenerating(true)
    try {
      // Simulate quick AI generation
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
        mrn: '102345',
        dob: '1966-04-12',
        bloodGroup: 'B+',
        phone: '+91 98765 43210',
        address: 'No. 12, Gandhi Nagar, Madurai',
      }
      sheet.chiefComplaint = 'Chest pain'
      sheet.hpi = 'Patient is a 56-year-old male who presents with complaints of chest pain for the past 3 weeks. The pain is exertional and relieved with rest. Associated with exertional shortness of breath and follow-up in 2 weeks.'
      sheet.medications = [
        { name: 'Aspirin', dosage: '75mg', frequency: 'OD', route: 'Oral', duration: 'Long-term' },
        { name: 'Atorvastatin', dosage: '20mg', frequency: 'OD', route: 'Oral', duration: 'Long-term' },
        { name: 'Metformin', dosage: '500mg', frequency: 'BD', route: 'Oral', duration: '3 months' },
      ]
      sheet.allergies = ['Penicillin', 'Dust']
      sheet.pastMedicalHistory = 'Hypertension, Type 2 Diabetes'
      sheet.familyHistory = 'Father - Diabetes'

      // Save to localStorage
      const saved = JSON.parse(localStorage.getItem('medtrust_case_sheets') || '[]')
      const existingIdx = saved.findIndex((s: CaseSheet) => s.id === 'cs-sundaram')
      if (existingIdx >= 0) {
        saved[existingIdx] = sheet
      } else {
        saved.push(sheet)
      }
      localStorage.setItem('medtrust_case_sheets', JSON.stringify(saved))

      // Navigate to 17-Section Case Sheet page
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: 'calc(100vh - 120px)' }}>
      {/* Top Banner Matching Screen 1 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 18px',
        background: 'var(--color-bg-glass)',
        borderRadius: 12,
        border: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        {/* Left: Title + Status + Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
            Live Consultation
          </h1>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            background: 'rgba(34, 197, 94, 0.12)',
            borderRadius: 20,
            border: '1px solid rgba(34, 197, 94, 0.3)',
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#22C55E',
              boxShadow: '0 0 8px #22C55E',
              display: 'inline-block',
            }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#22C55E' }}>In Progress</span>
          </div>

          <span style={{
            fontSize: 15,
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            fontFamily: 'monospace',
          }}>
            {formatTimer(elapsedSeconds)}
          </span>

          {/* Google Meet Pill Button */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '5px 12px',
            background: 'rgba(37, 99, 235, 0.08)',
            borderRadius: 8,
            border: '1px solid rgba(37, 99, 235, 0.25)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-teal)' }}>Google Meet</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>meet.google.com/abc-defg-hij</span>
            <button
              onClick={handleCopyMeetLink}
              style={{
                background: copySuccess ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                color: copySuccess ? '#22C55E' : 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {copySuccess ? '✓ Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>

        {/* Right: Notifications & Doctor Profile Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            fontSize: 18,
            position: 'relative',
          }}>
            🔔
            <span style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#EF4444',
            }} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #2563EB, #00D4AA)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: 13,
            }}>
              RS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Dr. Rajesh Sharma
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                Senior Doctor • MD
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Layout Matching Screen 1 */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 370px',
        gap: 14,
        minHeight: 0,
      }}>
        {/* Left Column: Video Feeds & Call Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <MeetRoom
            isRecording={isRecording}
            onToggleRecording={toggleRecording}
            elapsedSeconds={elapsedSeconds}
            meetLink="meet.google.com/abc-defg-hij"
            doctorName="Dr. Rajesh Sharma (Doctor)"
            patientName="Patient"
            onEndCall={() => navigate('/history')}
          />
        </div>

        {/* Right Column: Live Transcript + Clinical Sample + Quick Actions + Meet Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
          {/* Live Transcript Card */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 14, minHeight: 240, overflow: 'hidden' }}>
            <LiveTranscript
              entries={transcript}
              isActive={isRecording}
              interimText={interimText}
            />
          </div>

          {/* Clinical Sample Card */}
          <div className="card" style={{ padding: 12 }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Clinical Sample
            </div>
            <select
              className="form-select"
              style={{ margin: 0, fontSize: 12, padding: '7px 10px' }}
              value={selectedSample}
              onChange={e => setSelectedSample(e.target.value)}
            >
              <option>Cardiology - Chest Pain</option>
              <option>Diabetes Follow-Up</option>
              <option>COPD Management</option>
              <option>Hypertension Review</option>
              <option>General Clinical History</option>
            </select>
          </div>

          {/* Quick Actions Card */}
          <div className="card" style={{ padding: 12 }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--color-text-muted)',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Quick Actions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Blue solid button: Generate AI Case Sheet */}
              <button
                id="generate-case-sheet-btn"
                onClick={handleGenerateCaseSheet}
                disabled={isGenerating}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  background: '#2563EB',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                  transition: 'all 0.2s',
                }}
              >
                <span>🤖</span>
                {isGenerating ? 'Generating AI Case Sheet...' : 'Generate AI Case Sheet'}
              </button>

              {/* White/light outline button: View Patient History */}
              <button
                onClick={() => navigate('/history')}
                style={{
                  width: '100%',
                  padding: '9px 14px',
                  background: 'transparent',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s',
                }}
              >
                <span>📋</span>
                View Patient History
              </button>

              {/* Red outline button: End Consultation */}
              <button
                onClick={() => navigate('/history')}
                style={{
                  width: '100%',
                  padding: '9px 14px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#F87171',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s',
                }}
              >
                <span>🔴</span>
                End Consultation
              </button>
            </div>
          </div>

          {/* Google Meet Integration Card */}
          <div className="card" style={{ padding: 12 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Google Meet Integration
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
                <span style={{ fontSize: 10, color: '#22C55E', fontWeight: 600 }}>Connected</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{
                padding: '6px 10px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 6,
                border: '1px solid var(--color-border)',
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-teal)' }}>Meet Space</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                  meet.google.com/abc-defg-hij
                </div>
              </div>

              <div style={{
                padding: '6px 10px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 6,
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#38BDF8' }}>Calendar Event</div>
                  <div style={{ fontSize: 11, color: 'var(--color-teal)', cursor: 'pointer' }}>
                    View in Calendar →
                  </div>
                </div>
                <span style={{ fontSize: 14 }}>📅</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
