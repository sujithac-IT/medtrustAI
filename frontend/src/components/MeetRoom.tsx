import React, { useEffect, useRef, useState } from 'react'
import AudioWaveform from './AudioWaveform'
import type { TranscriptEntry } from '../types'

interface MeetRoomProps {
  onTranscriptUpdate: (entries: TranscriptEntry[]) => void
  isRecording: boolean
  onToggleRecording: () => void
  elapsedSeconds: number
  meetLink?: string
}

export default function MeetRoom({ onTranscriptUpdate, isRecording, onToggleRecording, elapsedSeconds, meetLink }: MeetRoomProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [camEnabled, setCamEnabled] = useState(true)
  const [micEnabled, setMicEnabled] = useState(true)
  const [screenSharing, setScreenSharing] = useState(false)
  const [cameraError, setCameraError] = useState(false)
  const [showMeet, setShowMeet] = useState(false)

  // Start camera on mount
  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch {
      setCameraError(true)
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  const toggleCamera = () => {
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !camEnabled })
    setCamEnabled(!camEnabled)
  }

  const toggleMic = () => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !micEnabled })
    setMicEnabled(!micEnabled)
  }

  const toggleScreenShare = async () => {
    if (screenSharing) {
      setScreenSharing(false)
      startCamera()
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true })
        streamRef.current?.getVideoTracks().forEach(t => t.stop())
        if (videoRef.current) videoRef.current.srcObject = screen
        screen.getVideoTracks()[0].onended = () => { setScreenSharing(false); startCamera() }
        setScreenSharing(true)
      } catch { /* cancelled */ }
    }
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Video preview */}
      <div style={{
        position: 'relative',
        background: '#0D1117',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        aspectRatio: '16/9',
        border: `2px solid ${isRecording ? 'rgba(239,68,68,0.4)' : 'var(--color-border)'}`,
        transition: 'border-color 0.3s',
      }}>
        {cameraError ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#0D1117' }}>
            <span style={{ fontSize: 48 }}>📷</span>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Camera access denied</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Transcription still works via microphone</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
            />
            {!camEnabled && (
              <div style={{ position: 'absolute', inset: 0, background: '#0D1117', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--color-bg-glass)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>👤</div>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Camera off</p>
              </div>
            )}
          </>
        )}

        {/* Timer overlay */}
        <div style={{
          position: 'absolute', top: 12, left: 12,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          borderRadius: 'var(--radius-full)', padding: '4px 12px',
        }}>
          {isRecording && <div className="live-dot" />}
          <span style={{ fontSize: 13, fontWeight: 700, color: 'white', fontVariantNumeric: 'tabular-nums' }}>
            {isRecording ? formatTime(elapsedSeconds) : 'Not Recording'}
          </span>
        </div>

        {/* Recording indicator */}
        {isRecording && (
          <div style={{
            position: 'absolute', top: 12, right: 12,
          }}>
            <span className="live-indicator">
              <span className="live-dot" />
              LIVE
            </span>
          </div>
        )}

        {/* Google Meet embed toggle */}
        {meetLink && (
          <button
            style={{
              position: 'absolute', bottom: 12, right: 12,
              background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)', padding: '6px 12px',
              color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}
            onClick={() => setShowMeet(!showMeet)}
          >
            {showMeet ? '📷 Local View' : '🌐 Google Meet'}
          </button>
        )}
      </div>

      {/* Google Meet iframe */}
      {showMeet && meetLink && (
        <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--color-border)', height: 400 }}>
          <iframe
            src={meetLink}
            width="100%"
            height="400"
            allow="camera; microphone; display-capture; fullscreen"
            style={{ border: 'none' }}
            title="Google Meet"
          />
        </div>
      )}

      {/* Audio Waveform */}
      <div style={{
        background: 'var(--color-bg-glass)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        border: '1px solid var(--color-border)',
      }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.5px' }}>
          AUDIO INPUT {micEnabled ? '🎙️' : '🔇'}
        </div>
        <AudioWaveform isActive={isRecording && micEnabled} />
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '14px',
        background: 'var(--color-bg-glass)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
      }}>
        {/* Mic */}
        <button
          id="toggle-mic-btn"
          className={`btn ${micEnabled ? 'btn-secondary' : 'btn-danger'} btn-icon`}
          style={{ width: 48, height: 48, borderRadius: '50%', fontSize: 18 }}
          onClick={toggleMic}
          title={micEnabled ? 'Mute' : 'Unmute'}
        >
          {micEnabled ? '🎙️' : '🔇'}
        </button>

        {/* Camera */}
        <button
          id="toggle-cam-btn"
          className={`btn ${camEnabled ? 'btn-secondary' : 'btn-danger'} btn-icon`}
          style={{ width: 48, height: 48, borderRadius: '50%', fontSize: 18 }}
          onClick={toggleCamera}
          title={camEnabled ? 'Stop Camera' : 'Start Camera'}
        >
          {camEnabled ? '📹' : '📷'}
        </button>

        {/* Screen share */}
        <button
          id="screen-share-btn"
          className={`btn ${screenSharing ? 'btn-primary' : 'btn-secondary'} btn-icon`}
          style={{ width: 48, height: 48, borderRadius: '50%', fontSize: 18 }}
          onClick={toggleScreenShare}
          title={screenSharing ? 'Stop sharing' : 'Share screen'}
        >
          🖥️
        </button>

        {/* Record / transcribe toggle */}
        <button
          id="toggle-recording-btn"
          className={`btn ${isRecording ? 'btn-danger' : 'btn-primary'}`}
          style={{ borderRadius: 'var(--radius-full)', padding: '12px 24px', fontWeight: 700 }}
          onClick={onToggleRecording}
        >
          {isRecording ? '⏹ Stop Recording' : '⏺ Start Recording'}
        </button>
      </div>
    </div>
  )
}
