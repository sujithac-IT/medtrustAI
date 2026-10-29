import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, CheckCircle2, FileClock, FileText, Users, Video } from 'lucide-react'
import { api, type DashboardData } from '../api/client'
import type { Consultation } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert, Empty, SheetBadge, Spinner, StatusBadge } from '../components/ui'
import { fmtDateTime } from '../lib/format'

function ConsultRow({ c, patientView }: { c: Consultation; patientView?: boolean }) {
  const joinable = c.status === 'scheduled' || c.status === 'live'
  return (
    <div className="list-item">
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link to={`/consultations/${c.id}`} style={{ fontWeight: 600, textDecoration: 'none' }}>
          {patientView ? c.doctor_name : c.patient_name}
        </Link>
        <div className="muted small">
          {fmtDateTime(c.scheduled_at)}{c.reason ? ` - ${c.reason}` : ''}{!patientView && c.patient_mrn ? ` - ${c.patient_mrn}` : ''}
        </div>
      </div>
      <StatusBadge c={c} />
      {c.case_sheet_status && <SheetBadge status={c.case_sheet_status} />}
      {joinable && <Link className="btn sm signal" to={c.join_path}><Video size={14} /> Join</Link>}
      {c.case_sheet_id && <Link className="btn sm ghost" to={`/case-sheets/${c.case_sheet_id}`}><FileText size={14} /> Sheet</Link>}
    </div>
  )
}

function Panel({ title, items, empty, patientView }: { title: string; items?: Consultation[]; empty: string; patientView?: boolean }) {
  return (
    <section className="card">
      <div className="card-head"><h2>{title}</h2><span className="muted small">{items?.length ?? 0}</span></div>
      {items && items.length ? items.map((c) => <ConsultRow key={c.id} c={c} patientView={patientView} />) : <Empty>{empty}</Empty>}
    </section>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const load = () => api.dashboard().then((d) => alive && setData(d)).catch((e) => alive && setError(e.message))
    void load()
    const t = window.setInterval(load, 15000)
    return () => { alive = false; window.clearInterval(t) }
  }, [])

  if (!user) return null
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="stack reveal" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <span className="tiny muted">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <h1>{greet}, {user.name.split(' ').slice(0, 2).join(' ')}</h1>
          <p>{user.role === 'patient' ? 'Your consultations and signed case sheets.' : 'Live rooms, today\'s schedule and records waiting for sign-off.'}</p>
        </div>
        {user.role !== 'patient' && <Link className="btn signal" to="/consultations?new=1"><Video size={16} /> Start consultation</Link>}
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {!data && !error && <Spinner />}
      {data && data.role !== 'patient' && data.stats && (
        <>
          <div className="grid g4">
            {[
              ['Patients', data.stats.patients, Users],
              ['Consultations completed', data.stats.completed, CalendarClock],
              ['Drafts awaiting approval', data.stats.drafts, FileClock],
              ['Approved case sheets', data.stats.approved, CheckCircle2],
            ].map(([label, n, Icon]) => {
              const I = Icon as typeof Users
              return (
                <div className="card stat" key={label as string}>
                  <span className="tiny muted">{label as string}</span>
                  <div className="n">{n as number}</div>
                  <I className="bg" />
                </div>
              )
            })}
          </div>
          {data.live && data.live.length > 0 && <Panel title="Live now" items={data.live} empty="" />}
          <div className="grid g2">
            <Panel title="Upcoming" items={data.upcoming} empty="No scheduled consultations." />
            <Panel title="Awaiting doctor approval" items={data.awaiting_approval} empty="Every case sheet is signed." />
          </div>
          <Panel title="Recently approved" items={data.recent_approved} empty="No approved records yet." />
        </>
      )}
      {data && data.role === 'patient' && (
        <div className="grid g2">
          <Panel title="Upcoming consultations" items={data.upcoming} empty="No upcoming consultations. Your doctor will schedule one." patientView />
          <Panel title="Past consultations" items={data.past} empty="No past consultations yet." patientView />
        </div>
      )}
    </div>
  )
}
