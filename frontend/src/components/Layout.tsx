import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ClipboardList, FileText, LayoutDashboard, LogOut, Menu, Plus, Settings, Users, Video } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { Avatar } from './ui'
import { ROLE_LABEL } from '../lib/format'
import { wsUrl } from '../api/client'

export function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="currentColor" /></svg>
    </div>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const loc = useLocation()
  const nav = useNavigate()
  useEffect(() => setOpen(false), [loc.pathname])

  // Staff receive waiting-room notifications
  useEffect(() => {
    if (!user || user.role === 'patient') return
    let ws: WebSocket | null = null
    let timer: number | undefined
    let stopped = false
    const connect = () => {
      ws = new WebSocket(wsUrl('/api/ws/staff'))
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data)
        if (m.type === 'waiting') {
          setToast(`${m.name} is waiting in the consultation lobby`)
          window.setTimeout(() => setToast(null), 8000)
        }
      }
      ws.onclose = (e) => {
        if (!stopped && e.code !== 4401 && e.code !== 4403) timer = window.setTimeout(connect, 4000)
      }
    }
    connect()
    return () => {
      stopped = true
      window.clearTimeout(timer)
      ws?.close()
    }
  }, [user])

  if (!user) return null
  const staff = user.role !== 'patient'
  const items = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { to: '/consultations', label: staff ? 'Consultations' : 'My consultations', icon: Video, show: true },
    { to: '/patients', label: 'Patients', icon: Users, show: staff },
    { to: user.patient_id ? `/patients/${user.patient_id}` : '/', label: 'My medical history', icon: ClipboardList, show: !staff },
    { to: '/case-sheets', label: staff ? 'Case sheets' : 'My case sheets', icon: FileText, show: true },
    { to: '/settings', label: 'Settings', icon: Settings, show: true },
  ]
  return (
    <div className="shell">
      <div className="mobile-bar no-print">
        <div className="row"><b style={{ fontFamily: 'var(--serif)' }}>MedTrust AI</b></div>
        <button className="btn ghost icon" style={{ color: 'var(--paper)', borderColor: 'rgba(255,255,255,.2)' }} onClick={() => setOpen(!open)} aria-label="Menu"><Menu size={18} /></button>
      </div>
      <aside className={`side${open ? ' open' : ''}`}>
        <div className="brand">
          <BrandMark />
          <div><b>MedTrust AI</b><span>Clinical teleconsult</span></div>
        </div>
        {staff && (
          <button className="btn signal" style={{ marginBottom: 14 }} onClick={() => nav('/consultations?new=1')}>
            <Plus size={16} /> New consultation
          </button>
        )}
        <nav className="nav stack" style={{ gap: 2 }}>
          {items.filter((i) => i.show).map((i) => (
            <NavLink key={i.label} to={i.to} end={i.to === '/'}>
              <i.icon size={18} /> {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <Avatar name={user.name} />
          <div className="who"><b>{user.name}</b><span>{ROLE_LABEL[user.role]}{user.registration_number ? ` - ${user.registration_number}` : ''}</span></div>
          <button className="btn icon" style={{ background: 'transparent', borderColor: 'rgba(255,255,255,.18)' }} onClick={() => { logout(); nav('/login') }} aria-label="Sign out" title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="main">
        {toast && (
          <div className="alert warn no-print" style={{ position: 'fixed', right: 20, top: 20, zIndex: 80, maxWidth: 380, boxShadow: 'var(--shadow)' }}>
            <span style={{ flex: 1 }}>{toast}</span>
            <button className="btn sm" onClick={() => { setToast(null); nav('/consultations?status=live') }}>View</button>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
