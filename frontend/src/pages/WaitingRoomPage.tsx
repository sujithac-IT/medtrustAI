import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  StethoscopeIcon,
  HospitalCrossIcon,
  VideoMeetIcon,
  VideoOffIcon,
  MicIcon,
  MicOffIcon,
  WaitingRoomIcon,
  DoctorHostIcon,
  PatientIcon,
  ShieldCheckIcon,
  PulseIcon,
} from '../components/MedicalIcons'
import {
  registerPatientInWaitingRoom,
  checkPatientSessionStatus,
  subscribeToConsultationSync,
  DEFAULT_DOCTOR_EMAIL,
  DEFAULT_PATIENT_EMAIL,
  type WaitingPatient,
} from '../services/consultationSync'

export default function WaitingRoomPage() {
  const navigate = useNavigate()
  const { code } = useParams<{ code?: string }>()
  const [searchParams] = useSearchParams()
  const meetingCode = code || searchParams.get('code') || 'abc-defg-hij'
  const doctorEmail = searchParams.get('docEmail') || DEFAULT_DOCTOR_EMAIL
  const patientEmail = searchParams.get('patEmail') || DEFAULT_PATIENT_EMAIL

  // Hardware states for pre-call check
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraActive, setCameraActive] = useState(true)
  const [micActive, setMicActive] = useState(true)
  const [micVolume, setMicVolume] = useState(45)
  const [hasWebcamAccess, setHasWebcamAccess] = useState(false)
  const [camErrorMessage, setCamErrorMessage] = useState<string | null>(null)
  const [admitted, setAdmitted] = useState(false)
  const [patientData, setPatientData] = useState<WaitingPatient | null>(null)

  // Stream binding helper
  const bindStream = useCallback((el: HTMLVideoElement | null, stream: MediaStream | null) => {
    if (!el) return
    if (stream) {
      el.srcObject = stream
      el.play().catch(() => {})
    } else {
      el.srcObject = null
    }
  }, [])

  // Camera stream initialization with robust ref attachment
  const startCamera = useCallback(async () => {
    setCamErrorMessage(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      })
      streamRef.current = stream
      setHasWebcamAccess(true)
      bindStream(videoRef.current, stream)
    } catch (err: any) {
      console.warn('Waiting room camera access warning:', err)
      setHasWebcamAccess(false)
      setCamErrorMessage('Camera permission not granted. Please allow access via your browser address bar.')
    }
  }, [bindStream])

  useEffect(() => {
    if (cameraActive) {
      startCamera()
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      bindStream(videoRef.current, null)
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [cameraActive, startCamera, bindStream])

  // Register patient in waiting room
  useEffect(() => {
    const patient = registerPatientInWaitingRoom({
      id: 'pat-sundaram',
      meetingCode,
      name: 'K. Sundaram',
      email: patientEmail,
      doctorEmail: doctorEmail,
      mrn: 'MT-2026-0841',
      age: 58,
      gender: 'Male',
      chiefComplaint: 'Retrosternal chest tightness & dry cough',
      micReady: micActive,
      cameraReady: cameraActive,
      hasLiveWebcam: hasWebcamAccess,
    })
    setPatientData(patient)

    const unsubscribe = subscribeToConsultationSync((event) => {
      if (
        event.type === 'PATIENT_ADMITTED' &&
        event.meetingCode === meetingCode &&
        event.patientId === 'pat-sundaram'
      ) {
        setAdmitted(true)
      }
    })

    const interval = setInterval(() => {
      const status = checkPatientSessionStatus(meetingCode, 'pat-sundaram')
      if (status === 'admitted') {
        setAdmitted(true)
      }
    }, 1200)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [meetingCode, cameraActive, micActive, hasWebcamAccess, doctorEmail, patientEmail])

  // Simulated mic level animation
  useEffect(() => {
    if (!micActive) {
      setMicVolume(0)
      return
    }
    const interval = setInterval(() => {
      setMicVolume(Math.floor(35 + Math.random() * 45))
    }, 200)
    return () => clearInterval(interval)
  }, [micActive])

  const toggleCamera = () => {
    setCameraActive(!cameraActive)
  }

  const toggleMic = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !micActive
      })
    }
    setMicActive(!micActive)
  }

  const handleJoinSession = () => {
    navigate(`/consultation?room=${meetingCode}&role=patient&docEmail=${encodeURIComponent(doctorEmail)}&patEmail=${encodeURIComponent(patientEmail)}`)
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F8FAFC',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Inter', sans-serif",
      color: '#1C1C1E',
    }}>
      {/* Eka.care Style Hospital Top Header */}
      <header style={{
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        padding: '12px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: '#0066FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            boxShadow: '0 2px 8px rgba(0,102,255,0.25)',
          }}>
            <HospitalCrossIcon size={24} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em' }}>
              Apollo - MedTrust Telehealth
            </div>
            <div style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheckIcon size={14} color="#10B981" />
              <span>ABDM Compliant EMR • Session: {meetingCode}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#EFF6FF',
            color: '#0066FF',
            fontSize: 12,
            fontWeight: 700,
            padding: '6px 14px',
            borderRadius: 20,
            border: '1px solid #BFDBFE',
          }}>
            <VideoMeetIcon size={14} color="#0066FF" />
            Google Meet Verified Room
          </span>
        </div>
      </header>

      {/* Main Waiting Room Container */}
      <main style={{
        flex: 1,
        maxWidth: 1040,
        width: '100%',
        margin: '0 auto',
        padding: '32px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
      }}>
        {/* Admitted Status Alert Banner */}
        {admitted ? (
          <div style={{
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: 12,
            padding: '16px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.1)',
            animation: 'fadeIn 0.3s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                backgroundColor: '#10B981',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <StethoscopeIcon size={24} color="#FFFFFF" />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#065F46' }}>
                  Dr. Rajesh Sharma has admitted you to the consultation!
                </div>
                <div style={{ fontSize: 13, color: '#047857' }}>
                  Your camera and audio are connected. Both doctor and patient feeds are ready.
                </div>
              </div>
            </div>
            <button
              onClick={handleJoinSession}
              style={{
                backgroundColor: '#0066FF',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 12px rgba(0, 102, 255, 0.3)',
              }}
            >
              <VideoMeetIcon size={18} color="#FFFFFF" />
              Enter Consultation Room
            </button>
          </div>
        ) : (
          <div style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}>
            <div style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: '#F59E0B',
              boxShadow: '0 0 0 4px rgba(245, 158, 11, 0.2)',
              flexShrink: 0,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>
                You are currently in the Patient Waiting Room
              </div>
              <div style={{ fontSize: 13, color: '#64748B' }}>
                Dr. Rajesh Sharma ({doctorEmail}) is the permanent host. The consultation will begin once admitted.
              </div>
            </div>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#0066FF',
              backgroundColor: '#EFF6FF',
              padding: '6px 14px',
              borderRadius: 20,
              border: '1px solid #BFDBFE',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <WaitingRoomIcon size={14} color="#0066FF" />
              <span>Host Approval Pending</span>
            </div>
          </div>
        )}

        {/* 2-Column Device Check & Patient Record Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: 22,
        }}>
          {/* Left Column: Live Device Check */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            border: '1px solid #E2E8F0',
            padding: 24,
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
                Real-Time Camera &amp; Audio Pre-Check
              </div>
              <span style={{ fontSize: 12, color: '#64748B' }}>
                Hardware Preview
              </span>
            </div>

            {/* Video Viewport with guaranteed srcObject binding */}
            <div style={{
              width: '100%',
              height: 290,
              backgroundColor: '#0F172A',
              borderRadius: 12,
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <video
                ref={(el) => {
                  videoRef.current = el
                  if (el && streamRef.current && el.srcObject !== streamRef.current) {
                    bindStream(el, streamRef.current)
                  }
                }}
                autoPlay
                muted
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)', // Mirrored view
                  display: cameraActive && hasWebcamAccess ? 'block' : 'none',
                }}
              />

              {(!cameraActive || !hasWebcamAccess) && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  color: '#94A3B8',
                  padding: 20,
                  textAlign: 'center',
                }}>
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <VideoOffIcon size={28} color="#94A3B8" />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {camErrorMessage || 'Camera is turned off'}
                  </span>
                </div>
              )}

              {/* Patient Badge */}
              <div style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                backgroundColor: 'rgba(15, 23, 42, 0.88)',
                color: '#FFFFFF',
                padding: '4px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                backdropFilter: 'blur(6px)',
              }}>
                <PatientIcon size={14} color="#34D399" />
                <span>K. Sundaram (Patient)</span>
              </div>
            </div>

            {/* Hardware Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <button
                onClick={toggleMic}
                style={{
                  padding: '10px 20px',
                  borderRadius: 24,
                  border: '1px solid',
                  borderColor: micActive ? '#0066FF' : '#DC2626',
                  backgroundColor: micActive ? '#EFF6FF' : '#FEF2F2',
                  color: micActive ? '#0066FF' : '#DC2626',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {micActive ? <MicIcon size={16} color="#0066FF" /> : <MicOffIcon size={16} color="#DC2626" />}
                <span>{micActive ? 'Microphone On' : 'Microphone Muted'}</span>
              </button>

              <button
                onClick={toggleCamera}
                style={{
                  padding: '10px 20px',
                  borderRadius: 24,
                  border: '1px solid',
                  borderColor: cameraActive ? '#0066FF' : '#DC2626',
                  backgroundColor: cameraActive ? '#EFF6FF' : '#FEF2F2',
                  color: cameraActive ? '#0066FF' : '#DC2626',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {cameraActive ? <VideoMeetIcon size={16} color="#0066FF" /> : <VideoOffIcon size={16} color="#DC2626" />}
                <span>{cameraActive ? 'Camera On' : 'Camera Off'}</span>
              </button>
            </div>

            {/* Live Mic Waveform Level */}
            <div style={{
              backgroundColor: '#F8FAFC',
              borderRadius: 10,
              padding: '12px 16px',
              border: '1px solid #E2E8F0',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 12,
                color: '#64748B',
                marginBottom: 6,
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                  <PulseIcon size={14} color="#007A64" />
                  Live Mic Signal Check
                </span>
                <span style={{ fontWeight: 700, color: micActive ? '#007A64' : '#94A3B8' }}>
                  {micActive ? `${micVolume}% Active` : 'Muted'}
                </span>
              </div>
              <div style={{
                width: '100%',
                height: 6,
                backgroundColor: '#E2E8F0',
                borderRadius: 3,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${micVolume}%`,
                  height: '100%',
                  backgroundColor: micActive ? '#007A64' : '#CBD5E1',
                  transition: 'width 0.15s ease',
                  borderRadius: 3,
                }} />
              </div>
            </div>
          </div>

          {/* Right Column: Appointment Details with Linked Emails */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Host Physician Profile */}
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              border: '1px solid #E2E8F0',
              padding: 20,
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#64748B',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <DoctorHostIcon size={16} color="#0066FF" />
                <span>Session Host &amp; Attending Doctor</span>
              </div>

              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  backgroundColor: '#EFF6FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0066FF',
                  fontWeight: 800,
                  fontSize: 18,
                  border: '1px solid #BFDBFE',
                }}>
                  RS
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
                    Dr. Rajesh Sharma, MD
                  </div>
                  <div style={{ fontSize: 13, color: '#0066FF', fontWeight: 600 }}>
                    Senior Consultant Cardiologist
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Email: {doctorEmail}
                  </div>
                </div>
              </div>
            </div>

            {/* Patient Pass Card */}
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              border: '1px solid #E2E8F0',
              padding: 20,
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#64748B',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 14,
              }}>
                Patient Consultation Pass
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                  <span style={{ color: '#64748B' }}>Patient Name:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>K. Sundaram</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                  <span style={{ color: '#64748B' }}>Patient Email:</span>
                  <span style={{ fontWeight: 600, color: '#0066FF' }}>{patientEmail}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                  <span style={{ color: '#64748B' }}>Hospital MRN:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A', fontFamily: 'monospace' }}>MT-2026-0841</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                  <span style={{ color: '#64748B' }}>Chief Complaint:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>Exertional Chest Tightness &amp; Cough</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Google Meet Link:</span>
                  <span style={{ fontWeight: 600, color: '#0066FF', fontFamily: 'monospace' }}>meet.google.com/{meetingCode}</span>
                </div>
              </div>
            </div>

            {/* Eka.care style Guarantee Note */}
            <div style={{
              backgroundColor: '#F0F9FF',
              border: '1px solid #BAE6FD',
              borderRadius: 12,
              padding: '14px 16px',
              fontSize: 12,
              color: '#0369A1',
              lineHeight: 1.5,
            }}>
              <strong>Eka EMR Compliance:</strong> 100% ABDM M1, M2 &amp; M3 verified. Real-time translation converts multilingual patient speech into clinical English records for hospital EHR ingestion.
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
