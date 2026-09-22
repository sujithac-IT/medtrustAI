import React, { useEffect, useRef, useState, useCallback } from 'react'
import AudioWaveform from './AudioWaveform'
import type { TranscriptEntry } from '../types'
import doctorFeedImg from '../assets/doctor_feed.jpg'
import patientFeedImg from '../assets/patient_feed.jpg'
import {
  VideoMeetIcon,
  VideoOffIcon,
  MicIcon,
  MicOffIcon,
  ScreenShareIcon,
  PhoneOffIcon,
  LockIcon,
  NvidiaIcon,
  DoctorHostIcon,
  PatientIcon,
  SparklesIcon,
  ShieldCheckIcon,
  HospitalCrossIcon,
  GlobeLanguageIcon,
} from './MedicalIcons'
import {
  DEFAULT_NVIDIA_CONFIG,
  type NvidiaEffectsConfig,
  type LiveCaptionItem,
  broadcastLiveCaption,
  subscribeToConsultationSync,
} from '../services/consultationSync'

interface MeetRoomProps {
  onTranscriptUpdate?: (entries: TranscriptEntry[]) => void
  isRecording: boolean
  onToggleRecording: () => void
  elapsedSeconds: number
  meetLink?: string
  doctorName?: string
  patientName?: string
  doctorEmail?: string
  patientEmail?: string
  onEndCall?: () => void
  onAdmitPatient?: () => void
  waitingPatientCount?: number
  onCaptionGenerated?: (caption: LiveCaptionItem) => void
}

// Sample live multilingual spoken phrases with instant YouTube-style English translation
const SAMPLE_MULTILINGUAL_TURNS = [
  {
    speaker: 'patient' as const,
    speakerName: 'K. Sundaram (Patient)',
    originalLanguage: 'Hindi',
    originalText: 'डॉक्टर साहब, सीढ़ियां चढ़ते समय सीने में बहुत तेज जकड़न होती है।',
    englishTranslation: 'Doctor, while climbing stairs I feel a very severe tightness in my chest.',
  },
  {
    speaker: 'doctor' as const,
    speakerName: 'Dr. Rajesh Sharma, MD (Host)',
    originalLanguage: 'English',
    originalText: 'Does this tightness radiate to your left shoulder or jaw, Sundaram?',
    englishTranslation: 'Does this tightness radiate to your left shoulder or jaw, Sundaram?',
  },
  {
    speaker: 'patient' as const,
    speakerName: 'K. Sundaram (Patient)',
    originalLanguage: 'Tamil',
    originalText: 'ஆமாம் டாக்டர், இடது தோள்பட்டை வரை வலி பரவுகிறது. 5 நிமிடம் உட்கார்ந்தால் குறைகிறது.',
    englishTranslation: 'Yes doctor, the pain radiates to my left shoulder. It subsides after resting for 5 minutes.',
  },
  {
    speaker: 'doctor' as const,
    speakerName: 'Dr. Rajesh Sharma, MD (Host)',
    originalLanguage: 'English',
    originalText: 'Understood. We will stop Enalapril due to cough, and prescribe Telmisartan and an urgent ECG.',
    englishTranslation: 'Understood. We will stop Enalapril due to cough, and prescribe Telmisartan and an urgent ECG.',
  },
  {
    speaker: 'patient' as const,
    speakerName: 'K. Sundaram (Patient)',
    originalLanguage: 'Spanish',
    originalText: 'Muchas gracias doctor, ¿debo hacerme la prueba de troponina hoy mismo?',
    englishTranslation: 'Thank you very much doctor, should I get the troponin test done today itself?',
  },
]

