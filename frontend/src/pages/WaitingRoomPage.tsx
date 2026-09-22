import React, { useState, useEffect, useRef } from 'react'
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
  type WaitingPatient,
} from '../services/consultationSync'

export default function WaitingRoomPage() {
  const navigate = useNavigate()
  const { code } = useParams<{ code?: string }>()
  const [searchParams] = useSearchParams()
  const meetingCode = code || searchParams.get('code') || 'abc-defg-hij'

  // Hardware states for pre-call check
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraActive, setCameraActive] = useState(true)
  const [micActive, setMicActive] = useState(true)
  const [micVolume, setMicVolume] = useState(42)
  const [hasWebcamAccess, setHasWebcamAccess] = useState(false)
  const [admitted, setAdmitted] = useState(false)
  const [patientData, setPatientData] = useState<WaitingPatient | null>(null)

  // Register patient in waiting room
  useEffect(() => {
    const patient = registerPatientInWaitingRoom({
      id: 'pat-sundaram',
      meetingCode,
      name: 'K. Sundaram',
      mrn: 'MT-2026-0841',
      age: 58,
      gender: 'Male',
      chiefComplaint: 'Retrosternal chest tightness & dry cough',
      micReady: micActive,
      cameraReady: cameraActive,
    })
    setPatientData(patient)

    // Listen for doctor's "Admit Patient" signal
    const unsubscribe = subscribeToConsultationSync((event) => {
      if (
        event.type === 'PATIENT_ADMITTED' &&
        event.meetingCode === meetingCode &&
        event.patientId === 'pat-sundaram'
      ) {
        setAdmitted(true)
      }
    })

    // Fallback polling for multi-window sync
    const interval = setInterval(() => {
      const status = checkPatientSessionStatus(meetingCode, 'pat-sundaram')
      if (status === 'admitted') {
        setAdmitted(true)
      }
    }, 1500)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [meetingCode, cameraActive, micActive])

  // Camera stream initialization
  useEffect(() => {
    if (cameraActive) {
      navigator.mediaDevices?.getUserMedia({ video: true, audio: true })
        .then((stream) => {
          streamRef.current = stream
          setHasWebcamAccess(true)
          if (videoRef.current) {
            videoRef.current.srcObject = stream
          }
        })
        .catch(() => {
          setHasWebcamAccess(false)
        })
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [cameraActive])

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
    navigate(`/consultation?room=${meetingCode}&role=patient`)
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F8FAFD',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', 'Roboto', system-ui, sans-serif",
      color: '#1E293B',
    }}>
      {/* Hospital Top Navigation Header */}
      <header style={{
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        padding: '14px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: '#0B57D0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
          }}>
            <HospitalCrossIcon size={24} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em' }}>
              Apollo - MedTrust Telehealth
            </div>
            <div style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheckIcon size={14} color="#007A64" />
              <span>Encrypted Patient Session • Space: {meetingCode}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#EFF6FF',
            color: '#1D4ED8',
            fontSize: 12,
            fontWeight: 600,
            padding: '6px 14px',
            borderRadius: 20,
            border: '1px solid #BFDBFE',
          }}>
            <VideoMeetIcon size={14} color="#1D4ED8" />
            Google Meet Protocol
          </span>
        </div>
      </header>

      {/* Main Waiting Room Content Container */}
      <main style={{
        flex: 1,
        maxWidth: 1080,
        width: '100%',
        margin: '0 auto',
        padding: '36px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}>
        {/* Status Alert Banner */}
        {admitted ? (
          <div style={{
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            borderRadius: 12,
            padding: '18px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.08)',
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
                  Your audio and video are ready. Click below to enter the active session now.
                </div>
              </div>
            </div>
            <button
              onClick={handleJoinSession}
              style={{
                backgroundColor: '#0B57D0',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 12px rgba(11, 87, 208, 0.25)',
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
                Dr. Rajesh Sharma acts as the permanent host and has been alerted of your arrival. Please wait a moment.
              </div>
            </div>
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#0B57D0',
              backgroundColor: '#F0F9FF',
              padding: '6px 12px',
              borderRadius: 20,
              border: '1px solid #BAE6FD',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <WaitingRoomIcon size={14} color="#0B57D0" />
              <span>Host Approval Pending</span>
            </div>
          </div>
        )}

        {/* 2-Column Grid: Left (Hardware Self-Check) | Right (Consultation Details) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: 24,
        }}>
          {/* Left Column: Device Check & Self Preview */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            border: '1px solid #E2E8F0',
            padding: 24,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
                Camera & Audio Pre-Check
              </div>
              <span style={{ fontSize: 12, color: '#64748B' }}>
                Test your devices before connecting
              </span>
            </div>

            {/* Video Viewport */}
            <div style={{
              width: '100%',
              height: 280,
              backgroundColor: '#0F172A',
              borderRadius: 12,
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {cameraActive && hasWebcamAccess ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)',
                  }}
                />
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  color: '#94A3B8',
                }}>
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <VideoOffIcon size={28} color="#94A3B8" />
                  </div>
                  <span style={{ fontSize: 13 }}>Camera is turned off</span>
                </div>
              )}

              {/* Patient Badge */}
              <div style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                color: '#FFFFFF',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                backdropFilter: 'blur(6px)',
              }}>
                <PatientIcon size={14} color="#FFFFFF" />
                <span>K. Sundaram (You)</span>
              </div>
            </div>

            {/* Device Toggle Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <button
                onClick={toggleMic}
                style={{
                  padding: '10px 18px',
                  borderRadius: 24,
                  border: '1px solid',
                  borderColor: micActive ? '#0B57D0' : '#DC2626',
                  backgroundColor: micActive ? '#F0F7FF' : '#FEF2F2',
                  color: micActive ? '#0B57D0' : '#DC2626',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {micActive ? <MicIcon size={16} color="#0B57D0" /> : <MicOffIcon size={16} color="#DC2626" />}
                <span>{micActive ? 'Microphone On' : 'Microphone Muted'}</span>
              </button>

              <button
                onClick={toggleCamera}
                style={{
                  padding: '10px 18px',
                  borderRadius: 24,
                  border: '1px solid',
                  borderColor: cameraActive ? '#0B57D0' : '#DC2626',
                  backgroundColor: cameraActive ? '#F0F7FF' : '#FEF2F2',
                  color: cameraActive ? '#0B57D0' : '#DC2626',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {cameraActive ? <VideoMeetIcon size={16} color="#0B57D0" /> : <VideoOffIcon size={16} color="#DC2626" />}
                <span>{cameraActive ? 'Camera On' : 'Camera Off'}</span>
              </button>
            </div>

            {/* Microphone Audio Level Indicator */}
            <div style={{
              backgroundColor: '#F8FAFD',
              borderRadius: 8,
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
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PulseIcon size={14} color="#007A64" />
                  Live Mic Signal Check
                </span>
                <span style={{ fontWeight: 600, color: micActive ? '#007A64' : '#94A3B8' }}>
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

          {/* Right Column: Appointment Details & Host Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Attending Doctor Card */}
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              border: '1px solid #E2E8F0',
              padding: 20,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}>
              <div style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#64748B',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <DoctorHostIcon size={16} color="#0B57D0" />
                <span>Session Host (Attending Physician)</span>
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
                  color: '#0B57D0',
                  fontWeight: 700,
                  fontSize: 18,
                  border: '1px solid #BFDBFE',
                }}>
                  RS
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
                    Dr. Rajesh Sharma, MD
                  </div>
                  <div style={{ fontSize: 13, color: '#0B57D0', fontWeight: 600 }}>
                    Senior Consultant Cardiologist
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    Registration: TNMC-84920 • Permanent Room Host
                  </div>
                </div>
              </div>
            </div>

            {/* Patient & Appointment Record */}
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              border: '1px solid #E2E8F0',
              padding: 20,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}>
              <div style={{
                fontSize: 12,
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
                  <span style={{ color: '#64748B' }}>Hospital MRN:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A', fontFamily: 'monospace' }}>MT-2026-0841</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                  <span style={{ color: '#64748B' }}>Age / Gender:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>58 Years • Male (B+)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                  <span style={{ color: '#64748B' }}>Chief Complaint:</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>Chest Heaviness & Dry Cough</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Google Meet Link:</span>
                  <span style={{ fontWeight: 600, color: '#0B57D0', fontFamily: 'monospace' }}>meet.google.com/{meetingCode}</span>
                </div>
              </div>
            </div>

            {/* Reassurance Note */}
            <div style={{
              backgroundColor: '#F0FDF4',
              border: '1px solid #DCFCE7',
              borderRadius: 12,
              padding: '14px 16px',
              fontSize: 12,
              color: '#166534',
              lineHeight: 1.5,
            }}>
              <strong>Clinical Privacy Guarantee:</strong> This session utilizes NVIDIA Maxine AI low-latency streaming and end-to-end encryption. Your consultation audio and medical records comply with hospital HIPAA standards.
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
