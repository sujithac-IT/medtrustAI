import React, { useEffect, useRef, useState } from 'react'
import AudioWaveform from './AudioWaveform'
import type { TranscriptEntry } from '../types'
import doctorFeedImg from '../assets/doctor_feed.jpg'
import patientFeedImg from '../assets/patient_feed.jpg'

interface MeetRoomProps {
  onTranscriptUpdate?: (entries: TranscriptEntry[]) => void
  isRecording: boolean
  onToggleRecording: () => void
  elapsedSeconds: number
  meetLink?: string
  doctorName?: string
  patientName?: string
  onEndCall?: () => void
}

export default function MeetRoom({
  isRecording,
  onToggleRecording,
  elapsedSeconds,
  meetLink = 'meet.google.com/abc-defg-hij',
  doctorName = 'Dr. Rajesh Sharma (Doctor)',
  patientName = 'Patient',
  onEndCall,
}: MeetRoomProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [camEnabled, setCamEnabled] = useState(true)
  const [liveWebcamActive, setLiveWebcamActive] = useState(false)
  const [micEnabled, setMicEnabled] = useState(true)
  const [screenSharing, setScreenSharing] = useState(false)
  const [hasWebcam, setHasWebcam] = useState(false)
  const [showMeetIframe, setShowMeetIframe] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)

  // Stop all media tracks on unmount to release the camera/mic and prevent memory leaks
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }, [])

  // Start patient webcam if user activates it
  const activateWebcam = () => {
    navigator.mediaDevices?.getUserMedia({ video: true, audio: true })
      .then(stream => {
        streamRef.current = stream
        setHasWebcam(true)
        setLiveWebcamActive(true)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      })
      .catch(() => {
        setHasWebcam(false)
        setLiveWebcamActive(false)
      })
  }

  const toggleCamera = () => {
    if (!liveWebcamActive) {
      activateWebcam()
    } else {
      setLiveWebcamActive(false)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
    setCamEnabled(!camEnabled)
  }

  const toggleMic = () => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !micEnabled })
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
      {/* Video Container with two side-by-side feeds */}
      <div style={{
        flex: 1,
        position: 'relative',
        background: '#0B0F19',
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        padding: 8,
        minHeight: 380,
      }}>
        {/* Left Feed: Doctor */}
        <div style={{
          position: 'relative',
          borderRadius: 10,
          overflow: 'hidden',
          background: '#151C2E',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <img
            src={doctorFeedImg}
            alt="Doctor"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />

          {/* Doctor Label Badge */}
          <div style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            padding: '5px 12px',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            borderRadius: 6,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            zIndex: 10,
          }}>
            <span style={{ fontSize: 12, color: 'white', fontWeight: 600 }}>{doctorName}</span>
          </div>
        </div>

        {/* Right Feed: Patient */}
        <div style={{
          position: 'relative',
          borderRadius: 10,
          overflow: 'hidden',
          background: '#151C2E',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {liveWebcamActive && hasWebcam && camEnabled ? (
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
            <img
              src={patientFeedImg}
              alt="Patient"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: !camEnabled ? 'brightness(0.3)' : 'none',
              }}
            />
          )}

          {!camEnabled && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(11, 15, 25, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}>
                👤
              </div>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Camera Off</span>
            </div>
          )}

          {/* Patient Label Badge */}
          <div style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            padding: '5px 12px',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            borderRadius: 6,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            zIndex: 10,
          }}>
            <span style={{ fontSize: 12, color: 'white', fontWeight: 600 }}>{patientName}</span>
          </div>
        </div>

        {/* Embedded Google Meet Iframe toggle view */}
        {showMeetIframe && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: '#0B0F19',
            zIndex: 30,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              padding: '8px 12px',
              background: 'rgba(0,0,0,0.6)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 12, color: 'white' }}>Google Meet Embed: {meetLink}</span>
              <button
                onClick={() => setShowMeetIframe(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                ✕ Close
              </button>
            </div>
            <iframe
              src={`https://${meetLink}`}
              style={{ flex: 1, border: 'none', width: '100%' }}
              title="Google Meet"
              allow="camera; microphone; display-capture"
            />
          </div>
        )}
      </div>

      {/* Call Controls & Waveform Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 18px',
        background: '#0D1424',
        borderRadius: 12,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        gap: 16,
      }}>
        {/* Left circular control buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Mic */}
          <button
            onClick={toggleMic}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: micEnabled ? '#2563EB' : '#EF4444',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              transition: 'all 0.2s',
              boxShadow: micEnabled ? '0 2px 8px rgba(37,99,235,0.4)' : '0 2px 8px rgba(239,68,68,0.4)',
            }}
            title={micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {micEnabled ? '🎙️' : '🔇'}
          </button>

          {/* Camera */}
          <button
            onClick={toggleCamera}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: camEnabled ? '#2563EB' : '#EF4444',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              transition: 'all 0.2s',
              boxShadow: camEnabled ? '0 2px 8px rgba(37,99,235,0.4)' : '0 2px 8px rgba(239,68,68,0.4)',
            }}
            title={camEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {camEnabled ? '📹' : '📷'}
          </button>

          {/* Screen share */}
          <button
            onClick={toggleScreenShare}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: screenSharing ? '#00D4AA' : '#2563EB',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(37,99,235,0.4)',
            }}
            title="Screen Share"
          >
            🖥️
          </button>

          {/* More options */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: '#2563EB',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                fontWeight: 'bold',
                transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(37,99,235,0.4)',
              }}
              title="More Options"
            >
              ⋯
            </button>
            {showMoreMenu && (
              <div style={{
                position: 'absolute',
                bottom: 52,
                left: 0,
                background: '#1E293B',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '6px 0',
                width: 170,
                zIndex: 40,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}>
                <button
                  onClick={() => { setShowMeetIframe(!showMeetIframe); setShowMoreMenu(false) }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 14px',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  🌐 Google Meet Window
                </button>
                <button
                  onClick={() => { onToggleRecording(); setShowMoreMenu(false) }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 14px',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {isRecording ? '⏹ Pause Speech Recognition' : '⏺ Resume Speech Recognition'}
                </button>
              </div>
            )}
          </div>

          {/* End Call Button */}
          <button
            onClick={onEndCall}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#DC2626',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              transition: 'all 0.2s',
              boxShadow: '0 2px 10px rgba(220,38,38,0.5)',
            }}
            title="End Consultation"
          >
            📞
          </button>
        </div>

        {/* Live Audio Waveform in Center */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          maxWidth: 360,
          margin: '0 12px',
        }}>
          <div style={{
            fontSize: 11,
            color: 'var(--color-text-muted)',
            fontWeight: 600,
            marginBottom: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>Live Audio Waveform</span>
            <span style={{ fontSize: 13 }}>🔊</span>
          </div>
          <AudioWaveform isActive={micEnabled} height={36} barCount={36} />
        </div>

        {/* Right: Call Duration */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          minWidth: 85,
        }}>
          <span style={{
            fontSize: 15,
            fontWeight: 800,
            color: 'var(--color-text-primary)',
            fontFamily: 'monospace',
            letterSpacing: '0.05em',
          }}>
            {formatCallDuration(elapsedSeconds)}
          </span>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
            Call Duration
          </span>
        </div>
      </div>
    </div>
  )
}
