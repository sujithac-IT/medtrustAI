import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  HospitalCrossIcon,
  VideoMeetIcon,
  DoctorHostIcon,
  PatientIcon,
  PulseIcon,
  ClipboardMedicalIcon,
  WaitingRoomIcon,
  GlobeLanguageIcon,
  ShieldCheckIcon,
  SparklesIcon,
  MicIcon,
  MicOffIcon,
  CameraIcon,
  CameraOffIcon,
  CheckCircleIcon,
  ClockIcon,
} from '../components/MedicalIcons'

interface SampleConsultation {
  langCode: string
  langName: string
  originalText: string
  translatedText: string
  chiefComplaint: string
  vitals: { bp: string; pulse: string; spo2: string; temp: string }
  diagnosis: string
  icdCode: string
  rx: string[]
  speakerTurns: { speaker: string; time: string; text: string }[]
}

const SAMPLE_DATA: Record<string, SampleConsultation> = {
  hi: {
    langCode: 'hi',
    langName: 'Hindi (हिन्दी)',
    originalText: 'डॉक्टर साहब, मुझे 3 दिन से लगातार तेज बुखार, तेज सिरदर्द और सूखी खांसी आ रही है। सांस लेने में भी भारीपन लग रहा है।',
    translatedText: 'Doctor, I have had persistent high fever, severe headache, and dry cough for 3 days. I also feel heaviness while breathing.',
    chiefComplaint: 'High-grade pyrexia (3 days), frontal cephalalgia, dry cough with exertional dyspnea',
    vitals: { bp: '128/82 mmHg', pulse: '98 bpm', spo2: '97% on RA', temp: '101.4 °F' },
    diagnosis: 'Acute Upper Respiratory Tract Infection (URTI) with bronchospastic cough',
    icdCode: 'ICD-10 J06.9 / R50.9',
    rx: [
      'Tab. Paracetamol 650mg TDS x 5 days (post meals)',
      'Tab. Levocetirizine + Montelukast (10mg/5mg) 1 tab HS x 7 days',
      'Syp. Dextromethorphan HBr 10ml TDS x 5 days',
      'Warm saline gargles & steam inhalation TDS',
    ],
    speakerTurns: [
      { speaker: 'Doctor', time: '00:00 - 00:08', text: 'Namaste Rajesh ji. Please tell me what symptoms you are experiencing.' },
      { speaker: 'Patient', time: '00:09 - 00:26', text: 'डॉक्टर साहब, मुझे 3 दिन से तेज बुखार, सिरदर्द और सूखी खांसी आ रही है।' },
      { speaker: 'Doctor', time: '00:27 - 00:44', text: 'I am checking your chest vitals now. Any chest congestion or throat pain?' },
      { speaker: 'AI Scribe', time: '00:45 - 00:50', text: 'Auto-extracted: Acute URTI / Pyrexia. Case sheet section 4 & 11 updated.' },
    ],
  },
  ta: {
    langCode: 'ta',
    langName: 'Tamil (தமிழ்)',
    originalText: 'வணக்கம் டாக்டர், எனக்கு மூன்று நாட்களாக நெஞ்சு பகுதியில் இறுக்கமும், படிக்கட்டு ஏறும்போது மூச்சுத் திணறலும் ஏற்படுகிறது.',
    translatedText: 'Hello Doctor, for the past 3 days I have had tightness in my chest area and difficulty breathing when climbing stairs.',
    chiefComplaint: 'Substernal chest tightness radiating to left scapula, exertional dyspnea Class II',
    vitals: { bp: '144/92 mmHg', pulse: '86 bpm', spo2: '98% on RA', temp: '98.6 °F' },
    diagnosis: 'Suspected Angina Pectoris / Essential Systemic Hypertension',
    icdCode: 'ICD-10 I20.9 / I10',
    rx: [
      'Tab. Aspirin 75mg OD (post lunch) x 30 days',
      'Tab. Telmisartan 40mg OD (morning) x 30 days',
      'Tab. Sorbitrate 5mg SOS sublingual for acute chest pain',
      'Urgent 12-Lead ECG, 2D Echocardiography & Serum Troponin-I',
    ],
    speakerTurns: [
      { speaker: 'Doctor', time: '00:00 - 00:06', text: 'Welcome Murugan. How can I assist you with your health today?' },
      { speaker: 'Patient', time: '00:07 - 00:25', text: 'வணக்கம் டாக்டர், எனக்கு மூன்று நாட்களாக நெஞ்சு பகுதியில் இறுக்கம் உள்ளது.' },
      { speaker: 'Doctor', time: '00:26 - 00:42', text: 'Understood. Is the chest tightness accompanied by sweating or jaw pain?' },
      { speaker: 'AI Scribe', time: '00:43 - 00:48', text: 'Alert: Cardiac symptoms detected. Prioritizing emergency ECG investigation.' },
    ],
  },
  es: {
    langCode: 'es',
    langName: 'Spanish (Español)',
    originalText: 'Buenos días doctor, tengo mareos frecuentes, mucha sed y visión borrosa por las mañanas desde hace dos semanas.',
    translatedText: 'Good morning doctor, I have frequent dizziness, extreme thirst, and blurred vision in the mornings for the past two weeks.',
    chiefComplaint: 'Polydipsia, episodic vertigo, morning blurred vision (duration 14 days)',
    vitals: { bp: '132/80 mmHg', pulse: '76 bpm', spo2: '99% on RA', temp: '98.4 °F' },
    diagnosis: 'Type 2 Diabetes Mellitus with hyperosmolar osmotic symptoms',
    icdCode: 'ICD-10 E11.9',
    rx: [
      'Tab. Metformin 500mg BD with meals x 30 days',
      'Fasting & Postprandial Blood Glucose Profiling',
      'HbA1c Glycated Hemoglobin & Serum Creatinine panel',
      'Diabetic diet consultation: Low glycemic index meals',
    ],
    speakerTurns: [
      { speaker: 'Doctor', time: '00:00 - 00:07', text: 'Good morning Maria. Please explain the symptoms that brought you in today.' },
      { speaker: 'Patient', time: '00:08 - 00:27', text: 'Buenos días doctor, tengo mareos frecuentes y mucha sed por las mañanas.' },
      { speaker: 'Doctor', time: '00:28 - 00:43', text: 'We will immediately evaluate your glycemic index and check your renal vitals.' },
      { speaker: 'AI Scribe', time: '00:44 - 00:49', text: 'Auto-extracted: Diabetic triad detected. Case sheet section 7 & 12 populated.' },
    ],
  },
  en: {
    langCode: 'en',
    langName: 'English (Global)',
    originalText: 'Doctor, I have been having severe bilateral knee pain and morning stiffness for the past month, making it difficult to walk.',
    translatedText: 'Doctor, I have been having severe bilateral knee pain and morning stiffness for the past month, making it difficult to walk.',
    chiefComplaint: 'Bilateral knee arthralgia, morning stiffness (>45 mins), reduced mobility',
    vitals: { bp: '122/78 mmHg', pulse: '72 bpm', spo2: '99% on RA', temp: '98.2 °F' },
    diagnosis: 'Bilateral Primary Osteoarthritis of Knees (Grade II Kellgren-Lawrence)',
    icdCode: 'ICD-10 M17.0',
    rx: [
      'Tab. Etoricoxib 60mg OD post dinner x 7 days (SOS pain)',
      'Tab. Glucosamine Sulfate + Chondroitin OD x 60 days',
      'Gel. Diclofenac Diethylamine for gentle local application TDS',
      'Quadriceps strengthening physiotherapy & low-impact cycling',
    ],
    speakerTurns: [
      { speaker: 'Doctor', time: '00:00 - 00:06', text: 'Good afternoon. Please describe how your knee joint discomfort started.' },
      { speaker: 'Patient', time: '00:07 - 00:22', text: 'Doctor, severe bilateral knee pain and morning stiffness for a month.' },
      { speaker: 'Doctor', time: '00:23 - 00:39', text: 'Let us check joint crepitus, flexion range, and prescribe targeted chondro-protection.' },
      { speaker: 'AI Scribe', time: '00:40 - 00:45', text: 'Ortho Scribe synced: Joint examination and physiotherapy orders drafted.' },
    ],
  },
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Google Meet Meeting Launcher state
  const [meetingCodeInput, setMeetingCodeInput] = useState('')
  const [meetingDropdownOpen, setMeetingDropdownOpen] = useState(false)

  // Interactive Live Scribe Simulator state
  const [selectedLang, setSelectedLang] = useState<string>('hi')
  const [simulatorActiveTab, setSimulatorActiveTab] = useState<'scribe' | 'diarization' | 'nvidia' | 'fhir'>('scribe')
  const [isSpeaking, setIsSpeaking] = useState(true)
  const [captionIndex, setCaptionIndex] = useState(0)

  // Hardware Sandbox state
  const [webcamActive, setWebcamActive] = useState(false)
  const [micActive, setMicActive] = useState(false)
  const [micLevel, setMicLevel] = useState(0)
  const [sandboxFilter, setSandboxFilter] = useState<'normal' | 'studio' | 'blur'>('normal')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // Case Sheet Multi-Specialty Showcase state
  const [activeSpecialty, setActiveSpecialty] = useState<'cardio' | 'diabetes' | 'ortho'>('cardio')

  const activeSample = SAMPLE_DATA[selectedLang] || SAMPLE_DATA['hi']

  // Simulate speaking pulses
  useEffect(() => {
    const timer = setInterval(() => {
      setIsSpeaking((prev) => !prev)
    }, 2800)
    return () => clearInterval(timer)
  }, [])

  // Character typing effect for live translated captions
  useEffect(() => {
    setCaptionIndex(0)
    const textLen = activeSample.translatedText.length
    let current = 0
    const interval = setInterval(() => {
      current += 3
      if (current >= textLen) {
        setCaptionIndex(textLen)
        clearInterval(interval)
      } else {
        setCaptionIndex(current)
      }
    }, 35)
    return () => clearInterval(interval)
  }, [selectedLang])

  // Handle Hardware Webcam preview
  const toggleWebcam = async () => {
    if (webcamActive) {
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach((track) => track.stop())
      }
      setWebcamActive(false)
      if (videoRef.current) videoRef.current.srcObject = null
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        setWebcamActive(true)
      } catch {
        alert('Webcam access was not granted or is occupied by another application.')
      }
    }
  }

  // Handle Hardware Microphone audio level meter
  const toggleMic = async () => {
    if (micActive) {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
      setMicActive(false)
      setMicLevel(0)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        const source = audioCtx.createMediaStreamSource(stream)
        source.connect(analyser)

        audioContextRef.current = audioCtx
        analyserRef.current = analyser
        setMicActive(true)

        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        const updateLevel = () => {
          if (!analyserRef.current) return
          analyserRef.current.getByteFrequencyData(dataArray)
          let sum = 0
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i]
          }
          const avg = sum / dataArray.length
          setMicLevel(Math.min(100, Math.round((avg / 128) * 100)))
          animFrameRef.current = requestAnimationFrame(updateLevel)
        }
        updateLevel()
      } catch {
        alert('Microphone access was not granted.')
      }
    }
  }

  // Clean up streams on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [])

  // Handle patient joining via code
  const handleJoinByCode = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleaned = meetingCodeInput.trim().replace(/^https?:\/\/[^/]+\/(waiting-room\/|meet\/)?/, '')
    if (!cleaned) return
    navigate(`/waiting-room/${cleaned}`)
  }

  // Download sample FHIR R4 Bundle JSON
  const handleDownloadFhir = () => {
    const fhirBundle = {
      resourceType: 'Bundle',
      id: `medtrust-fhir-${Date.now()}`,
      type: 'document',
      timestamp: new Date().toISOString(),
      entry: [
        {
          resource: {
            resourceType: 'Composition',
            status: 'final',
            type: { text: 'Hospital Consultation Case Sheet' },
            subject: { reference: 'Patient/rajesh-kumar-45m' },
            encounter: { reference: 'Encounter/meet-telehealth-2026' },
            author: [{ reference: 'Practitioner/dr-sarah-jenkins' }],
            title: 'MedTrust AI Clinical Scribe Record',
          },
        },
        {
          resource: {
            resourceType: 'Condition',
            clinicalStatus: { coding: [{ code: 'active' }] },
            code: { text: activeSample.diagnosis, coding: [{ code: activeSample.icdCode }] },
            subject: { reference: 'Patient/rajesh-kumar-45m' },
          },
        },
        {
          resource: {
            resourceType: 'Observation',
            status: 'final',
            code: { text: 'Vital Signs Panel' },
            component: [
              { code: { text: 'Systolic/Diastolic BP' }, valueString: activeSample.vitals.bp },
              { code: { text: 'Heart Rate' }, valueString: activeSample.vitals.pulse },
              { code: { text: 'SpO2' }, valueString: activeSample.vitals.spo2 },
              { code: { text: 'Temperature' }, valueString: activeSample.vitals.temp },
            ],
          },
        },
      ],
    }

    const blob = new Blob([JSON.stringify(fhirBundle, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `FHIR-R4-CaseSheet-${activeSample.langCode}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="landing-container">
      {/* ─── Google Top Header Bar ────────────────────────────────────────── */}
      <header className="google-header">
        <div className="google-header-brand" onClick={() => navigate('/')}>
          <div className="google-brand-icon">
            <HospitalCrossIcon size={22} color="#FFFFFF" />
          </div>
          <div className="google-brand-title">
            <span>MedTrust AI</span>
            <span className="google-brand-badge">Google Meet Clinical</span>
          </div>
        </div>

        <nav className="google-nav-links">
          <a href="#meet-launcher" className="google-nav-link">Google Meet Telehealth</a>
          <a href="#ai-scribe" className="google-nav-link">Meetily Ambient Scribe</a>
          <a href="#hardware-check" className="google-nav-link">Pre-Flight Cam & Mic</a>
          <a href="#emr-showcase" className="google-nav-link">17-Section EMR</a>
          <a href="#compliance" className="google-nav-link">ABDM & Security</a>
        </nav>

        <div className="google-header-actions">
          {user ? (
            <button
              className="btn-google-primary"
              onClick={() => navigate('/dashboard')}
              title="Enter your Doctor Workspace"
            >
              <DoctorHostIcon size={16} color="#FFFFFF" />
              <span>Doctor Dashboard</span>
            </button>
          ) : (
            <>
              <button
                className="btn-google-text"
                onClick={() => navigate('/login')}
              >
                Sign In
              </button>
              <button
                className="btn-google-primary"
                onClick={() => navigate('/consultation')}
              >
                <VideoMeetIcon size={16} color="#FFFFFF" />
                <span>Start Instant Consultation</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* ─── Hero Section ─────────────────────────────────────────────────── */}
      <section className="landing-hero" id="meet-launcher">
        <div className="hero-content">
          <div className="hero-tag">
            <SparklesIcon size={14} color="#1A73E8" />
            <span>Google Meet Telehealth + Meetily-Grade AI Clinical Scribe</span>
          </div>

          <h1 className="hero-title">
            AI-Powered Clinical Video Consultations,{' '}
            <span className="hero-title-highlight">Transcribed & Documented in Real-Time.</span>
          </h1>

          <p className="hero-desc">
            Doctors act as permanent hosts. Patients join via zero-friction personalized links with waiting room admission queue. Speak in any language—real-time YouTube-style captions translate into English while AI generates standardized 17-section hospital EMR case sheets.
          </p>

          {/* Google Meet Style Meeting Launcher */}
          <div className="google-meet-launcher">
            <div className="launcher-modes">
              {/* Doctor Host Action */}
              <div style={{ position: 'relative' }}>
                <button
                  className="launcher-new-btn"
                  onClick={() => setMeetingDropdownOpen(!meetingDropdownOpen)}
                >
                  <VideoMeetIcon size={18} color="#FFFFFF" />
                  <span>New consultation</span>
                </button>

                {meetingDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      background: '#FFFFFF',
                      border: '1px solid #DADCE0',
                      borderRadius: 12,
                      boxShadow: '0 4px 16px rgba(60,64,67,0.2)',
                      zIndex: 50,
                      width: 270,
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: 14,
                        color: '#202124',
                      }}
                      onClick={() => {
                        setMeetingDropdownOpen(false)
                        navigate('/consultation')
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F3F4')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <SparklesIcon size={16} color="#1A73E8" />
                      <div>
                        <div style={{ fontWeight: 600 }}>Start an instant consultation</div>
                        <div style={{ fontSize: 12, color: '#5F6368' }}>Open live room as Doctor Host</div>
                      </div>
                    </button>

                    <button
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontSize: 14,
                        color: '#202124',
                        borderTop: '1px solid #F1F3F4',
                      }}
                      onClick={() => {
                        setMeetingDropdownOpen(false)
                        const code = `meet-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}`
                        navigator.clipboard.writeText(`${window.location.origin}/waiting-room/${code}`)
                        alert(`Personalized Google Meet link copied to clipboard:\n${window.location.origin}/waiting-room/${code}`)
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F3F4')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <DoctorHostIcon size={16} color="#007A64" />
                      <div>
                        <div style={{ fontWeight: 600 }}>Create meeting link for later</div>
                        <div style={{ fontSize: 12, color: '#5F6368' }}>Copy personalized patient link</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Patient Join Input */}
              <form onSubmit={handleJoinByCode} className="launcher-input-group">
                <span className="launcher-icon">
                  <WaitingRoomIcon size={18} color="#5F6368" />
                </span>
                <input
                  type="text"
                  className="launcher-input"
                  placeholder="Enter a code or meeting link"
                  value={meetingCodeInput}
                  onChange={(e) => setMeetingCodeInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="launcher-join-btn"
                  disabled={!meetingCodeInput.trim()}
                >
                  Join
                </button>
              </form>
            </div>

            {/* Quick Demo Pre-fill Chips */}
            <div className="launcher-chips">
              <span>Try quick test links:</span>
              <span
                className="launcher-chip"
                onClick={() => setMeetingCodeInput('dr-sarah-cardiology-01')}
              >
                dr-sarah-cardiology-01
              </span>
              <span
                className="launcher-chip"
                onClick={() => setMeetingCodeInput('urgent-pediatrics-911')}
              >
                urgent-pediatrics-911
              </span>
              <span
                className="launcher-chip"
                onClick={() => navigate('/waiting-room/demo-general-medicine')}
              >
                Launch Waiting Room Demo &rarr;
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 13, color: '#5F6368' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircleIcon size={16} color="#188038" />
              ABDM Certified (M1, M2, M3)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircleIcon size={16} color="#188038" />
              NVIDIA Maxine Studio Video
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircleIcon size={16} color="#188038" />
              100% Privacy-First (Meetily Architecture)
            </span>
          </div>
        </div>

        {/* ─── Hero Interactive Live Scribe Simulator (Meetily Concept) ──── */}
        <div className="hero-simulator-card" id="ai-scribe">
          <div className="simulator-topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="simulator-status-dot" />
              <span style={{ fontWeight: 600 }}>Live Telehealth & Ambient AI Scribe</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#9CA3AF' }}>
              <span>NVIDIA Maxine 1080p</span>
              <span>•</span>
              <span>Whisper STT Edge</span>
            </div>
          </div>

          {/* Dual Video Simulation */}
          <div className="simulator-video-viewport">
            {/* Doctor Host Tile */}
            <div className="sim-tile">
              <div className="sim-avatar-circle">
                <DoctorHostIcon size={34} color="#FFFFFF" />
              </div>
              <div className="sim-name-badge">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
                <span>Dr. Sarah Jenkins (Host)</span>
              </div>
              <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4, fontSize: 10, color: '#FFFFFF' }}>
                HD 60 FPS
              </div>
            </div>

            {/* Patient Tile with Speaking Ring */}
            <div className="sim-tile">
              {isSpeaking && <div className="sim-speaking-ring" />}
              <div className="sim-avatar-circle sim-avatar-patient">
                <PatientIcon size={34} color="#FFFFFF" />
              </div>
              <div className="sim-name-badge">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
                <span>Rajesh Kumar (Patient)</span>
                {isSpeaking && <MicIcon size={12} color="#10B981" />}
              </div>
            </div>

            {/* YouTube-Style Live Translated Captions Overlay */}
            <div className="sim-youtube-caption-box">
              <span className="sim-caption-cc-badge">CC LIVE</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="sim-caption-text">
                  {activeSample.translatedText.slice(0, captionIndex)}
                  <span style={{ animation: 'blink 0.8s infinite', color: '#1A73E8' }}>|</span>
                </div>
                <div className="sim-caption-orig">
                  Spoken ({activeSample.langName}): "{activeSample.originalText.slice(0, 60)}..."
                </div>
              </div>
            </div>
          </div>

          {/* Language Selector Pills */}
          <div style={{ padding: '10px 16px', background: '#FFFFFF', borderTop: '1px solid #E8EAED', display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#5F6368', whiteSpace: 'nowrap' }}>
              Switch Language:
            </span>
            {Object.keys(SAMPLE_DATA).map((code) => (
              <button
                key={code}
                onClick={() => setSelectedLang(code)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: selectedLang === code ? 700 : 500,
                  border: selectedLang === code ? '1px solid #1A73E8' : '1px solid #DADCE0',
                  background: selectedLang === code ? '#E8F0FE' : '#FFFFFF',
                  color: selectedLang === code ? '#1A73E8' : '#3C4043',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {SAMPLE_DATA[code].langName}
              </button>
            ))}
          </div>

          {/* Tab bar for Inspection */}
          <div className="simulator-tab-bar">
            <button
              className={`sim-tab-btn ${simulatorActiveTab === 'scribe' ? 'active' : ''}`}
              onClick={() => setSimulatorActiveTab('scribe')}
            >
              <ClipboardMedicalIcon size={14} color="currentColor" /> AI Scribe (Auto-EMR)
            </button>
            <button
              className={`sim-tab-btn ${simulatorActiveTab === 'diarization' ? 'active' : ''}`}
              onClick={() => setSimulatorActiveTab('diarization')}
            >
              <DoctorHostIcon size={14} color="currentColor" /> Speaker Diarization
            </button>
            <button
              className={`sim-tab-btn ${simulatorActiveTab === 'nvidia' ? 'active' : ''}`}
              onClick={() => setSimulatorActiveTab('nvidia')}
            >
              <SparklesIcon size={14} color="currentColor" /> NVIDIA Maxine
            </button>
            <button
              className={`sim-tab-btn ${simulatorActiveTab === 'fhir' ? 'active' : ''}`}
              onClick={() => setSimulatorActiveTab('fhir')}
            >
              <ShieldCheckIcon size={14} color="currentColor" /> FHIR R4 Bundle
            </button>
          </div>

          {/* Tab Content Panes */}
          <div className="simulator-content-pane">
            {simulatorActiveTab === 'scribe' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1A73E8', textTransform: 'uppercase', marginBottom: 4 }}>
                    Extracted Chief Complaint
                  </div>
                  <div style={{ fontSize: 13, color: '#202124', fontWeight: 600 }}>
                    {activeSample.chiefComplaint}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: '#5F6368', textTransform: 'uppercase' }}>
                    Clinical Vitals
                  </div>
                  <div style={{ fontSize: 12, color: '#3C4043', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                    <span style={{ background: '#F1F3F4', padding: '2px 6px', borderRadius: 4 }}>BP: {activeSample.vitals.bp}</span>
                    <span style={{ background: '#F1F3F4', padding: '2px 6px', borderRadius: 4 }}>HR: {activeSample.vitals.pulse}</span>
                    <span style={{ background: '#F1F3F4', padding: '2px 6px', borderRadius: 4 }}>SpO2: {activeSample.vitals.spo2}</span>
                    <span style={{ background: '#F1F3F4', padding: '2px 6px', borderRadius: 4 }}>Temp: {activeSample.vitals.temp}</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#007A64', textTransform: 'uppercase', marginBottom: 4 }}>
                    Diagnosis & Coding
                  </div>
                  <div style={{ fontSize: 13, color: '#202124', fontWeight: 600 }}>
                    {activeSample.diagnosis}
                  </div>
                  <div style={{ fontSize: 11, color: '#1A73E8', fontWeight: 600, marginTop: 2 }}>
                    {activeSample.icdCode}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: '#5F6368', textTransform: 'uppercase' }}>
                    Rx Prescriptions ({activeSample.rx.length})
                  </div>
                  <div style={{ fontSize: 11, color: '#3C4043' }}>
                    {activeSample.rx[0]}
                  </div>
                </div>
              </div>
            )}

            {simulatorActiveTab === 'diarization' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeSample.speakerTurns.map((turn, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start',
                      fontSize: 12,
                      padding: '4px 8px',
                      borderRadius: 6,
                      background: turn.speaker === 'Doctor' ? '#E8F0FE' : turn.speaker === 'Patient' ? '#F3E8FF' : '#E6F4EA',
                    }}
                  >
                    <span style={{ fontWeight: 700, minWidth: 65, color: '#202124' }}>{turn.speaker}:</span>
                    <span style={{ color: '#5F6368', fontSize: 11, minWidth: 80 }}>{turn.time}</span>
                    <span style={{ flex: 1, color: '#202124' }}>{turn.text}</span>
                  </div>
                ))}
              </div>
            )}

            {simulatorActiveTab === 'nvidia' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div style={{ background: '#F8F9FA', padding: 10, borderRadius: 8, border: '1px solid #E8EAED' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#188038' }}>● Studio Lighting</div>
                  <div style={{ fontSize: 12, color: '#202124', marginTop: 4 }}>NVIDIA Maxine V2</div>
                  <div style={{ fontSize: 11, color: '#5F6368' }}>Adaptive face relighting active</div>
                </div>
                <div style={{ background: '#F8F9FA', padding: 10, borderRadius: 8, border: '1px solid #E8EAED' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#188038' }}>● Eye Contact AI</div>
                  <div style={{ fontSize: 12, color: '#202124', marginTop: 4 }}>Gaze Correction</div>
                  <div style={{ fontSize: 11, color: '#5F6368' }}>Locked to patient screen axis</div>
                </div>
                <div style={{ background: '#F8F9FA', padding: 10, borderRadius: 8, border: '1px solid #E8EAED' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#188038' }}>● Neural Denoising</div>
                  <div style={{ fontSize: 12, color: '#202124', marginTop: 4 }}>Maxine Audio SDK</div>
                  <div style={{ fontSize: 11, color: '#5F6368' }}>34 dB noise floor attenuation</div>
                </div>
              </div>
            )}

            {simulatorActiveTab === 'fhir' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#202124' }}>
                    HL7 FHIR Release 4 Composition Bundle (ABDM M3 Schema)
                  </span>
                  <button
                    onClick={handleDownloadFhir}
                    style={{
                      padding: '4px 10px',
                      background: '#1A73E8',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Download JSON Bundle
                  </button>
                </div>
                <pre
                  style={{
                    background: '#1E293B',
                    color: '#38BDF8',
                    padding: 8,
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                    maxHeight: 90,
                  }}
                >
{`{
  "resourceType": "Bundle",
  "type": "document",
  "diagnosis": "${activeSample.diagnosis}",
  "icd10": "${activeSample.icdCode}",
  "vitals": ${JSON.stringify(activeSample.vitals)},
  "security": "HIPAA + ABDM M3 Compliant"
}`}
                </pre>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── Hardware Pre-Flight Cam & Mic Sandbox ────────────────────────── */}
      <section className="pillars-section" id="hardware-check" style={{ background: '#FFFFFF' }}>
        <div className="section-header-center">
          <span className="section-tag">Interactive Hardware Sandbox</span>
          <h2 className="section-title">Pre-Flight Hardware Check (Google Meet Green Room)</h2>
          <p className="section-subtitle">
            Verify your camera feed, monitor real microphone audio input levels, and preview simulated NVIDIA Maxine AI enhancements directly before entering your live clinical consultation.
          </p>
        </div>

        <div style={{ maxWidth: 880, margin: '0 auto', background: '#F8FAFD', borderRadius: 24, border: '1px solid #E8EAED', padding: 28, boxShadow: 'var(--google-elevation-2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 24, alignItems: 'center' }}>
            {/* Real Webcam Output Box */}
            <div className="sandbox-video-box">
              {webcamActive ? (
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    filter:
                      sandboxFilter === 'studio'
                        ? 'brightness(1.12) contrast(1.08) saturate(1.05)'
                        : sandboxFilter === 'blur'
                        ? 'blur(0px)'
                        : 'none',
                  }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#94A3B8', padding: 24 }}>
                  <CameraOffIcon size={44} color="#64748B" />
                  <p style={{ marginTop: 12, fontSize: 13, fontWeight: 500 }}>
                    Camera is currently off. Click below to test your webcam feed.
                  </p>
                </div>
              )}

              {/* Status Overlay */}
              <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 8 }}>
                <span style={{ background: 'rgba(0,0,0,0.7)', color: '#FFFFFF', padding: '4px 8px', borderRadius: 4, fontSize: 11 }}>
                  {webcamActive ? '● Camera Active' : 'Camera Muted'}
                </span>
                {sandboxFilter !== 'normal' && (
                  <span style={{ background: '#1A73E8', color: '#FFFFFF', padding: '4px 8px', borderRadius: 4, fontSize: 11 }}>
                    {sandboxFilter === 'studio' ? 'Maxine Studio Light' : 'Background Blur'}
                  </span>
                )}
              </div>
            </div>

            {/* Hardware Controls & Mic Analyser */}
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#202124', marginBottom: 12 }}>
                Device Diagnostic Console
              </h3>

              {/* Cam Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '12px 16px', background: '#FFFFFF', borderRadius: 12, border: '1px solid #DADCE0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CameraIcon size={20} color={webcamActive ? '#188038' : '#5F6368'} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Webcam Video Feed</div>
                    <div style={{ fontSize: 11, color: '#5F6368' }}>{webcamActive ? 'Local camera streaming' : 'Turn on to test video'}</div>
                  </div>
                </div>
                <button
                  onClick={toggleWebcam}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 9999,
                    border: 'none',
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                    background: webcamActive ? '#FCE8E6' : '#E8F0FE',
                    color: webcamActive ? '#D93025' : '#1A73E8',
                  }}
                >
                  {webcamActive ? 'Stop Camera' : 'Test Camera'}
                </button>
              </div>

              {/* Mic Toggle & Real-time meter */}
              <div style={{ marginBottom: 16, padding: '12px 16px', background: '#FFFFFF', borderRadius: 12, border: '1px solid #DADCE0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <MicIcon size={20} color={micActive ? '#188038' : '#5F6368'} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Microphone Audio Meter</div>
                      <div style={{ fontSize: 11, color: '#5F6368' }}>{micActive ? 'Speak to test volume' : 'Click to start test'}</div>
                    </div>
                  </div>
                  <button
                    onClick={toggleMic}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 9999,
                      border: 'none',
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: 'pointer',
                      background: micActive ? '#FCE8E6' : '#E8F0FE',
                      color: micActive ? '#D93025' : '#1A73E8',
                    }}
                  >
                    {micActive ? 'Stop Mic' : 'Test Mic'}
                  </button>
                </div>

                {/* Audio bar */}
                <div style={{ background: '#E8EAED', height: 8, borderRadius: 9999, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${micLevel}%`,
                      height: '100%',
                      background: micLevel > 75 ? '#D93025' : micLevel > 40 ? '#188038' : '#1A73E8',
                      transition: 'width 0.1s ease',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#80868B', marginTop: 4 }}>
                  <span>Input level: {micLevel}%</span>
                  <span>{micActive ? (micLevel > 15 ? 'Good audio signal detected' : 'Listening...') : 'Mic idle'}</span>
                </div>
              </div>

              {/* Simulated NVIDIA Maxine Studio Video Filters */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#5F6368', marginBottom: 8 }}>
                  Simulated NVIDIA Video Filters:
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setSandboxFilter('normal')}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: sandboxFilter === 'normal' ? 700 : 500,
                      border: sandboxFilter === 'normal' ? '1px solid #1A73E8' : '1px solid #DADCE0',
                      background: sandboxFilter === 'normal' ? '#E8F0FE' : '#FFFFFF',
                      color: sandboxFilter === 'normal' ? '#1A73E8' : '#3C4043',
                      cursor: 'pointer',
                    }}
                  >
                    Natural
                  </button>
                  <button
                    onClick={() => setSandboxFilter('studio')}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: sandboxFilter === 'studio' ? 700 : 500,
                      border: sandboxFilter === 'studio' ? '1px solid #1A73E8' : '1px solid #DADCE0',
                      background: sandboxFilter === 'studio' ? '#E8F0FE' : '#FFFFFF',
                      color: sandboxFilter === 'studio' ? '#1A73E8' : '#3C4043',
                      cursor: 'pointer',
                    }}
                  >
                    Studio Light
                  </button>
                  <button
                    onClick={() => setSandboxFilter('blur')}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: sandboxFilter === 'blur' ? 700 : 500,
                      border: sandboxFilter === 'blur' ? '1px solid #1A73E8' : '1px solid #DADCE0',
                      background: sandboxFilter === 'blur' ? '#E8F0FE' : '#FFFFFF',
                      color: sandboxFilter === 'blur' ? '#1A73E8' : '#3C4043',
                      cursor: 'pointer',
                    }}
                  >
                    Clinical Backdrop
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 4 Pillars of Architecture (Meetily + Google Meet + EMR + NVIDIA) ─── */}
      <section className="pillars-section">
        <div className="section-header-center">
          <span className="section-tag">Clinical Telehealth Infrastructure</span>
          <h2 className="section-title">Engineered for Google Meet Reliability & Meetily Intelligence</h2>
          <p className="section-subtitle">
            Combining Google Meet's zero-friction video infrastructure with Meetily's privacy-first ambient transcription architecture.
          </p>
        </div>

        <div className="pillars-grid">
          {/* Pillar 1: Google Meet Telehealth */}
          <div className="pillar-card">
            <div className="pillar-icon-wrap" style={{ background: '#E8F0FE', color: '#1A73E8' }}>
              <VideoMeetIcon size={26} color="#1A73E8" />
            </div>
            <h3 className="pillar-title">Google Meet Telehealth</h3>
            <p className="pillar-desc">
              Doctor acts as permanent host. Patients join directly using personalized meeting links with waiting room admission queue.
            </p>
            <ul className="pillar-features-list">
              <li className="pillar-feature-item">
                <CheckCircleIcon size={16} color="#188038" />
                <span>Doctor-only admission control modal</span>
              </li>
              <li className="pillar-feature-item">
                <CheckCircleIcon size={16} color="#188038" />
                <span>Google Calendar email invite dispatch</span>
              </li>
              <li className="pillar-feature-item">
                <CheckCircleIcon size={16} color="#188038" />
                <span>Real-time webcam feed isolation</span>
              </li>
            </ul>
          </div>

          {/* Pillar 2: Meetily Ambient Scribe */}
          <div className="pillar-card">
            <div className="pillar-icon-wrap" style={{ background: '#F3E8FF', color: '#7C3AED' }}>
              <GlobeLanguageIcon size={26} color="#7C3AED" />
            </div>
            <h3 className="pillar-title">Meetily Ambient Scribe</h3>
            <p className="pillar-desc">
              Privacy-first real-time audio capture, speaker diarization (Doctor vs Patient), and YouTube-style English translation captions.
            </p>
            <ul className="pillar-features-list">
              <li className="pillar-feature-item">
                <CheckCircleIcon size={16} color="#188038" />
                <span>Multilingual translation (12+ languages &rarr; English)</span>
              </li>
              <li className="pillar-feature-item">
                <CheckCircleIcon size={16} color="#188038" />
                <span>YouTube-style live caption overlay [CC]</span>
              </li>
              <li className="pillar-feature-item">
                <CheckCircleIcon size={16} color="#188038" />
                <span>Turn-by-turn speaker identification</span>
              </li>
            </ul>
          </div>

          {/* Pillar 3: 17-Section EMR Case Sheet */}
          <div className="pillar-card">
            <div className="pillar-icon-wrap" style={{ background: '#E6F4EA', color: '#188038' }}>
              <ClipboardMedicalIcon size={26} color="#188038" />
            </div>
            <h3 className="pillar-title">17-Section Hospital EMR</h3>
            <p className="pillar-desc">
              Automated case sheet generation adhering to National Health Authority (NHA) standards and HL7 FHIR Release 4 export.
            </p>
            <ul className="pillar-features-list">
              <li className="pillar-feature-item">
                <CheckCircleIcon size={16} color="#188038" />
                <span>Standardized 17-section clinical structure</span>
              </li>
              <li className="pillar-feature-item">
                <CheckCircleIcon size={16} color="#188038" />
                <span>ICD-10 clinical coding auto-suggestion</span>
              </li>
              <li className="pillar-feature-item">
                <CheckCircleIcon size={16} color="#188038" />
                <span>Doctor digital signature & FHIR JSON bundle</span>
              </li>
            </ul>
          </div>

          {/* Pillar 4: NVIDIA Maxine Edge */}
          <div className="pillar-card">
            <div className="pillar-icon-wrap" style={{ background: '#FEF3C7', color: '#D97706' }}>
              <SparklesIcon size={26} color="#D97706" />
            </div>
            <h3 className="pillar-title">NVIDIA Maxine AI Video</h3>
            <p className="pillar-desc">
              Hardware-accelerated edge AI for studio lighting, neural acoustic background noise cancellation, and eye contact correction.
            </p>
            <ul className="pillar-features-list">
              <li className="pillar-feature-item">
                <CheckCircleIcon size={16} color="#188038" />
                <span>Maxine Audio neural noise suppressor</span>
              </li>
              <li className="pillar-feature-item">
                <CheckCircleIcon size={16} color="#188038" />
                <span>Studio Lighting illumination enhancement</span>
              </li>
              <li className="pillar-feature-item">
                <CheckCircleIcon size={16} color="#188038" />
                <span>TensorRT low-latency inference pipeline</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ─── Case Sheet Multi-Specialty Showcase ──────────────────────────── */}
      <section className="case-sheet-showcase" id="emr-showcase">
        <div className="section-header-center">
          <span className="section-tag">Standardized Hospital EMR</span>
          <h2 className="section-title">Automated 17-Section Clinical Documentation</h2>
          <p className="section-subtitle">
            Every consultation is automatically organized into a legally compliant, hospital-ready medical case sheet with ICD-10 diagnostic coding and digital signatures.
          </p>
        </div>

        {/* Specialty Tabs */}
        <div className="showcase-tab-bar">
          <button
            className={`showcase-tab ${activeSpecialty === 'cardio' ? 'active' : ''}`}
            onClick={() => setActiveSpecialty('cardio')}
          >
            Cardiology Case Sheet (Angina Pectoris)
          </button>
          <button
            className={`showcase-tab ${activeSpecialty === 'diabetes' ? 'active' : ''}`}
            onClick={() => setActiveSpecialty('diabetes')}
          >
            Endocrinology Case Sheet (Type 2 DM)
          </button>
          <button
            className={`showcase-tab ${activeSpecialty === 'ortho' ? 'active' : ''}`}
            onClick={() => setActiveSpecialty('ortho')}
          >
            Orthopedics Case Sheet (Osteoarthritis)
          </button>
        </div>

        {/* Clinical Document Paper */}
        <div className="showcase-paper">
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0B57D0', paddingBottom: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, background: '#0B57D0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF' }}>
                <HospitalCrossIcon size={24} color="#FFFFFF" />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>MEDTRUST MEMORIAL HOSPITAL & RESEARCH INSTITUTE</h3>
                <p style={{ fontSize: 12, color: '#64748B' }}>Department of Telemedicine & Clinical Informatics • ABDM Facility ID: IN-DL-MED-0092</p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ background: '#E6F4EA', color: '#188038', padding: '4px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 700 }}>
                HL7 FHIR R4 CERTIFIED
              </span>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Date: 22 Sep 2026 • 15:30 IST</div>
            </div>
          </div>

          {/* Patient Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, background: '#F8FAFD', padding: 14, borderRadius: 10, border: '1px solid #E2E8F0', marginBottom: 20, fontSize: 12 }}>
            <div>
              <span style={{ color: '#64748B' }}>Patient Name:</span>
              <div style={{ fontWeight: 700, color: '#0F172A' }}>Rajesh Kumar</div>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Age / Gender:</span>
              <div style={{ fontWeight: 700, color: '#0F172A' }}>45 Yrs / Male</div>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>ABHA Address:</span>
              <div style={{ fontWeight: 700, color: '#0B57D0' }}>rajesh.kumar@abdm</div>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Consulting Doctor:</span>
              <div style={{ fontWeight: 700, color: '#0F172A' }}>Dr. Sarah Jenkins, MD</div>
            </div>
          </div>

          {/* 17-Section Sample Rendering */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0B57D0', marginBottom: 4 }}>1. CHIEF COMPLAINTS</div>
              <p style={{ fontSize: 13, color: '#1E293B' }}>
                {activeSpecialty === 'cardio'
                  ? 'Substernal chest tightness radiating to left shoulder on moderate exertion for 3 days.'
                  : activeSpecialty === 'diabetes'
                  ? 'Polyuria, polydipsia, excessive fatigue and blurred morning vision for 2 weeks.'
                  : 'Bilateral knee pain, joint stiffness lasting >45 mins each morning, difficulty descending stairs.'}
              </p>
            </div>

            <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0B57D0', marginBottom: 4 }}>4. VITAL SIGNS PANEL</div>
              <div style={{ display: 'flex', gap: 8, fontSize: 12, color: '#1E293B', flexWrap: 'wrap' }}>
                <span style={{ background: '#EFF6FF', padding: '2px 8px', borderRadius: 4 }}>BP: 130/84 mmHg</span>
                <span style={{ background: '#EFF6FF', padding: '2px 8px', borderRadius: 4 }}>Pulse: 78 bpm</span>
                <span style={{ background: '#EFF6FF', padding: '2px 8px', borderRadius: 4 }}>SpO2: 98%</span>
                <span style={{ background: '#EFF6FF', padding: '2px 8px', borderRadius: 4 }}>Temp: 98.4 °F</span>
              </div>
            </div>

            <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#007A64', marginBottom: 4 }}>11. PROVISIONAL & DIFFERENTIAL DIAGNOSIS</div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>
                {activeSpecialty === 'cardio'
                  ? 'Angina Pectoris, Unspecified (ICD-10 I20.9)'
                  : activeSpecialty === 'diabetes'
                  ? 'Type 2 Diabetes Mellitus without complications (ICD-10 E11.9)'
                  : 'Bilateral Primary Osteoarthritis of Knee (ICD-10 M17.0)'}
              </p>
            </div>

            <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0B57D0', marginBottom: 4 }}>13. RX PRESCRIPTION & ORDERS</div>
              <ul style={{ fontSize: 12, color: '#1E293B', paddingLeft: 16 }}>
                <li>Aspirin 75mg OD post lunch x 30 days</li>
                <li>Atorvastatin 20mg 1 tab HS x 30 days</li>
                <li>Sorbitrate 5mg sublingually SOS for chest discomfort</li>
              </ul>
            </div>
          </div>

          {/* Doctor Signature Footer */}
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748B' }}>
              🔒 Cryptographically signed by Dr. Sarah Jenkins (Reg: MCI-84920) via MedTrust ABDM Vault
            </div>
            <button
              onClick={() => navigate('/consultation')}
              className="btn-google-primary"
              style={{ padding: '8px 16px', fontSize: 12 }}
            >
              Generate Live EMR in Consultation &rarr;
            </button>
          </div>
        </div>
      </section>

      {/* ─── Compliance & Trust Bar ───────────────────────────────────────── */}
      <section className="trust-bar" id="compliance">
        <div className="trust-badges-row">
          <div className="trust-badge-item">
            <div className="trust-badge-icon">
              <ShieldCheckIcon size={24} color="#1A73E8" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#202124' }}>ABDM M1 / M2 / M3</div>
              <div style={{ fontSize: 12, color: '#5F6368' }}>National Health Authority Certified</div>
            </div>
          </div>

          <div className="trust-badge-item">
            <div className="trust-badge-icon">
              <HospitalCrossIcon size={24} color="#007A64" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#202124' }}>HIPAA & ISO 27001</div>
              <div style={{ fontSize: 12, color: '#5F6368' }}>End-to-End 256-bit AES Encryption</div>
            </div>
          </div>

          <div className="trust-badge-item">
            <div className="trust-badge-icon">
              <SparklesIcon size={24} color="#7C3AED" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#202124' }}>Meetily-Grade Privacy</div>
              <div style={{ fontSize: 12, color: '#5F6368' }}>Zero-Retention Local Edge Scribe</div>
            </div>
          </div>

          <div className="trust-badge-item">
            <div className="trust-badge-icon">
              <ClipboardMedicalIcon size={24} color="#188038" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#202124' }}>HL7 FHIR R4 Bundle</div>
              <div style={{ fontSize: 12, color: '#5F6368' }}>Interoperable Hospital EMR Export</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Google Footer ────────────────────────────────────────────────── */}
      <footer className="google-footer">
        <div className="google-footer-grid">
          <div>
            <div className="google-header-brand" style={{ marginBottom: 16 }}>
              <div className="google-brand-icon">
                <HospitalCrossIcon size={20} color="#FFFFFF" />
              </div>
              <span className="google-brand-title">MedTrust AI</span>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: '#5F6368', maxWidth: 320 }}>
              The next-generation Google Meet telehealth platform with Meetily-grade local AI clinical scribing, multilingual YouTube-style captions, and hospital-standard 17-section EMR case sheets.
            </p>
          </div>

          <div>
            <h4 className="footer-col-title">Telehealth</h4>
            <ul className="footer-links">
              <li><a href="#meet-launcher" className="footer-link">Google Meet Telehealth</a></li>
              <li><a href="#hardware-check" className="footer-link">Pre-Flight Hardware Check</a></li>
              <li><a href="#meet-launcher" className="footer-link">Patient Waiting Room</a></li>
              <li><a href="#ai-scribe" className="footer-link">Multilingual Speech Captions</a></li>
            </ul>
          </div>

          <div>
            <h4 className="footer-col-title">AI & Clinical EMR</h4>
            <ul className="footer-links">
              <li><a href="#ai-scribe" className="footer-link">Meetily Ambient Scribe</a></li>
              <li><a href="#emr-showcase" className="footer-link">17-Section EMR Format</a></li>
              <li><a href="#ai-scribe" className="footer-link">HL7 FHIR R4 Export</a></li>
              <li><a href="#ai-scribe" className="footer-link">NVIDIA Maxine AI Video</a></li>
            </ul>
          </div>

          <div>
            <h4 className="footer-col-title">Governance & Trust</h4>
            <ul className="footer-links">
              <li><a href="#compliance" className="footer-link">ABDM M1, M2, M3</a></li>
              <li><a href="#compliance" className="footer-link">HIPAA Compliance</a></li>
              <li><a href="#compliance" className="footer-link">Doctor Digital Signature</a></li>
              <li><a href="#compliance" className="footer-link">Privacy-First Architecture</a></li>
            </ul>
          </div>
        </div>

        <div className="google-footer-bottom">
          <div>
            © {new Date().getFullYear()} MedTrust AI Clinical Technologies Inc. All rights reserved. ABDM & HIPAA compliant.
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <span>Privacy Policy</span>
            <span>Terms of Clinical Service</span>
            <span>Security Audit</span>
            <span>System Status: 100% Operational</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
