import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Download, FileText, FlaskConical, PhoneOff, Send, Sparkles, Video } from 'lucide-react'
import { api } from '../api/client'
import type { Consultation, Role, Scenario, Segment } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert, Empty, Modal, RoleBadge, SheetBadge, Spinner, StatusBadge } from '../components/ui'
import { fmtClock, fmtDateTime, fmtOffset } from '../lib/format'
import { JoinLinks } from './ConsultationsPage'

export function TranscriptList({ segments }: { segments: Segment[] }) {
  if (!segments.length) return <Empty>No transcript yet.</Empty>
  return (
    <div>
      {segments.map((s) => (
        <div key={s.id} className={`seg ${s.speaker_role}`}>
          <span className="bar" />
          <div>
            <div className="meta"><b>{s.speaker_name}</b><span>{s.speaker_role}</span><span className="mono">{fmtOffset(s.offset_ms)}</span>{s.source !== 'live' && <span className="badge neutral">{s.source.replace('_', ' ')}</span>}</div>
            <p>{s.text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ConsultationDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const [c, setC] = useState<Consultation | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null)
  const [note, setNote] = useState({ text: '', role: 'doctor' as Role })
  const staff = user?.role !== 'patient'

  const load = useCallback(async () => {
    try {
      const cc = await api.consultation(id)
      setC(cc)
      setSegments(await api.transcript(cc.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [id])
  useEffect(() => { void load() }, [load])

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    setError(null)
    setNotice(null)
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(null) }
  }

  if (error && !c) return <Alert kind="error">{error}</Alert>
  if (!c) return <Spinner />

  const generate = () => run('gen', async () => {
    const sheet = await api.generateCaseSheet(c.id)
    nav(`/case-sheets/${sheet.id}`)
  })
  const addNote = (e: FormEvent) => {
    e.preventDefault()
    if (!note.text.trim()) return
    void run('note', async () => {
      const s = await api.addSegment(c.id, { text: note.text.trim(), speaker_role: note.role, client_id: crypto.randomUUID() })
      setSegments((x) => [...x, s])
      setNote({ ...note, text: '' })
    })
  }
  const approved = c.case_sheet_status === 'approved'

  return (
    <div className="stack reveal" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <span className="tiny muted mono">Room {c.room_code}</span>
          <h1>{staff ? c.patient_name : `Visit with ${c.doctor_name}`}</h1>
          <p>{fmtDateTime(c.scheduled_at)}{c.reason ? ` - ${c.reason}` : ''}</p>
          <div className="row wrap" style={{ marginTop: 8 }}><StatusBadge c={c} /><SheetBadge status={c.case_sheet_status} />
            {c.duration_seconds ? <span className="badge neutral">Duration {fmtClock(c.duration_seconds)}</span> : null}</div>
        </div>
        <div className="row wrap">
          {(c.status === 'scheduled' || c.status === 'live') && <Link className="btn signal" to={c.join_path}><Video size={16} /> Join video room</Link>}
          {user?.role === 'doctor' && c.status === 'live' && (
            <button className="btn danger" disabled={!!busy} onClick={() => run('end', async () => setC(await api.endConsultation(c.id)))}><PhoneOff size={16} /> End consultation</button>
          )}
          {c.case_sheet_id && <Link className="btn ghost" to={`/case-sheets/${c.case_sheet_id}`}><FileText size={16} /> Open case sheet</Link>}
        </div>
      </div>
      {error && <Alert kind="error" onClose={() => setError(null)}>{error}</Alert>}
      {notice && <Alert kind="success" onClose={() => setNotice(null)}>{notice}</Alert>}

      {staff && (c.status === 'scheduled' || c.status === 'live') && (
        <section className="card card-pad stack" style={{ gap: 8 }}>
          <h3>Invite participants</h3>
          <JoinLinks c={c} />
          {c.meet.google_error && <span className="err">Google Meet: {c.meet.google_error}</span>}
        </section>
      )}

      <div className="grid split wide-left">
        <section className="card">
          <div className="card-head">
            <h2>Transcript</h2>
            <span className="muted small">{segments.length} segments</span>
          </div>
          <div className="transcript"><TranscriptList segments={segments} /></div>
          {staff && !approved && (
            <form onSubmit={addNote} className="row" style={{ padding: 14, borderTop: '1px solid var(--line-2)' }}>
              <select className="input" style={{ width: 130 }} value={note.role} onChange={(e) => setNote({ ...note, role: e.target.value as Role })} aria-label="Speaker">
                <option value="doctor">Doctor</option><option value="student">Student</option><option value="patient">Patient</option>
              </select>
              <input className="input" placeholder="Add a transcript line or clinical note" value={note.text} onChange={(e) => setNote({ ...note, text: e.target.value })} />
              <button className="btn icon" disabled={busy === 'note'} aria-label="Add"><Send size={16} /></button>
            </form>
          )}
        </section>

        <div className="stack">
          {staff && (
            <section className="card card-pad stack">
              <div className="row"><Sparkles size={18} color="var(--signal)" /><h3>AI case sheet</h3></div>
              <p className="muted small" style={{ margin: 0 }}>
                Gemini extracts the 17 clinical sections from this transcript. Anything not said is listed under Missing Information - nothing is invented.
              </p>
              {approved ? <Alert kind="success">The case sheet is approved and locked.</Alert> : (
                <button className="btn signal" disabled={!!busy || !segments.length} onClick={generate}>
                  {busy === 'gen' ? <Spinner /> : <Sparkles size={16} />} {c.case_sheet_id ? 'Regenerate case sheet' : 'Generate case sheet'}
                </button>
              )}
              {!segments.length && <span className="muted small">Record or add a transcript first.</span>}
            </section>
          )}
          {staff && !approved && (
            <section className="card card-pad stack">
              <h3>Transcript sources</h3>
              <button className="btn ghost" disabled={!!busy} onClick={() => run('scen', async () => setScenarios(await api.scenarios()))}>
                <FlaskConical size={16} /> Load a demonstration transcript
              </button>
              <button className="btn ghost" disabled={!!busy || !c.meet.space_name && !c.meet.meeting_code}
                title={c.meet.provider === 'google_meet' ? '' : 'Only for consultations created with Google Meet'}
                onClick={() => run('gm', async () => {
                  const r = await api.importGoogle(c.id)
                  setNotice(`Imported ${r.imported} of ${r.total_entries} Google Meet transcript entries.`)
                  await load()
                })}>
                {busy === 'gm' ? <Spinner /> : <Download size={16} />} Import Google Meet transcript
              </button>
            </section>
          )}
          <section className="card card-pad stack" style={{ gap: 6 }}>
            <h3>Care team</h3>
            <div className="row"><RoleBadge role="doctor" /> {c.doctor_name}{c.doctor_specialization ? <span className="muted small">{c.doctor_specialization}</span> : null}</div>
            {c.student_name && <div className="row"><RoleBadge role="student" /> {c.student_name}</div>}
            <div className="row"><RoleBadge role="patient" /> {staff ? <Link to={`/patients/${c.patient_id}`}>{c.patient_name}</Link> : c.patient_name}</div>
          </section>
        </div>
      </div>

      {scenarios && (
        <Modal title="Demonstration transcripts" onClose={() => setScenarios(null)}>
          <div className="stack" style={{ gap: 8 }}>
            <p className="muted small" style={{ margin: 0 }}>Appends a realistic sample doctor-patient conversation (marked as demo) to this consultation.</p>
            {scenarios.map((s) => (
              <button key={s.key} className="list-item btn ghost" style={{ borderRadius: 12, justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left' }}
                disabled={!!busy}
                onClick={() => run('demo', async () => {
                  const r = await api.loadDemo(c.id, s.key)
                  setScenarios(null)
                  setNotice(`Added ${r.added} demo transcript segments (${s.title}).`)
                  await load()
                })}>
                <div style={{ flex: 1 }}><b>{s.title}</b><div className="muted small">{s.specialty} - {s.chief_complaint} - {s.turn_count} turns</div></div>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}
