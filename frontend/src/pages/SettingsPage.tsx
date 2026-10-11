import { useEffect, useState } from 'react'
import { CheckCircle2, CircleSlash } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { Avatar, RoleBadge, Spinner } from '../components/ui'
import { speechSupported } from '../rtc/useSpeech'

type Health = Awaited<ReturnType<typeof api.health>>

export default function SettingsPage() {
  const { user } = useAuth()
  const [h, setH] = useState<Health | null>(null)
  useEffect(() => { api.health().then(setH).catch(() => {}) }, [])
  if (!user) return null

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
      <section className="card">
        <div className="card-head"><h2>Integrations</h2>{h ? <span className="badge ok">Server {h.status}</span> : <Spinner />}</div>
        {flags.map(([name, on, hint]) => (
          <div className="list-item" key={name} style={{ alignItems: 'flex-start' }}>
            {on ? <CheckCircle2 size={18} color="var(--ok)" /> : <CircleSlash size={18} color="var(--ink-soft)" />}
            <div style={{ flex: 1 }}><b>{name}</b><div className="muted small">{hint}</div></div>
            <span className={`badge ${on ? 'ok' : 'neutral'}`}>{on ? 'Enabled' : 'Off'}</span>
          </div>
        ))}
      </section>
    </div>
  )
}
