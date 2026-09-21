import React, { useEffect, useRef, useState } from 'react'
import type { TranscriptEntry } from '../types'

interface LiveTranscriptProps {
  entries: TranscriptEntry[]
  isActive: boolean
  interimText?: string
}

export default function LiveTranscript({ entries, isActive, interimText }: LiveTranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [entries, interimText, autoScroll])

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000)
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const getSpeakerBadge = (speaker: string) => {
    switch (speaker) {
      case 'doctor':
        return {
          label: 'Doctor',
          bg: '#2563EB',
          text: '#FFFFFF',
        }
      case 'student':
        return {
          label: 'Student',
          bg: '#7C3AED',
          text: '#FFFFFF',
        }
      case 'patient':
      default:
        return {
          label: 'Patient',
          bg: '#059669',
          text: '#FFFFFF',
        }
    }
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
        paddingBottom: 10,
        marginBottom: 10,
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>Live Transcript</span>
          {isActive && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, padding: '2px 8px', borderRadius: 12,
              background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontWeight: 600,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
              Live
            </span>
          )}
        </div>

        {/* Auto-scroll toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-muted)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={e => setAutoScroll(e.target.checked)}
            style={{ accentColor: 'var(--color-teal)', cursor: 'pointer' }}
          />
          <span>Auto-scroll</span>
        </label>
      </div>

      {/* Transcript entries */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        paddingRight: 4,
      }}>
        {entries.length === 0 && !interimText && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            color: 'var(--color-text-muted)',
            textAlign: 'center',
            padding: 20,
          }}>
            <span style={{ fontSize: 36 }}>🎙️</span>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              Transcript will appear as conversation happens
            </p>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              Supports Doctor, Student, and Patient speech recognition
            </p>
          </div>
        )}

        {entries.map((entry) => {
          const badge = getSpeakerBadge(entry.speaker)
          return (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
                animation: 'fadeIn 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  padding: '2px 7px',
                  borderRadius: 4,
                  background: badge.bg,
                  color: badge.text,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}>
                  {badge.label}
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                  {formatTime(entry.timestamp)}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.45, paddingLeft: 2 }}>
                {entry.text}
              </div>
            </div>
          )
        })}

        {/* Interim Text */}
        {interimText && (
          <div style={{
            padding: '8px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(0,212,170,0.04)',
            border: '1px dashed rgba(0,212,170,0.3)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-teal)', marginBottom: 2 }}>
              Listening...
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
              {interimText}
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
