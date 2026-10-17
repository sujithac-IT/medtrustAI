import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, PenLine, Radio, Video } from 'lucide-react'
import { api, type DashboardData } from '../api/client'
import type { Consultation } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert, Empty, SheetBadge, Spinner, StatusBadge } from '../components/ui'
import { fmtDateTime } from '../lib/format'

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today.getTime() + 86_400_000)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** One visit on the schedule: time in the gutter, person and reason, then the action that fits its state. */
function AgendaRow({ c, patientView }: { c: Consultation; patientView?: boolean }) {
  const joinable = c.status === 'scheduled' || c.status === 'live'
  return (
    <div className="agenda-row">
      <time dateTime={c.scheduled_at}>
        {new Date(c.scheduled_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        <span>{dayLabel(c.scheduled_at)}</span>
      </time>
      <div className="who" style={{ minWidth: 0 }}>
        <Link to={`/consultations/${c.id}`}>{patientView ? c.doctor_name : c.patient_name}</Link>
        <div className="muted small">{c.reason || 'Teleconsultation'}{!patientView && c.patient_mrn ? <>, <span className="mono">{c.patient_mrn}</span></> : null}</div>
      </div>
      <div className="acts">
        <StatusBadge c={c} />
        {c.case_sheet_status && <SheetBadge status={c.case_sheet_status} />}
        {joinable && <Link className="btn sm signal" to={c.join_path}><Video size={14} /> Join</Link>}
        {c.case_sheet_id && <Link className="btn sm ghost" to={`/case-sheets/${c.case_sheet_id}`}><FileText size={14} /> Case sheet</Link>}
      </div>
    </div>
  )
}

function Section({ title, icon, items, empty, className = '', render }: {
  title: string; icon?: React.ReactNode; items: Consultation[]; empty: string; className?: string
  render: (c: Consultation) => React.ReactNode
}) {
  return (
    <section className={`card ${className}`}>
      <div className="card-head"><h2>{icon}{title}</h2>{items.length > 0 && <span className="count">{items.length}</span>}</div>
      {items.length ? items.map(render) : <Empty>{empty}</Empty>}
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
    // poll gently, and not at all while the tab is hidden (saves battery and server work)
    const t = window.setInterval(() => { if (!document.hidden) void load() }, 20000)
    return () => { alive = false; window.clearInterval(t) }
  }, [])

  if (!user) return null
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user.name.split(' ').slice(0, 2).join(' ')
  const byTime = (xs: Consultation[] = []) => [...xs].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))

  if (user.role === 'patient') {
    const upcoming = byTime(data?.upcoming)
    const past = data?.past ?? []
    return (
      <div className="stack reveal" style={{ gap: 20 }}>
        <div className="page-head">
          <div>
            <h1>{greet}, {user.name.split(' ')[0]}</h1>
            <p className="overview">
              {!data ? 'Loading your visits.' : upcoming.length
                ? <>Your next visit is <b>{dayLabel(upcoming[0].scheduled_at).toLowerCase()} at {new Date(upcoming[0].scheduled_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</b> with {upcoming[0].doctor_name}.</>
                : 'You have no upcoming visits. Your doctor will schedule one.'}
            </p>
          </div>
        </div>
        {error && <Alert kind="error">{error}</Alert>}
        {!data && !error && <Spinner />}
        {data && (
          <>
            <Section title="Upcoming visits" items={upcoming} empty="Nothing scheduled." render={(c) => <AgendaRow key={c.id} c={c} patientView />} />
            <Section title="Past visits" items={past} empty="Your past visits and signed case sheets will appear here." render={(c) => <AgendaRow key={c.id} c={c} patientView />} />
          </>
        )}
      </div>
    )
  }

  const live = data?.live ?? []
  const drafts = data?.awaiting_approval ?? []
  const upcoming = byTime(data?.upcoming)
  const waiting = live.reduce((n, c) => n + (c.presence?.waiting ?? 0), 0)
  const isDoctor = user.role === 'doctor'
  const mine = drafts.filter((c) => c.doctor_id === user.id)

  return (
    <div className="stack reveal" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>{greet}, {firstName}</h1>
          {data && (
            <p className="overview">
              {waiting > 0 && <><b>{plural(waiting, 'patient')} waiting</b> to be let in. </>}
              {isDoctor
                ? (mine.length ? <><b>{plural(mine.length, 'case sheet')}</b> {mine.length === 1 ? 'needs' : 'need'} your signature. </> : 'No case sheets are waiting for your signature. ')
                : drafts.length ? <><b>{plural(drafts.length, 'draft')}</b> {drafts.length === 1 ? 'is' : 'are'} with the doctor for signing. </> : null}
              {upcoming.length ? `${plural(upcoming.length, 'visit')} scheduled.` : 'Nothing else is scheduled.'}
            </p>
          )}
        </div>
        <Link className="btn signal" to="/consultations?new=1"><Video size={16} /> New consultation</Link>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {!data && !error && <Spinner />}
      {data && (
        <>
          {live.length > 0 && (
            <Section className="now" title="In a room now" icon={<Radio size={17} />} items={live} empty=""
              render={(c) => <AgendaRow key={c.id} c={c} />} />
          )}
          <div className="dash-split">
            <section className="card queue">
              <div className="card-head">
                <h2><PenLine size={17} color="var(--amber)" />{isDoctor ? 'Needs your signature' : 'Drafts with the doctor'}</h2>
                {drafts.length > 0 && <span className="count">{drafts.length}</span>}
              </div>
              {drafts.length ? drafts.map((c) => (
                <Link key={c.id} className="queue-row" to={`/case-sheets/${c.case_sheet_id}`}>
                  <div style={{ minWidth: 0 }}>
                    <b>{c.patient_name}</b>
                    <div className="muted small">{c.reason || 'Teleconsultation'}, {fmtDateTime(c.scheduled_at)}{c.doctor_id !== user.id ? `. Attending: ${c.doctor_name}` : ''}</div>
                  </div>
                  <span className="btn sm ghost">{isDoctor && c.doctor_id === user.id ? 'Review and sign' : 'Open draft'}</span>
                </Link>
              )) : <Empty>Every case sheet is signed.</Empty>}
            </section>
            <Section title="Schedule" items={upcoming} empty="No visits scheduled. Create a consultation to invite a patient."
              render={(c) => <AgendaRow key={c.id} c={c} />} />
          </div>
          {(data.recent_approved?.length ?? 0) > 0 && (
            <Section title="Recently signed" items={data.recent_approved ?? []} empty=""
              render={(c) => <AgendaRow key={c.id} c={c} />} />
          )}
        </>
      )}
    </div>
  )
}
