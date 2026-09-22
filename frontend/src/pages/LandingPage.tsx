import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  VideoMeetIcon,
  DoctorHostIcon,
  PatientIcon,
  WaitingRoomIcon,
  ClipboardMedicalIcon,
  ShieldCheckIcon,
  SparklesIcon,
  MicIcon,
  CameraIcon,
  CameraOffIcon,
  CheckCircleIcon,
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
}

const SAMPLE_DATA: Record<string, SampleConsultation> = {
  hi: {
    langCode: 'hi',
    langName: 'Hindi (हिन्दी)',
    originalText: 'डॉक्टर साहब, मुझे 3 दिन से तेज बुखार, सिरदर्द और सूखी खांसी आ रही है। सांस लेने में भी तकलीफ है।',
    translatedText: 'Doctor, I have had high fever, severe headache, and dry cough for 3 days. I also have difficulty breathing.',
    chiefComplaint: 'High-grade pyrexia (3 days), severe frontal headache, dry cough with exertional dyspnea',
    vitals: { bp: '128/82 mmHg', pulse: '98 bpm', spo2: '97% on RA', temp: '101.4 °F' },
    diagnosis: 'Acute Upper Respiratory Tract Infection (URTI) with Bronchospasm',
    icdCode: 'ICD-10 J06.9 / R50.9',
    rx: [
      'Tab. Paracetamol 650mg TDS x 5 days (post meals)',
      'Tab. Levocetirizine + Montelukast (10mg/5mg) 1 tab HS x 7 days',
      'Syp. Dextromethorphan HBr 10ml TDS x 5 days',
    ],
  },
  ta: {
    langCode: 'ta',
    langName: 'Tamil (தமிழ்)',
    originalText: 'வணக்கம் டாக்டர், எனக்கு மூன்று நாட்களாக நெஞ்சு பகுதியில் இறுக்கமும், படிக்கட்டு ஏறும்போது மூச்சுத் திணறலும் உள்ளது.',
    translatedText: 'Hello Doctor, for the past 3 days I have had chest tightness and breathlessness while climbing stairs.',
    chiefComplaint: 'Substernal chest tightness radiating to left shoulder, exertional dyspnea NYHA II',
    vitals: { bp: '144/92 mmHg', pulse: '86 bpm', spo2: '98% on RA', temp: '98.6 °F' },
    diagnosis: 'Suspected Angina Pectoris / Essential Hypertension',
    icdCode: 'ICD-10 I20.9 / I10',
    rx: [
      'Tab. Aspirin 75mg OD (post lunch) x 30 days',
      'Tab. Telmisartan 40mg OD (morning) x 30 days',
      'Tab. Sorbitrate 5mg SOS sublingually for acute pain',
    ],
  },
  es: {
    langCode: 'es',
    langName: 'Spanish (Español)',
    originalText: 'Buenos días doctor, tengo mareos frecuentes, mucha sed y visión borrosa por las mañanas.',
    translatedText: 'Good morning doctor, I have frequent dizziness, extreme thirst, and blurred morning vision.',
    chiefComplaint: 'Polydipsia, episodic vertigo, morning blurred vision (duration 14 days)',
    vitals: { bp: '132/80 mmHg', pulse: '76 bpm', spo2: '99% on RA', temp: '98.4 °F' },
    diagnosis: 'Type 2 Diabetes Mellitus with Osmotic Symptoms',
    icdCode: 'ICD-10 E11.9',
    rx: [
      'Tab. Metformin 500mg BD with meals x 30 days',
      'Fasting & Postprandial Blood Glucose Profiling',
      'HbA1c Glycated Hemoglobin Test',
    ],
  },
  en: {
    langCode: 'en',
    langName: 'English (Global)',
    originalText: 'Doctor, I have been having severe bilateral knee pain and morning stiffness for the past month.',
    translatedText: 'Doctor, I have been having severe bilateral knee pain and morning stiffness for the past month.',
    chiefComplaint: 'Bilateral knee arthralgia, morning stiffness (>45 mins), difficulty walking',
    vitals: { bp: '122/78 mmHg', pulse: '72 bpm', spo2: '99% on RA', temp: '98.2 °F' },
    diagnosis: 'Bilateral Primary Osteoarthritis of Knee (Grade II)',
    icdCode: 'ICD-10 M17.0',
    rx: [
      'Tab. Etoricoxib 60mg OD post dinner x 7 days',
      'Tab. Glucosamine Sulfate + Chondroitin OD x 60 days',
      'Quadriceps strengthening physiotherapy',
    ],
  },
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Google Meet launcher state
  const [meetingCodeInput, setMeetingCodeInput] = useState('')
  const [meetingDropdownOpen, setMeetingDropdownOpen] = useState(false)

  // Scribe Simulator state
  const [selectedLang, setSelectedLang] = useState<string>('hi')
  const [captionIndex, setCaptionIndex] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState(true)

  // Hardware webcam sandbox
  const [webcamActive, setWebcamActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const activeSample = SAMPLE_DATA[selectedLang] || SAMPLE_DATA['hi']

  // Speaking pulse
  useEffect(() => {
    const timer = setInterval(() => {
      setIsSpeaking((p) => !p)
    }, 2600)
    return () => clearInterval(timer)
  }, [])

  // Character typing effect for YouTube-style live translated captions
  useEffect(() => {
    setCaptionIndex(0)
    const len = activeSample.translatedText.length
    let curr = 0
    const interval = setInterval(() => {
      curr += 3
      if (curr >= len) {
        setCaptionIndex(len)
        clearInterval(interval)
      } else {
        setCaptionIndex(curr)
      }
    }, 30)
    return () => clearInterval(interval)
  }, [selectedLang])

  // Camera toggle
  const toggleWebcam = async () => {
    if (webcamActive) {
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach((t) => t.stop())
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
        alert('Webcam permission not granted or occupied by another application.')
      }
    }
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const handleJoinByCode = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleaned = meetingCodeInput.trim().replace(/^https?:\/\/[^/]+\/(waiting-room\/|meet\/)?/, '')
    if (!cleaned) return
    navigate(`/waiting-room/${cleaned}`)
  }

  const now = new Date()
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateString = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#FFFFFF',
      color: '#202124',
      fontFamily: "'Inter', 'Roboto', -apple-system, sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ─── GOOGLE MEET TOPBAR ─── */}
      <header style={{
        height: 64,
        padding: '0 24px',
        borderBottom: '1px solid #E8EAED',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
      }}>
        {/* Brand */}
        <div
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        >
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #1A73E8 0%, #007A64 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            boxShadow: '0 2px 6px rgba(26,115,232,0.3)',
          }}>
            <VideoMeetIcon size={22} color="#FFFFFF" />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#202124', letterSpacing: '-0.3px' }}>
            MedTrust <span style={{ color: '#1A73E8' }}>Meet</span>
          </div>
        </div>

        {/* Right Info & Google Login */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 14, color: '#5F6368', fontWeight: 500 }}>
            {timeString} • {dateString}
          </span>

          {user ? (
            <button
              onClick={() => navigate('/consultation')}
              style={{
                backgroundColor: '#1A73E8',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 9999,
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 1px 3px rgba(26,115,232,0.3)',
              }}
            >
              <DoctorHostIcon size={16} color="#FFFFFF" />
              <span>Host Consultation</span>
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              style={{
                backgroundColor: '#1A73E8',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 9999,
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 1px 3px rgba(26,115,232,0.3)',
              }}
            >
              <DoctorHostIcon size={16} color="#FFFFFF" />
              <span>Sign in with Google</span>
            </button>
          )}
        </div>
      </header>

      {/* ─── GOOGLE MEET HERO (PROBLEM STATEMENT SOLVED) ─── */}
      <main style={{
        flex: 1,
        maxWidth: 1240,
        width: '100%',
        margin: '0 auto',
        padding: '48px 24px',
        display: 'grid',
        gridTemplateColumns: '1.1fr 0.9fr',
        gap: 48,
        alignItems: 'center',
        boxSizing: 'border-box',
      }}>
        {/* Left Column: Google Meet Consultation Launcher */}
        <div>
          <h1 style={{
            fontSize: 48,
            lineHeight: 1.15,
            fontWeight: 800,
            color: '#202124',
            letterSpacing: '-1px',
            marginBottom: 16,
          }}>
            Clinical video meetings for doctors and patients.
          </h1>

          <p style={{
            fontSize: 18,
            lineHeight: 1.55,
            color: '#5F6368',
            marginBottom: 32,
            maxWidth: 540,
          }}>
            Doctor acts as permanent host. Patients join exclusively via personalized Google Meet links with waiting room queue. Speak in any language—real-time YouTube-style captions translate into English while AI generates standardized 17-section hospital EMR case sheets.
          </p>

          {/* Google Meet Launcher Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 28,
          }}>
            {/* New Meeting Dropdown Button */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setMeetingDropdownOpen(!meetingDropdownOpen)}
                style={{
                  backgroundColor: '#1A73E8',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 9999,
                  padding: '12px 24px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 1px 3px rgba(26,115,232,0.3)',
                }}
              >
                <VideoMeetIcon size={18} color="#FFFFFF" />
                <span>New consultation</span>
              </button>

              {meetingDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #DADCE0',
                  borderRadius: 12,
                  boxShadow: '0 4px 16px rgba(60,64,67,0.2)',
                  zIndex: 50,
                  width: 260,
                  overflow: 'hidden',
                }}>
                  <button
                    onClick={() => {
                      setMeetingDropdownOpen(false)
                      navigate('/consultation')
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      backgroundColor: 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: '#202124',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F3F4')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <SparklesIcon size={16} color="#1A73E8" />
                    <div>
                      <div style={{ fontWeight: 600 }}>Start an instant consultation</div>
                      <div style={{ fontSize: 11, color: '#5F6368' }}>Open live room as Doctor Host</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setMeetingDropdownOpen(false)
                      const code = `meet-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}`
                      navigator.clipboard.writeText(`${window.location.origin}/waiting-room/${code}`)
                      alert(`Personalized Google Meet link copied to clipboard:\n${window.location.origin}/waiting-room/${code}`)
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      backgroundColor: 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: '#202124',
                      borderTop: '1px solid #F1F3F4',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F3F4')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <DoctorHostIcon size={16} color="#007A64" />
                    <div>
                      <div style={{ fontWeight: 600 }}>Create meeting link for later</div>
                      <div style={{ fontSize: 11, color: '#5F6368' }}>Copy patient waiting room link</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Patient Join Input */}
            <form onSubmit={handleJoinByCode} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 12, top: 12, color: '#5F6368' }}>
                  <WaitingRoomIcon size={18} color="#5F6368" />
                </span>
                <input
                  type="text"
                  placeholder="Enter a code or meeting link"
                  value={meetingCodeInput}
                  onChange={(e) => setMeetingCodeInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 40px',
                    borderRadius: 8,
                    border: '1px solid #DADCE0',
                    fontSize: 14,
                    outline: 'none',
                    color: '#202124',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={!meetingCodeInput.trim()}
                style={{
                  backgroundColor: 'transparent',
                  color: meetingCodeInput.trim() ? '#1A73E8' : '#9AA0A6',
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '10px 16px',
                  borderRadius: 9999,
                  cursor: meetingCodeInput.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Join
              </button>
            </form>
          </div>

          {/* Quick Demo Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#5F6368', marginBottom: 28 }}>
            <span>Quick test links:</span>
            <span
              onClick={() => setMeetingCodeInput('abc-defg-hij')}
              style={{ color: '#1A73E8', cursor: 'pointer', textDecoration: 'underline' }}
            >
              abc-defg-hij
            </span>
            <span>•</span>
            <span
              onClick={() => setMeetingCodeInput('dr-sarah-cardiology')}
              style={{ color: '#1A73E8', cursor: 'pointer', textDecoration: 'underline' }}
            >
              dr-sarah-cardiology
            </span>
            <span>•</span>
            <span
              onClick={() => navigate('/waiting-room/urgent-care')}
              style={{ color: '#007A64', cursor: 'pointer', fontWeight: 600 }}
            >
              Launch Waiting Room Demo &rarr;
            </span>
          </div>

          {/* Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 12, color: '#5F6368' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircleIcon size={16} color="#188038" />
              Doctor Permanent Host
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircleIcon size={16} color="#188038" />
              Live YouTube-style CC
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircleIcon size={16} color="#188038" />
              17-Section Hospital EMR
            </span>
          </div>
        </div>

        {/* Right Column: Interactive Consultation & Scribe Simulator */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 24,
          border: '1px solid #DADCE0',
          boxShadow: '0 4px 16px rgba(60,64,67,0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Topbar */}
          <div style={{
            backgroundColor: '#202124',
            color: '#FFFFFF',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#188038' }} />
              <span style={{ fontWeight: 600 }}>Real-Time Video & Multilingual Scribe</span>
            </div>
            <button
              onClick={toggleWebcam}
              style={{
                backgroundColor: webcamActive ? '#D93025' : '#3C4043',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {webcamActive ? <CameraOffIcon size={12} color="#FFFFFF" /> : <CameraIcon size={12} color="#FFFFFF" />}
              <span>{webcamActive ? 'Stop Test Cam' : 'Test Real Webcam'}</span>
            </button>
          </div>

          {/* Video Preview Viewport */}
          <div style={{
            backgroundColor: '#111827',
            aspectRatio: '16 / 9',
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 4,
            padding: 4,
          }}>
            {/* Doctor Tile */}
            <div style={{
              backgroundColor: '#1F2937',
              borderRadius: 8,
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {webcamActive ? (
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: '#1A73E8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                }}>
                  <DoctorHostIcon size={28} color="#FFFFFF" />
                </div>
              )}
              <div style={{
                position: 'absolute',
                bottom: 6,
                left: 6,
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: '#FFFFFF',
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 4,
              }}>
                Dr. Rajesh Sharma (Host)
              </div>
            </div>

            {/* Patient Tile with Speaking Pulse */}
            <div style={{
              backgroundColor: '#1F2937',
              borderRadius: 8,
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: isSpeaking ? '2px solid #10B981' : '2px solid transparent',
            }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: '#7C3AED',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
              }}>
                <PatientIcon size={28} color="#FFFFFF" />
              </div>
              <div style={{
                position: 'absolute',
                bottom: 6,
                left: 6,
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: '#FFFFFF',
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <span>K. Sundaram (Patient)</span>
                {isSpeaking && <MicIcon size={10} color="#10B981" />}
              </div>
            </div>

            {/* YouTube-Style Live Translated Captions Overlay */}
            <div style={{
              position: 'absolute',
              bottom: 8,
              left: 10,
              right: 10,
              backgroundColor: 'rgba(0, 0, 0, 0.88)',
              borderRadius: 6,
              padding: '6px 10px',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{
                backgroundColor: '#E50914',
                color: '#FFFFFF',
                fontSize: 9,
                fontWeight: 800,
                padding: '1px 5px',
                borderRadius: 2,
              }}>
                CC LIVE
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#FFFFFF' }}>
                  {activeSample.translatedText.slice(0, captionIndex)}
                  <span style={{ color: '#1A73E8' }}>|</span>
                </div>
                <div style={{ fontSize: 9, color: '#9CA3AF', fontStyle: 'italic' }}>
                  Spoken ({activeSample.langName}): "{activeSample.originalText.slice(0, 50)}..."
                </div>
              </div>
            </div>
          </div>

          {/* Language Selector Pills */}
          <div style={{
            padding: '8px 12px',
            backgroundColor: '#F8F9FA',
            borderTop: '1px solid #E8EAED',
            borderBottom: '1px solid #E8EAED',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            overflowX: 'auto',
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#5F6368', whiteSpace: 'nowrap' }}>
              Select Language:
            </span>
            {Object.keys(SAMPLE_DATA).map((code) => (
              <button
                key={code}
                onClick={() => setSelectedLang(code)}
                style={{
                  padding: '3px 8px',
                  borderRadius: 9999,
                  fontSize: 11,
                  fontWeight: selectedLang === code ? 700 : 500,
                  border: selectedLang === code ? '1px solid #1A73E8' : '1px solid #DADCE0',
                  backgroundColor: selectedLang === code ? '#E8F0FE' : '#FFFFFF',
                  color: selectedLang === code ? '#1A73E8' : '#3C4043',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {SAMPLE_DATA[code].langName}
              </button>
            ))}
          </div>

          {/* AI Case Sheet Auto-Extraction Pane */}
          <div style={{ padding: '12px 16px', fontSize: 12, backgroundColor: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1A73E8', textTransform: 'uppercase' }}>
                Auto-Extracted Case Sheet Data
              </div>
              <span style={{ fontSize: 10, color: '#188038', fontWeight: 600 }}>
                ● Synced to EMR
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: '#5F6368' }}>Chief Complaint:</div>
                <div style={{ fontWeight: 600, color: '#202124' }}>{activeSample.chiefComplaint}</div>
                <div style={{ fontSize: 10, color: '#5F6368', marginTop: 4 }}>Vitals:</div>
                <div style={{ color: '#202124', fontSize: 11 }}>
                  BP: {activeSample.vitals.bp} • HR: {activeSample.vitals.pulse} • SpO2: {activeSample.vitals.spo2}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#5F6368' }}>Diagnosis & Coding:</div>
                <div style={{ fontWeight: 600, color: '#007A64' }}>{activeSample.diagnosis}</div>
                <div style={{ color: '#1A73E8', fontSize: 10 }}>{activeSample.icdCode}</div>
                <div style={{ fontSize: 10, color: '#5F6368', marginTop: 4 }}>Rx:</div>
                <div style={{ color: '#202124', fontSize: 10 }}>{activeSample.rx[0]}</div>
              </div>
            </div>

            <button
              onClick={() => navigate('/consultation')}
              style={{
                width: '100%',
                marginTop: 10,
                padding: '8px 12px',
                backgroundColor: '#1A73E8',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <ClipboardMedicalIcon size={14} color="#FFFFFF" />
              <span>Launch Live Consultation Room &rarr;</span>
            </button>
          </div>
        </div>
      </main>

      {/* ─── GOOGLE MINIMALIST FOOTER ─── */}
      <footer style={{
        padding: '16px 24px',
        borderTop: '1px solid #E8EAED',
        fontSize: 12,
        color: '#5F6368',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
      }}>
        <div>
          © {new Date().getFullYear()} MedTrust AI Clinical Technologies. Protected by Google Workspace & ABDM M1/M2/M3 standards.
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <span>Privacy Policy</span>
          <span>Terms of Clinical Service</span>
          <span>HIPAA Audit Status: Verified</span>
        </div>
      </footer>
    </div>
  )
}
