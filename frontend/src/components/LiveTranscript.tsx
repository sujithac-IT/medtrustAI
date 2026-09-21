import React, { useEffect, useRef } from 'react'
import type { TranscriptEntry } from '../types'

interface LiveTranscriptProps {
  entries: TranscriptEntry[]
  isActive: boolean
  interimText?: string
}

export default function LiveTranscript({ entries, isActive, interimText }: LiveTranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries, interimText])

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    return `${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🎙️</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>Live Transcript</span>
        </div>
        {isActive && (
          <div className="live-indicator">
            <span className="live-dot" />
            Transcribing
          </div>
        )}
      </div>

      {/* Transcript area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        paddingRight: 4,
      }}>
        {entries.length === 0 && !interimText && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            color: 'var(--color-text-muted)',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: 40 }}>🎙️</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                {isActive ? 'Listening...' : 'Start recording to begin transcription'}
              </p>
              <p style={{ fontSize: 12 }}>Speak naturally — AI will separate Doctor and Patient voices</p>
            </div>
          </div>
        )}

        {entries.map((entry, i) => (
          <div
            key={entry.id}
            style={{
              display: 'flex',
              flexDirection: entry.speaker === 'doctor' ? 'row' : 'row-reverse',
              gap: 8,
              animation: 'slideUp 0.2s ease',
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: entry.speaker === 'doctor' ? 'var(--color-teal-dim)' : 'var(--color-blue-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              flexShrink: 0,
              border: `1px solid ${entry.speaker === 'doctor' ? 'rgba(0,212,170,0.2)' : 'rgba(59,130,246,0.2)'}`,
            }}>
              {entry.speaker === 'doctor' ? '👨‍⚕️' : '🤒'}
            </div>

            {/* Bubble */}
            <div style={{
              maxWidth: '78%',
              padding: '8px 12px',
              borderRadius: entry.speaker === 'doctor' ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
              background: entry.speaker === 'doctor'
                ? 'rgba(0, 212, 170, 0.08)'
                : 'rgba(59, 130, 246, 0.08)',
              border: `1px solid ${entry.speaker === 'doctor' ? 'rgba(0,212,170,0.15)' : 'rgba(59,130,246,0.15)'}`,
            }}>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                color: entry.speaker === 'doctor' ? 'var(--color-teal)' : 'var(--color-blue-accent)',
                marginBottom: 3,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
              }}>
                {entry.speaker === 'doctor' ? 'Doctor' : 'Patient'} · {formatTime(entry.timestamp)}
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
                {entry.text}
              </div>
            </div>
          </div>
        ))}

        {/* Interim (currently speaking) */}
        {interimText && (
          <div style={{ display: 'flex', flexDirection: 'row', gap: 8, opacity: 0.7 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-teal-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, border: '1px solid rgba(0,212,170,0.2)' }}>
              👨‍⚕️
            </div>
            <div style={{
              maxWidth: '78%',
              padding: '8px 12px',
              borderRadius: '4px 12px 12px 12px',
              background: 'rgba(0, 212, 170, 0.05)',
              border: '1px dashed rgba(0,212,170,0.3)',
            }}>
              <div style={{ fontSize: 10, color: 'var(--color-teal)', fontWeight: 700, marginBottom: 3, letterSpacing: '0.5px' }}>Listening...</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, fontStyle: 'italic' }}>
                {interimText}
                <span style={{ display: 'inline-block', width: 8, height: 14, background: 'var(--color-teal)', marginLeft: 4, animation: 'pulse-red 0.8s ease-in-out infinite', borderRadius: 2 }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Entry count */}
      {entries.length > 0 && (
        <div style={{ marginTop: 8, padding: '6px 0', borderTop: '1px solid var(--color-border)', fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <span>{entries.length} transcript entries</span>
          <span>
            Doctor: {entries.filter(e => e.speaker === 'doctor').length} · 
            Patient: {entries.filter(e => e.speaker === 'patient').length}
          </span>
        </div>
      )}
    </div>
  )
}
