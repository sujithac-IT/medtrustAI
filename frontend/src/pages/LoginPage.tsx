import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types'

export default function LoginPage() {
  const { login, demoLogin } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('doctor')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'signin' | 'register'>('signin')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(email, password, role)
      navigate('/dashboard')
    } catch {
      setError('Invalid credentials. Use Demo Login to try the app.')
    } finally {
      setLoading(false)
    }
  }

  const handleDemo = (r: UserRole) => {
    demoLogin(r)
    navigate('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--gradient-bg)', position: 'relative', overflow: 'hidden' }}>
      {/* Background elements */}
      <div style={{ position: 'absolute', top: -100, right: -100, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,170,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -150, left: -100, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Left panel */}
      <div style={{
        flex: '0 0 55%',
        background: 'linear-gradient(135deg, rgba(0,212,170,0.05) 0%, rgba(10,22,40,0.98) 100%)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 64,
        position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 48, textAlign: 'center' }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20, background: 'var(--gradient-teal)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 40, margin: '0 auto 20px', boxShadow: '0 0 40px rgba(0,212,170,0.3)',
          }}>⚕️</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 40, fontWeight: 400, color: 'var(--color-text-primary)', marginBottom: 8 }}>
            MedTrust <span style={{ color: 'var(--color-teal)' }}>AI</span>
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 15, fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase' }}>
            Clinical Intelligence Platform
          </p>
        </div>

        {/* Feature highlights */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', maxWidth: 380 }}>
          {[
            { icon: '📹', title: 'Live Video Consultations', desc: 'Seamless doctor-patient video meetings with real-time controls' },
            { icon: '🎙️', title: 'AI Transcription', desc: 'Automatic speech-to-text with speaker separation' },
            { icon: '📋', title: '17-Section Case Sheets', desc: 'Gemini AI extracts structured clinical documentation' },
            { icon: '🌐', title: 'Multilingual Support', desc: 'English, Tamil, Hindi, Telugu, Malayalam, Kannada' },
          ].map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 14,
              padding: '16px 20px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              transition: 'border-color 0.2s',
            }}>
              <span style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>{f.icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 2 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Hospital branding */}
        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', letterSpacing: '0.5px' }}>
            HIPAA Compliant · ISO 27001 · SOC 2 Type II
          </div>
        </div>
      </div>

      {/* Right panel - Login form */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
      }}>
        <div style={{ width: '100%', maxWidth: 400 }} className="animate-slide-up">
          {/* Tab switcher */}
          <div className="tabs" style={{ marginBottom: 32 }}>
            <button
              className={`tab-btn ${tab === 'signin' ? 'active' : ''}`}
              onClick={() => setTab('signin')}
            >Sign In</button>
            <button
              className={`tab-btn ${tab === 'register' ? 'active' : ''}`}
              onClick={() => setTab('register')}
            >Register</button>
          </div>

          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
            {tab === 'signin' ? 'Welcome back' : 'Create account'}
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 28 }}>
            {tab === 'signin' ? 'Sign in to your MedTrust AI account' : 'Join the MedTrust AI platform'}
          </p>

          {/* Role selector */}
          <div style={{ marginBottom: 24 }}>
            <div className="form-label" style={{ marginBottom: 10 }}>Select your role</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {(['doctor', 'patient'] as UserRole[]).map(r => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${role === r ? 'var(--color-teal)' : 'var(--color-border)'}`,
                    background: role === r ? 'var(--color-teal-dim)' : 'var(--color-bg-glass)',
                    color: role === r ? 'var(--color-teal)' : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 700,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s',
                  }}
                >
                  <span style={{ fontSize: 26 }}>{r === 'doctor' ? '👨‍⚕️' : '🤒'}</span>
                  <span>{r === 'doctor' ? 'Doctor' : 'Patient'}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                id="login-email"
                type="email"
                className="form-input"
                placeholder="doctor@hospital.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                id="login-password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div style={{ padding: 12, background: 'var(--color-danger-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', color: 'var(--color-danger)', fontSize: 13 }}>
                {error}
              </div>
            )}

            <button
              id="login-submit-btn"
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: 15, marginTop: 4 }}
              disabled={loading}
            >
              {loading ? <span className="animate-spin" style={{ display: 'inline-block', width: 20, height: 20, border: '2px solid rgba(10,22,40,0.3)', borderTop: '2px solid rgba(10,22,40,0.8)', borderRadius: '50%' }} /> : (tab === 'signin' ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
            <div className="divider" style={{ flex: 1, margin: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>OR TRY DEMO</span>
            <div className="divider" style={{ flex: 1, margin: 0 }} />
          </div>

          {/* Demo buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button
              id="demo-doctor-btn"
              className="btn btn-secondary"
              onClick={() => handleDemo('doctor')}
              style={{ padding: '14px', flexDirection: 'column', gap: 4, height: 'auto' }}
            >
              <span style={{ fontSize: 20 }}>👨‍⚕️</span>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Demo Doctor</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 400 }}>Dr. Rajesh Kumar</div>
            </button>
            <button
              id="demo-patient-btn"
              className="btn btn-secondary"
              onClick={() => handleDemo('patient')}
              style={{ padding: '14px', flexDirection: 'column', gap: 4, height: 'auto' }}
            >
              <span style={{ fontSize: 20 }}>🤒</span>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Demo Patient</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 400 }}>Arjun K.</div>
            </button>
          </div>

          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 24 }}>
            Demo mode: Full app experience with sample data. No account needed.
          </p>
        </div>
      </div>
    </div>
  )
}
