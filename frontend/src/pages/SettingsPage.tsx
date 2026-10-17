import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, CircleSlash, KeyRound, Save } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { Alert, Avatar, RoleBadge, Spinner } from '../components/ui'
import { speechSupported } from '../rtc/useSpeech'

type Health = Awaited<ReturnType<typeof api.health>>

export default function SettingsPage() {
  const { user, setUser, adopt } = useAuth()
  const [h, setH] = useState<Health | null>(null)
  const [prof, setProf] = useState({ name: user?.name ?? '', phone: user?.phone ?? '', designation: user?.designation ?? '', specialization: user?.specialization ?? '' })
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string; where: 'profile' | 'password' } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => { api.health().then(setH).catch(() => {}) }, [])
  if (!user) return null
  const staff = user.role !== 'patient'

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setBusy('profile')
    setMsg(null)
    try {
      const body: Parameters<typeof api.updateMe>[0] = { name: prof.name.trim() }
      if (prof.phone.trim()) body.phone = prof.phone.trim()
      if (staff) { body.designation = prof.designation; body.specialization = prof.specialization }
      setUser(await api.updateMe(body))
      setMsg({ kind: 'success', text: 'Profile saved.', where: 'profile' })
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : String(err), where: 'profile' })
    } finally { setBusy(null) }
  }
  const changePw = async (e: FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (pw.next.length < 8) return setMsg({ kind: 'error', text: 'New password must be at least 8 characters.', where: 'password' })
    if (pw.next !== pw.confirm) return setMsg({ kind: 'error', text: 'New passwords do not match.', where: 'password' })
    setBusy('password')
    try {
      adopt(await api.changePassword(pw.current, pw.next))
      setPw({ current: '', next: '', confirm: '' })
      setMsg({ kind: 'success', text: 'Password changed. Other devices have been signed out.', where: 'password' })
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : String(err), where: 'password' })
    } finally { setBusy(null) }
  }

  const flags: [string, boolean | undefined, string][] = [
    ['Gemini AI extraction', h?.gemini, 'Set GEMINI_API_KEY. Without it, a grounded local extractor drafts the sheet and reports gaps.'],
    ['Google Meet + Calendar', h?.google_meet, 'Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN (scopes: calendar.events, meetings.space.created, meetings.space.readonly).'],
    ['Firebase sign-in', h?.firebase, 'Set FIREBASE_PROJECT_ID on the server and VITE_FIREBASE_* in the frontend build.'],
    ['TURN relay', h?.turn, 'Set TURN_URL / TURN_USERNAME / TURN_CREDENTIAL so video works across strict NATs and hospital firewalls.'],
    ['Demo mode', h?.demo_mode, 'DEMO_MODE=false disables one-click demo accounts in production.'],
    ['Browser speech recognition', speechSupported, 'Live transcription uses the Web Speech API (Chrome / Edge).'],
  ]

  return (
    <div className="stack reveal" style={{ gap: 18, maxWidth: 860 }}>
      <div className="page-head"><div><h1>Settings</h1><p>Profile and system capabilities.</p></div></div>
      <section className="card card-pad row" style={{ gap: 18 }}>
        <Avatar name={user.name} size="lg" />
        <div className="stack" style={{ gap: 4 }}>
          <h2>{user.name}</h2>
          <div className="row"><RoleBadge role={user.role} /><span className="muted small">{user.email}</span></div>
          {user.registration_number && <span className="small mono">Registration {user.registration_number}</span>}
          {(user.designation || user.specialization) && <span className="small">{[user.designation, user.specialization].filter(Boolean).join(' - ')}</span>}
        </div>
      </section>
      <div className="grid split">
        <form className="card card-pad stack" style={{ gap: 12 }} onSubmit={saveProfile}>
          <h3>Profile</h3>
          {msg?.where === 'profile' && <Alert kind={msg.kind}>{msg.text}</Alert>}
          <label className="field"><span>Full name</span><input className="input" required minLength={2} maxLength={120} value={prof.name} onChange={(e) => setProf({ ...prof, name: e.target.value })} /></label>
          <label className="field"><span>Phone</span><input className="input" type="tel" placeholder="+91 98400 00000" value={prof.phone} onChange={(e) => setProf({ ...prof, phone: e.target.value })} /></label>
          {staff && <>
            <label className="field"><span>Designation</span><input className="input" maxLength={120} value={prof.designation} onChange={(e) => setProf({ ...prof, designation: e.target.value })} /></label>
            <label className="field"><span>Specialization</span><input className="input" maxLength={120} value={prof.specialization} onChange={(e) => setProf({ ...prof, specialization: e.target.value })} /></label>
          </>}
          <button className="btn signal" disabled={busy === 'profile'}>{busy === 'profile' ? <Spinner /> : <Save size={16} />} Save profile</button>
        </form>
        <form className="card card-pad stack" style={{ gap: 12 }} onSubmit={changePw}>
          <h3>Change password</h3>
          {msg?.where === 'password' && <Alert kind={msg.kind}>{msg.text}</Alert>}
          <label className="field"><span>Current password</span><input className="input" type="password" autoComplete="current-password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></label>
          <label className="field"><span>New password</span><input className="input" type="password" autoComplete="new-password" required minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></label>
          <label className="field"><span>Confirm new password</span><input className="input" type="password" autoComplete="new-password" required value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></label>
          <button className="btn" disabled={busy === 'password'}>{busy === 'password' ? <Spinner /> : <KeyRound size={16} />} Update password</button>
        </form>
      </div>
      <section className="card">
        <div className="card-head"><h2>Integrations</h2>{h ? <span className="badge ok">Server {h.status}</span> : <Spinner />}</div>
        {flags.map(([name, on, hint]) => (
          <div className="list-item" key={name} style={{ alignItems: 'flex-start' }}>
            {on ? <CheckCircle2 size={18} color="var(--scrub)" /> : <CircleSlash size={18} color="var(--muted)" />}
            <div style={{ flex: 1 }}><b>{name}</b><div className="muted small">{hint}</div></div>
            <span className={`badge ${on ? 'ok' : 'neutral'}`}>{on ? 'Enabled' : 'Off'}</span>
          </div>
        ))}
      </section>
    </div>
  )
}
