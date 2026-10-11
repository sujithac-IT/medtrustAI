import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { GraduationCap, Stethoscope, UserRound } from 'lucide-react'
import { api, type AuthConfig } from '../api/client'
import { takeSignoutReason, useAuth } from '../auth/AuthContext'
import type { Role } from '../api/types'
import { Alert, Spinner } from '../components/ui'
import { BrandMark } from '../components/Layout'
import { firebaseClientConfigured, firebaseGoogleIdToken } from '../auth/firebase'

export default function LoginPage() {
  const { user, login, demo, register, adopt } = useAuth()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const next = params.get('next') || '/'
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [cfg, setCfg] = useState<AuthConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signedOut] = useState(() => takeSignoutReason())
  const [f, setF] = useState({ email: '', password: '', name: '', role: 'patient' as Role, invite_code: '', registration_number: '', date_of_birth: '', gender: 'Female', phone: '', remember: true })

  useEffect(() => { api.authConfig().then(setCfg).catch(() => setCfg(null)) }, [])
  if (user) return <Navigate to={next} replace />

  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }))
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      nav(next, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'login') return run(() => login(f.email, f.password, f.remember))
    const body: Record<string, unknown> = { email: f.email, password: f.password, name: f.name, role: f.role }
    if (f.role === 'patient') Object.assign(body, { date_of_birth: f.date_of_birth || null, gender: f.gender, phone: f.phone || null })
    else Object.assign(body, { invite_code: f.invite_code || null, registration_number: f.registration_number || null })
    return run(() => register(body))
  }

  return (
    <div className="auth">
      <section className="auth-art">
        <div className="brand" style={{ padding: 0 }}>
          <BrandMark />
          <div><b>MedTrust AI</b><span>Teaching hospital teleconsultation</span></div>
        </div>
        <svg className="ecg" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 60 H380 L410 60 L430 20 L455 105 L480 8 L505 92 L525 60 H760 L780 60 L795 40 L812 80 L828 60 H1200" fill="none" stroke="#E8833A" strokeWidth="3" />
        </svg>
        <h1>Every word of the visit, <em>charted</em> and signed.</h1>
        <p>Doctors, students and patients meet over secure video. Each voice is transcribed live, and the AI drafts a 17-section case sheet for the attending doctor to review and sign.</p>
        <div className="auth-steps">
          <div><b>01 / CONSULT</b>Video room with waiting lobby</div>
          <div><b>02 / TRANSCRIBE</b>Per-speaker live captions</div>
          <div><b>03 / SIGN</b>AI draft, doctor approval</div>
        </div>
      </section>
      <section className="auth-form">
        <div className="card reveal">
          <h2 style={{ marginBottom: 4 }}>{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
          <p className="muted small" style={{ marginTop: 0 }}>{mode === 'login' ? 'Use your hospital credentials.' : 'Patients can self-register. Staff need an invite code.'}</p>

          {cfg?.demo_mode && mode === 'login' && (
            <>
              <div className="demo-grid" style={{ marginTop: 16 }}>
                {([['doctor', Stethoscope, 'Doctor'], ['student', GraduationCap, 'Student'], ['patient', UserRound, 'Patient']] as const).map(([r, Icon, label]) => (
                  <button key={r} type="button" disabled={busy} onClick={() => run(() => demo(r))}>
                    <Icon size={22} /> {label}
                  </button>
                ))}
              </div>
              <div className="divider">or sign in with email</div>
            </>
          )}

          {cfg?.firebase_enabled && firebaseClientConfigured && (
            <>
              <button type="button" className="btn ghost" style={{ width: '100%', marginTop: 12 }} disabled={busy}
                onClick={() => run(async () => adopt(await api.firebase(await firebaseGoogleIdToken(), mode === 'register' ? f.role : 'patient')))}>
                Continue with Google (Firebase)
              </button>
              <div className="divider">or</div>
            </>
          )}
          {signedOut && !error && <div style={{ marginBottom: 12 }}><Alert kind="warn">{signedOut}</Alert></div>}
          {error && <div style={{ marginBottom: 12 }}><Alert kind="error">{error}</Alert></div>}
          <form className="stack" onSubmit={submit}>
            {mode === 'register' && (
              <>
                <div className="field"><label>I am a</label>
                  <div className="tabs">
                    {(['patient', 'doctor', 'student'] as Role[]).map((r) => (
                      <button type="button" key={r} className={f.role === r ? 'on' : ''} onClick={() => set('role', r)}>{r[0].toUpperCase() + r.slice(1)}</button>
                    ))}
                  </div>
                </div>
                <div className="field"><label htmlFor="name">Full name</label><input id="name" className="input" required minLength={2} value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
              </>
            )}
            <div className="field"><label htmlFor="email">Email</label><input id="email" className="input" type="email" autoComplete="email" required value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
            <div className="field"><label htmlFor="pw">Password</label><input id="pw" className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'register' ? 8 : 1} value={f.password} onChange={(e) => set('password', e.target.value)} /></div>
            {mode === 'register' && f.role === 'patient' && (
              <div className="grid g2">
                <div className="field"><label htmlFor="dob">Date of birth</label><input id="dob" className="input" type="date" required max={new Date().toISOString().slice(0, 10)} value={f.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} /></div>
                <div className="field"><label htmlFor="g">Gender</label><select id="g" className="input" value={f.gender} onChange={(e) => set('gender', e.target.value)}><option>Female</option><option>Male</option><option>Other</option></select></div>
                <div className="field" style={{ gridColumn: '1 / -1' }}><label htmlFor="ph">Phone</label><input id="ph" className="input" required pattern="\+?[0-9][0-9 \-]{7,16}" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98xxxxxxx" /></div>
              </div>
            )}
            {mode === 'register' && f.role !== 'patient' && (
              <div className="grid g2">
                <div className="field"><label htmlFor="inv">Staff invite code</label><input id="inv" className="input" value={f.invite_code} onChange={(e) => set('invite_code', e.target.value)} /></div>
                <div className="field"><label htmlFor="reg">Registration no.</label><input id="reg" className="input" required={f.role === 'doctor'} value={f.registration_number} onChange={(e) => set('registration_number', e.target.value)} /></div>
              </div>
            )}
            {mode === 'login' && (
              <label className="row small"><input type="checkbox" checked={f.remember} onChange={(e) => set('remember', e.target.checked)} /> Keep me signed in on this device</label>
            )}
            <button className="btn" disabled={busy} type="submit">{busy ? <Spinner light /> : mode === 'login' ? 'Sign in' : 'Create account'}</button>
          </form>
          <p className="small muted" style={{ textAlign: 'center', marginBottom: 0 }}>
            {mode === 'login' ? 'New patient? ' : 'Already registered? '}
            <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === 'login' ? 'register' : 'login'); setError(null) }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</a>
          </p>
          {cfg?.demo_mode && cfg.demo_accounts && mode === 'login' && (
            <p className="tiny muted" style={{ textAlign: 'center', marginTop: 14, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
              Demo password for all accounts: <span className="mono">{cfg.demo_accounts.doctor.password}</span>
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
