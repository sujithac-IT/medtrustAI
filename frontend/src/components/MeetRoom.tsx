import React, { useEffect, useRef, useState } from 'react'
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
} from './MedicalIcons'
import { DEFAULT_NVIDIA_CONFIG, type NvidiaEffectsConfig } from '../services/consultationSync'

interface MeetRoomProps {
  onTranscriptUpdate?: (entries: TranscriptEntry[]) => void
  isRecording: boolean
  onToggleRecording: () => void
  elapsedSeconds: number
  meetLink?: string
  doctorName?: string
  patientName?: string
  onEndCall?: () => void
  onAdmitPatient?: () => void
  waitingPatientCount?: number
}

export default function MeetRoom({
  isRecording,
  onToggleRecording,
  elapsedSeconds,
  meetLink = 'meet.google.com/abc-defg-hij',
  doctorName = 'Dr. Rajesh Sharma, MD (Host)',
  patientName = 'K. Sundaram (Patient)',
  onEndCall,
  onAdmitPatient,
  waitingPatientCount = 0,
}: MeetRoomProps) {
  // CRITICAL SEPARATION: Dedicated Doctor webcam video element ref
  const doctorVideoRef = useRef<HTMLVideoElement>(null)
  const doctorStreamRef = useRef<MediaStream | null>(null)

  // Camera & Mic toggles
  const [doctorCamEnabled, setDoctorCamEnabled] = useState(false)
  const [micEnabled, setMicEnabled] = useState(true)
  const [screenSharing, setScreenSharing] = useState(false)
  const [sessionLocked, setSessionLocked] = useState(false)
  const [showNvidiaPanel, setShowNvidiaPanel] = useState(false)

  // NVIDIA Maxine & Acceleration States
  const [nvidiaConfig, setNvidiaConfig] = useState<NvidiaEffectsConfig>(DEFAULT_NVIDIA_CONFIG)

  // Cleanup media tracks on unmount
  useEffect(() => {
    return () => {
      if (doctorStreamRef.current) {
        doctorStreamRef.current.getTracks().forEach((t) => t.stop())
        doctorStreamRef.current = null
      }
    }
  }, [])

  // CRITICAL REQUIREMENT:
  // When the doctor turns on their camera, it must display the doctor's own video feed (NOT the patient's feed!)
  const toggleDoctorCamera = () => {
    if (!doctorCamEnabled) {
      // Turn ON doctor webcam
      navigator.mediaDevices?.getUserMedia({ video: { width: 1280, height: 720 }, audio: false })
        .then((stream) => {
          doctorStreamRef.current = stream
          setDoctorCamEnabled(true)
          if (doctorVideoRef.current) {
            doctorVideoRef.current.srcObject = stream
            doctorVideoRef.current.play().catch(() => {})
          }
        })
        .catch((err) => {
          console.warn('Doctor webcam access unavailable or denied:', err)
          // Still toggle state to show feed
          setDoctorCamEnabled(true)
        })
    } else {
      // Turn OFF doctor webcam
      if (doctorStreamRef.current) {
        doctorStreamRef.current.getTracks().forEach((t) => t.stop())
        doctorStreamRef.current = null
      }
      setDoctorCamEnabled(false)
    }
  }

  const toggleMic = () => {
    if (doctorStreamRef.current) {
      doctorStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !micEnabled
      })
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
      } catch {
        /* user cancelled */
      }
    }
  }

  const formatCallDuration = (s: number) => {
    const hours = Math.floor(s / 3600).toString().padStart(2, '0')
    const mins = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
    const secs = (s % 60).toString().padStart(2, '0')
    return `${hours}:${mins}:${secs}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      {/* Video Container with Two Distinct Feeds: Doctor (Left) & Patient (Right) */}
      <div style={{
        flex: 1,
        position: 'relative',
        backgroundColor: '#0F172A',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid #E2E8F0',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        padding: 10,
        minHeight: 380,
      }}>
        {/* NVIDIA Active Processing Status Pill (Top Overlay) */}
        <div style={{
          position: 'absolute',
          top: 18,
          left: 18,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          backgroundColor: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(118, 185, 0, 0.4)',
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
            {nvidiaConfig.tensorRtLatencyMs}ms (TensorRT)
          </span>
        </div>

        {/* Room Lock & Privacy Indicator */}
        <div style={{
          position: 'absolute',
          top: 18,
          right: 18,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 20,
          padding: '4px 12px',
          color: '#FFFFFF',
          fontSize: 11,
          fontWeight: 600,
        }}>
          <ShieldCheckIcon size={14} color="#10B981" />
          <span>{sessionLocked ? 'Host Locked (Secure)' : 'Google Meet Encrypted'}</span>
        </div>

        {/* ─── LEFT FEED: DOCTOR (PERMANENT HOST SELF-FEED) ─── */}
        <div style={{
          position: 'relative',
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: '#1E293B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          {doctorCamEnabled ? (
            <video
              ref={doctorVideoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)', // Mirrored self-view
                filter: nvidiaConfig.studioLighting ? 'contrast(1.05) brightness(1.04)' : 'none',
              }}
            />
          ) : (
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

          {/* NVIDIA Active Video Effects Badges on Doctor Feed */}
          <div style={{
            position: 'absolute',
            top: 12,
            right: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            alignItems: 'flex-end',
            zIndex: 10,
          }}>
            {nvidiaConfig.eyeContactGaze && (
              <span style={{
                fontSize: 10,
                color: '#FFFFFF',
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                padding: '2px 8px',
                borderRadius: 4,
                border: '1px solid rgba(118, 185, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#76B900' }} />
                Gaze Corrected
              </span>
            )}
            {nvidiaConfig.studioLighting && (
              <span style={{
                fontSize: 10,
                color: '#FFFFFF',
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                padding: '2px 8px',
                borderRadius: 4,
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}>
                Studio Lighting
              </span>
            )}
          </div>

          {/* Doctor Host Label Badge */}
          <div style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
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
            <span style={{ fontSize: 12, color: '#FFFFFF', fontWeight: 600 }}>
              {doctorName}
            </span>
            <span style={{
              fontSize: 10,
              backgroundColor: '#0284C7',
              color: '#FFFFFF',
              padding: '1px 6px',
              borderRadius: 4,
              fontWeight: 700,
            }}>
              HOST
            </span>
          </div>
        </div>

        {/* ─── RIGHT FEED: PATIENT FEED ─── */}
        <div style={{
          position: 'relative',
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: '#1E293B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <img
            src={patientFeedImg}
            alt="Patient"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: nvidiaConfig.superResolution ? 'contrast(1.02)' : 'none',
            }}
          />

          {/* NVIDIA Super-Resolution Badge on Patient Feed */}
          {nvidiaConfig.superResolution && (
            <div style={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 10,
              fontSize: 10,
              color: '#FFFFFF',
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              padding: '2px 8px',
              borderRadius: 4,
              border: '1px solid rgba(118, 185, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#76B900' }} />
              AI Super Res (1080p Upscaled)
            </div>
          )}

          {/* Patient Label Badge */}
          <div style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
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
            <span style={{ fontSize: 12, color: '#FFFFFF', fontWeight: 600 }}>
              {patientName}
            </span>
            <span style={{
              fontSize: 10,
              backgroundColor: 'rgba(52, 211, 153, 0.2)',
              color: '#34D399',
              padding: '1px 6px',
              borderRadius: 4,
              fontWeight: 600,
            }}>
              MRN: MT-2026-0841
            </span>
          </div>
        </div>
      </div>

      {/* ─── DOCTOR CONTROL BAR (GOOGLE MEET STYLE + MEDICAL CONTROLS) ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        gap: 16,
      }}>
        {/* Left: Media Control Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Doctor Mic Button */}
          <button
            onClick={toggleMic}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: micEnabled ? '#0B57D0' : '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              boxShadow: micEnabled ? '0 2px 8px rgba(11,87,208,0.25)' : '0 2px 8px rgba(220,38,38,0.25)',
            }}
            title={micEnabled ? 'Mute Doctor Microphone' : 'Unmute Doctor Microphone'}
          >
            {micEnabled ? <MicIcon size={20} color="#FFFFFF" /> : <MicOffIcon size={20} color="#FFFFFF" />}
          </button>

          {/* Doctor Camera Button - Displays DOCTOR feed */}
          <button
            onClick={toggleDoctorCamera}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: doctorCamEnabled ? '#0B57D0' : '#F1F5F9',
              color: doctorCamEnabled ? '#FFFFFF' : '#475569',
              border: doctorCamEnabled ? 'none' : '1px solid #CBD5E1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              boxShadow: doctorCamEnabled ? '0 2px 8px rgba(11,87,208,0.25)' : 'none',
            }}
            title={doctorCamEnabled ? 'Turn Off Doctor Camera' : 'Turn On Doctor Camera (Shows Your Video)'}
          >
            {doctorCamEnabled ? <VideoMeetIcon size={20} color="#FFFFFF" /> : <VideoOffIcon size={20} color="#475569" />}
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
            title="Share Clinical Records / Diagnostic Slides"
          >
            <ScreenShareIcon size={20} color={screenSharing ? '#FFFFFF' : '#475569'} />
          </button>

          {/* Session Lock (Host Privilege) */}
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
            title={sessionLocked ? 'Unlock Session (Allow new participants)' : 'Lock Session (Host Privilege)'}
          >
            <LockIcon size={18} color={sessionLocked ? '#FFFFFF' : '#475569'} />
          </button>

          {/* NVIDIA AI Video & Audio Effects Settings Toggle */}
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

          {/* End Consultation Button (Host) */}
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
            title="End Consultation Session"
          >
            <PhoneOffIcon size={20} color="#FFFFFF" />
          </button>
        </div>

        {/* Center: Live Clinical Audio Waveform */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          maxWidth: 340,
          margin: '0 12px',
        }}>
          <div style={{
            fontSize: 11,
            color: '#64748B',
            fontWeight: 600,
            marginBottom: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>Live Consultation Audio Waveform</span>
            <span style={{ fontSize: 11, color: '#007A64', fontWeight: 700 }}>
              Maxine AEC Active
            </span>
          </div>
          <AudioWaveform isActive={micEnabled} height={32} barCount={32} />
        </div>

        {/* Right: Call Timer & Host Status */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          minWidth: 95,
        }}>
          <span style={{
            fontSize: 16,
            fontWeight: 800,
            color: '#0F172A',
            fontFamily: 'monospace',
            letterSpacing: '0.05em',
          }}>
            {formatCallDuration(elapsedSeconds)}
          </span>
          <span style={{ fontSize: 11, color: '#0B57D0', fontWeight: 600 }}>
            Host: Dr. Sharma
          </span>
        </div>
      </div>

      {/* ─── EXPANDABLE NVIDIA MAXINE AI VIDEO/AUDIO CONTROL DRAWER ─── */}
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
            {/* Toggle 1: Eye Contact Gaze Redirection */}
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

            {/* Toggle 2: Studio Lighting */}
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

            {/* Toggle 3: Super Resolution */}
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

            {/* Toggle 4: Audio Echo Cancellation & Noise Suppression */}
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