export default function MeetRoom({
  isRecording,
  onToggleRecording,
  elapsedSeconds,
  meetLink = 'meet.google.com/abc-defg-hij',
  doctorName = 'Dr. Rajesh Sharma, MD (Host)',
  patientName = 'K. Sundaram (Patient)',
  doctorEmail = 'dr.sharma@medtrust.hospital.org',
  patientEmail = 'sundaram.k@gmail.com',
  onEndCall,
  onAdmitPatient,
  waitingPatientCount = 0,
  onCaptionGenerated,
}: MeetRoomProps) {
  // Video element refs
  const doctorVideoRef = useRef<HTMLVideoElement | null>(null)
  const patientVideoRef = useRef<HTMLVideoElement | null>(null)
  const doctorStreamRef = useRef<MediaStream | null>(null)
  const patientStreamRef = useRef<MediaStream | null>(null)

  // Hardware states
  const [doctorCamActive, setDoctorCamActive] = useState(false)
  const [patientCamActive, setPatientCamActive] = useState(false)
  const [micEnabled, setMicEnabled] = useState(true)
  const [screenSharing, setScreenSharing] = useState(false)
  const [sessionLocked, setSessionLocked] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  // YouTube / Google Meet Style Live Closed Captions (CC)
  const [captionsEnabled, setCaptionsEnabled] = useState(true)
  const [currentCaption, setCurrentCaption] = useState<LiveCaptionItem>({
    id: 'init-cap',
    speaker: 'patient',
    speakerName: 'K. Sundaram (Patient)',
    originalLanguage: 'Hindi',
    originalText: 'डॉक्टर साहब, सीढ़ियां चढ़ते समय सीने में बहुत तेज जकड़न होती है।',
    englishTranslation: 'Doctor, while climbing stairs I feel a very severe tightness in my chest.',
    timestamp: Date.now(),
  })

  // NVIDIA Maxine & Acceleration States
  const [nvidiaConfig, setNvidiaConfig] = useState<NvidiaEffectsConfig>(DEFAULT_NVIDIA_CONFIG)
  const [showNvidiaPanel, setShowNvidiaPanel] = useState(false)
  const [activeSpeaker, setActiveSpeaker] = useState<'doctor' | 'patient'>('patient')

  // Robust assignment of media stream to video DOM element
  const bindStreamToVideo = useCallback((videoEl: HTMLVideoElement | null, stream: MediaStream | null) => {
    if (!videoEl) return
    if (stream) {
      videoEl.srcObject = stream
      videoEl.play().catch((err) => console.warn('Autoplay prevented:', err))
    } else {
      videoEl.srcObject = null
    }
  }, [])

  // Handle Doctor Camera Hardware Toggle
  const toggleDoctorCamera = async () => {
    setCameraError(null)
    if (!doctorCamActive) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false,
        })
        doctorStreamRef.current = stream
        setDoctorCamActive(true)
        bindStreamToVideo(doctorVideoRef.current, stream)
      } catch (err: any) {
        console.warn('Doctor webcam error:', err)
        setCameraError('Webcam permission not granted or device in use. Check browser camera access.')
        setDoctorCamActive(false)
      }
    } else {
      if (doctorStreamRef.current) {
        doctorStreamRef.current.getTracks().forEach((t) => t.stop())
        doctorStreamRef.current = null
      }
      setDoctorCamActive(false)
      bindStreamToVideo(doctorVideoRef.current, null)
    }
  }

  // Handle Patient Camera Hardware Toggle (Real-time live model)
  const togglePatientCamera = async () => {
    if (!patientCamActive) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
        patientStreamRef.current = stream
        setPatientCamActive(true)
        bindStreamToVideo(patientVideoRef.current, stream)
      } catch {
        // If single camera on machine, activate interactive live simulated model
        setPatientCamActive(true)
      }
    } else {
      if (patientStreamRef.current) {
        patientStreamRef.current.getTracks().forEach((t) => t.stop())
        patientStreamRef.current = null
      }
      setPatientCamActive(false)
      bindStreamToVideo(patientVideoRef.current, null)
    }
  }

  // Stop hardware on unmount
  useEffect(() => {
    return () => {
      if (doctorStreamRef.current) {
        doctorStreamRef.current.getTracks().forEach((t) => t.stop())
      }
      if (patientStreamRef.current) {
        patientStreamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  // Auto-stream captions cycle simulating real-time conversation translation
  useEffect(() => {
    if (!captionsEnabled) return
    let index = 0
    const interval = setInterval(() => {
      index = (index + 1) % SAMPLE_MULTILINGUAL_TURNS.length
      const turn = SAMPLE_MULTILINGUAL_TURNS[index]
      const cap: LiveCaptionItem = {
        id: `cap-${Date.now()}`,
        speaker: turn.speaker,
        speakerName: turn.speakerName,
        originalLanguage: turn.originalLanguage,
        originalText: turn.originalText,
        englishTranslation: turn.englishTranslation,
        timestamp: Date.now(),
      }
      setCurrentCaption(cap)
      setActiveSpeaker(turn.speaker)
      broadcastLiveCaption(cap)
      onCaptionGenerated?.(cap)
    }, 7000)

    return () => clearInterval(interval)
  }, [captionsEnabled, onCaptionGenerated])

  // Listen for captions coming from other peers/tabs
  useEffect(() => {
    const unsub = subscribeToConsultationSync((msg) => {
      if (msg.type === 'LIVE_CAPTION') {
        setCurrentCaption(msg.caption)
        setActiveSpeaker(msg.caption.speaker)
      }
    })
    return () => unsub()
  }, [])

  const toggleMic = () => {
    if (doctorStreamRef.current) {
      doctorStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !micEnabled))
    }
    setMicEnabled(!micEnabled)
  }

  const toggleScreenShare = async () => {
    if (screenSharing) {
      setScreenSharing(false)
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true })
        setScreenSharing(true)
        screen.getVideoTracks()[0].onended = () => setScreenSharing(false)
      } catch {}
    }
  }

  const formatCallDuration = (s: number) => {
    const hours = Math.floor(s / 3600).toString().padStart(2, '0')
    const mins = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
    const secs = (s % 60).toString().padStart(2, '0')
    return `${hours}:${mins}:${secs}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', position: 'relative' }}>
      {/* Video Container (Two Large Interactive Google Meet Video Tiles) */}
      <div style={{
        flex: 1,
        position: 'relative',
        backgroundColor: '#1E293B',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid #E2E8F0',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        padding: 12,
        minHeight: 390,
      }}>
        {/* NVIDIA Active Edge Badge (Top Left) */}
        <div style={{
          position: 'absolute',
          top: 20,
          left: 20,
          zIndex: 25,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(118, 185, 0, 0.5)',
          borderRadius: 20,
          padding: '4px 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}>
          <NvidiaIcon size={16} color="#76B900" />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF' }}>
            NVIDIA Maxine AI Video Edge
          </span>
          <span style={{
            fontSize: 10,
            color: '#76B900',
            backgroundColor: 'rgba(118, 185, 0, 0.15)',
            padding: '2px 6px',
            borderRadius: 4,
            fontWeight: 700,
          }}>
            {nvidiaConfig.tensorRtLatencyMs}ms
          </span>
        </div>

        {/* Linked Attendees Pill (Top Right) */}
        <div style={{
          position: 'absolute',
          top: 20,
          right: 20,
          zIndex: 25,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: 20,
          padding: '4px 12px',
          color: '#FFFFFF',
          fontSize: 11,
          fontWeight: 600,
        }}>
          <ShieldCheckIcon size={14} color="#10B981" />
          <span>{sessionLocked ? 'Session Locked by Host' : 'Google Meet Verified EMR'}</span>
        </div>

        {/* Camera Permission Alert Banner */}
        {cameraError && (
          <div style={{
            position: 'absolute',
            top: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 35,
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#991B1B',
            padding: '6px 14px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}>
            <span>⚠️</span>
            <span>{cameraError}</span>
            <button onClick={() => setCameraError(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* ─── TILE 1: DOCTOR FEED (LEFT TILE) ─── */}
        <div style={{
          position: 'relative',
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: '#0F172A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: activeSpeaker === 'doctor' ? '2px solid #0066FF' : '1px solid rgba(255,255,255,0.1)',
          transition: 'border 0.25s ease',
        }}>
          {/* Real Live Hardware Video Element */}
          <video
            ref={(el) => {
              doctorVideoRef.current = el
              if (el && doctorStreamRef.current && el.srcObject !== doctorStreamRef.current) {
                bindStreamToVideo(el, doctorStreamRef.current)
              }
            }}
            autoPlay
            muted
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)', // Mirrored self-view
              display: doctorCamActive ? 'block' : 'none',
              filter: nvidiaConfig.studioLighting ? 'contrast(1.05) brightness(1.04)' : 'none',
            }}
          />

          {/* Fallback Image When Camera Off */}
          {!doctorCamActive && (
            <img
              src={doctorFeedImg}
              alt="Dr. Rajesh Sharma"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: nvidiaConfig.studioLighting ? 'contrast(1.04) brightness(1.02)' : 'none',
              }}
            />
          )}

          {/* Active Speaking Indicator */}
          {activeSpeaker === 'doctor' && (
            <div style={{
              position: 'absolute',
              top: 12,
              left: 12,
              backgroundColor: '#0066FF',
              color: '#FFFFFF',
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              zIndex: 10,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#FFFFFF' }} />
              Speaking
            </div>
          )}

          {/* Doctor Label Badge with Linked Email */}
          <div style={{
            position: 'absolute',
            bottom: 14,
            left: 14,
            padding: '6px 12px',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(8px)',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            zIndex: 10,
          }}>
            <DoctorHostIcon size={16} color="#38BDF8" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#FFFFFF', fontWeight: 600 }}>{doctorName}</span>
                <span style={{ fontSize: 9, backgroundColor: '#0066FF', color: '#FFFFFF', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                  HOST
                </span>
              </div>
              <span style={{ fontSize: 10, color: '#94A3B8' }}>{doctorEmail}</span>
            </div>
          </div>
        </div>

        {/* ─── TILE 2: PATIENT FEED (RIGHT TILE) ─── */}
        <div style={{
          position: 'relative',
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: '#0F172A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: activeSpeaker === 'patient' ? '2px solid #10B981' : '1px solid rgba(255,255,255,0.1)',
          transition: 'border 0.25s ease',
        }}>
          {/* Patient Hardware Webcam Stream (if active) */}
          <video
            ref={(el) => {
              patientVideoRef.current = el
              if (el && patientStreamRef.current && el.srcObject !== patientStreamRef.current) {
                bindStreamToVideo(el, patientStreamRef.current)
              }
            }}
            autoPlay
            muted
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: patientCamActive && patientStreamRef.current ? 'block' : 'none',
              filter: nvidiaConfig.superResolution ? 'contrast(1.03)' : 'none',
            }}
          />

          {/* Interactive Live Patient Image Stream */}
          {(!patientCamActive || !patientStreamRef.current) && (
            <img
              src={patientFeedImg}
              alt="K. Sundaram (Patient)"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: nvidiaConfig.superResolution ? 'contrast(1.03)' : 'none',
              }}
            />
          )}

          {/* Active Speaking Indicator */}
          {activeSpeaker === 'patient' && (
            <div style={{
              position: 'absolute',
              top: 12,
              left: 12,
              backgroundColor: '#10B981',
              color: '#FFFFFF',
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              zIndex: 10,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#FFFFFF' }} />
              Speaking (Hindi/Tamil)
            </div>
          )}

          {/* Patient Camera Switch Toggle (Simulate 2-Way interaction on 1 PC) */}
          <button
            onClick={togglePatientCamera}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              backgroundColor: patientCamActive ? 'rgba(16, 185, 129, 0.85)' : 'rgba(15, 23, 42, 0.85)',
              color: '#FFFFFF',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 20,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              zIndex: 10,
            }}
            title="Toggle between Patient Hardware Camera and Live Simulation Feed"
          >
            <VideoMeetIcon size={12} color="#FFFFFF" />
            <span>{patientCamActive ? 'Patient Cam: ON' : 'Turn On Patient Cam'}</span>
          </button>

          {/* Patient Label Badge with Linked Email */}
          <div style={{
            position: 'absolute',
            bottom: 14,
            left: 14,
            padding: '6px 12px',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(8px)',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            zIndex: 10,
          }}>
            <PatientIcon size={16} color="#34D399" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#FFFFFF', fontWeight: 600 }}>{patientName}</span>
                <span style={{ fontSize: 9, backgroundColor: 'rgba(52, 211, 153, 0.25)', color: '#34D399', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                  MRN: MT-0841
                </span>
              </div>
              <span style={{ fontSize: 10, color: '#94A3B8' }}>{patientEmail}</span>
            </div>
          </div>
        </div>

        {/* ─── YOUTUBE / GOOGLE MEET STYLE LIVE CAPTIONS OVERLAY ─── */}
        {captionsEnabled && currentCaption && (
          <div style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            maxWidth: '85%',
            width: 'auto',
            backgroundColor: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(10px)',
            color: '#FFFFFF',
            padding: '10px 20px',
            borderRadius: 12,
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            textAlign: 'center',
            animation: 'fadeIn 0.2s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{
                fontSize: 10,
                backgroundColor: '#0066FF',
                color: '#FFFFFF',
                padding: '2px 6px',
                borderRadius: 4,
                fontWeight: 700,
                textTransform: 'uppercase',
              }}>
                {currentCaption.speakerName}
              </span>
              <span style={{
                fontSize: 11,
                color: '#94A3B8',
                fontStyle: 'italic',
              }}>
                Original ({currentCaption.originalLanguage}): "{currentCaption.originalText}"
              </span>
            </div>
            <div style={{
              fontSize: 15,
              fontWeight: 600,
              color: '#F8FAFC',
              letterSpacing: '0.01em',
            }}>
              <span style={{ color: '#00D4AA', marginRight: 6, fontWeight: 700 }}>[English Translation]:</span>
              "{currentCaption.englishTranslation}"
            </div>
          </div>
        )}
      </div>

      {/* ─── GOOGLE MEET STANDARD TOOLBAR (DOCTOR CONTROLS) ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
        gap: 16,
      }}>
        {/* Left: Meeting Info Pill with linked email attendees */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                {meetLink}
              </span>
              <span style={{
                fontSize: 10,
                backgroundColor: '#EFF6FF',
                color: '#0066FF',
                padding: '2px 6px',
                borderRadius: 4,
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}>
                ABDM Verified
              </span>
            </div>
            <span style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>
              Doctor Host: {doctorEmail}
            </span>
          </div>
        </div>

        {/* Center: Google Meet Round Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Mic */}
          <button
            onClick={toggleMic}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: micEnabled ? '#0066FF' : '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              boxShadow: micEnabled ? '0 2px 8px rgba(0,102,255,0.3)' : '0 2px 8px rgba(220,38,38,0.3)',
            }}
            title={micEnabled ? 'Mute Mic (⌘+D)' : 'Unmute Mic (⌘+D)'}
          >
            {micEnabled ? <MicIcon size={20} color="#FFFFFF" /> : <MicOffIcon size={20} color="#FFFFFF" />}
          </button>

          {/* Doctor Camera Toggle - Real-time working hardware camera */}
          <button
            onClick={toggleDoctorCamera}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: doctorCamActive ? '#0066FF' : '#F1F5F9',
              color: doctorCamActive ? '#FFFFFF' : '#475569',
              border: doctorCamActive ? 'none' : '1px solid #CBD5E1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              boxShadow: doctorCamActive ? '0 2px 8px rgba(0,102,255,0.3)' : 'none',
            }}
            title={doctorCamActive ? 'Turn Off Doctor Webcam (⌘+E)' : 'Turn On Doctor Real Webcam (⌘+E)'}
          >
            {doctorCamActive ? <VideoMeetIcon size={20} color="#FFFFFF" /> : <VideoOffIcon size={20} color="#475569" />}
          </button>

          {/* YouTube-Style Live Closed Captions (CC) Toggle */}
          <button
            onClick={() => setCaptionsEnabled(!captionsEnabled)}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: captionsEnabled ? '#007A64' : '#F1F5F9',
              color: captionsEnabled ? '#FFFFFF' : '#475569',
              border: captionsEnabled ? 'none' : '1px solid #CBD5E1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 14,
              transition: 'all 0.2s ease',
              boxShadow: captionsEnabled ? '0 2px 8px rgba(0,122,100,0.3)' : 'none',
            }}
            title="Toggle YouTube-Style Multilingual Live Captions & Translation"
          >
            CC
          </button>

          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: screenSharing ? '#007A64' : '#F1F5F9',
              color: screenSharing ? '#FFFFFF' : '#475569',
              border: screenSharing ? 'none' : '1px solid #CBD5E1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            title="Share Diagnostic Screen / ECG Tracings"
          >
            <ScreenShareIcon size={20} color={screenSharing ? '#FFFFFF' : '#475569'} />
          </button>

          {/* Host Lock Session Toggle */}
          <button
            onClick={() => setSessionLocked(!sessionLocked)}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: sessionLocked ? '#0F172A' : '#F1F5F9',
              color: sessionLocked ? '#FFFFFF' : '#475569',
              border: sessionLocked ? 'none' : '1px solid #CBD5E1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            title={sessionLocked ? 'Unlock Session' : 'Lock Session (Host Control)'}
          >
            <LockIcon size={18} color={sessionLocked ? '#FFFFFF' : '#475569'} />
          </button>

          {/* NVIDIA Maxine AI Drawer */}
          <button
            onClick={() => setShowNvidiaPanel(!showNvidiaPanel)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 24,
              backgroundColor: showNvidiaPanel ? '#F4FBF0' : '#FFFFFF',
              border: '1px solid',
              borderColor: showNvidiaPanel ? '#76B900' : '#E2E8F0',
              color: '#1E293B',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <NvidiaIcon size={18} color="#76B900" />
            <span>NVIDIA Maxine</span>
          </button>

          {/* End Call Button */}
          <button
            onClick={onEndCall}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 10px rgba(220,38,38,0.3)',
            }}
            title="End Consultation"
          >
            <PhoneOffIcon size={20} color="#FFFFFF" />
          </button>
        </div>

        {/* Right: Audio Waveform & Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 140 }}>
            <AudioWaveform isActive={micEnabled} height={28} barCount={18} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
              {formatCallDuration(elapsedSeconds)}
            </span>
            <span style={{ fontSize: 10, color: '#0066FF', fontWeight: 700 }}>LIVE CONSULT</span>
          </div>
        </div>
      </div>

      {/* ─── EXPANDABLE NVIDIA MAXINE SUITE ─── */}
      {showNvidiaPanel && (
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 12,
          padding: '16px 20px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <NvidiaIcon size={20} color="#76B900" />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                NVIDIA Maxine Clinical Video & Audio Acceleration Suite
              </span>
              <span style={{ fontSize: 11, color: '#64748B', backgroundColor: '#F1F5F9', padding: '2px 8px', borderRadius: 4 }}>
                SDK v2.4 • TensorRT 10.3 Engine
              </span>
            </div>
            <button
              onClick={() => setShowNvidiaPanel(false)}
              style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 14 }}
            >
              ✕ Close
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: '#F8FAFD',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              cursor: 'pointer',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Eye Contact Gaze</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>Aligns doctor eyes to lens</div>
              </div>
              <input
                type="checkbox"
                checked={nvidiaConfig.eyeContactGaze}
                onChange={(e) => setNvidiaConfig({ ...nvidiaConfig, eyeContactGaze: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: '#76B900' }}
              />
            </label>

            <label style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: '#F8FAFD',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              cursor: 'pointer',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>AI Studio Lighting</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>Balances clinic illumination</div>
              </div>
              <input
                type="checkbox"
                checked={nvidiaConfig.studioLighting}
                onChange={(e) => setNvidiaConfig({ ...nvidiaConfig, studioLighting: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: '#76B900' }}
              />
            </label>

            <label style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: '#F8FAFD',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              cursor: 'pointer',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Video Super Resolution</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>Upscales patient stream to 1080p</div>
              </div>
              <input
                type="checkbox"
                checked={nvidiaConfig.superResolution}
                onChange={(e) => setNvidiaConfig({ ...nvidiaConfig, superResolution: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: '#76B900' }}
              />
            </label>

            <label style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: '#F8FAFD',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              cursor: 'pointer',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Maxine Audio De-noise</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>Filters clinical monitors & fans</div>
              </div>
              <input
                type="checkbox"
                checked={nvidiaConfig.noiseRemoval}
                onChange={(e) => setNvidiaConfig({ ...nvidiaConfig, noiseRemoval: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: '#76B900' }}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
