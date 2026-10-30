import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarX, Check, Download, FileDown, FileText, FlaskConical, Pencil, PhoneOff, Send, Settings2, Sparkles, Trash2, Video } from 'lucide-react'
import { api } from '../api/client'
import type { Consultation, Role, Scenario, Segment, User } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert, Empty, Modal, RoleBadge, SheetBadge, Spinner, StatusBadge } from '../components/ui'
import { fmtClock, fmtDateTime, fmtOffset } from '../lib/format'
import { JoinLinks } from './ConsultationsPage'

interface SegmentActions {
  onSave: (s: Segment, patch: { text?: string; speaker_role?: Role }) => Promise<void>
  onDelete: (s: Segment) => Promise<void>
}

function SegmentRow({ s, actions }: { s: Segment; actions?: SegmentActions }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(s.text)
  const [role, setRole] = useState<Role>(s.speaker_role)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!actions) return
    setBusy(true)
    try {
      await actions.onSave(s, { ...(text.trim() !== s.text ? { text: text.trim() } : {}), ...(role !== s.speaker_role ? { speaker_role: role } : {}) })
      setEditing(false)
    } finally { setBusy(false) }
  }
  return (
    <div className={`seg ${s.speaker_role}`}>
      <span className="bar" />
      <div>
        <div className="meta">
          <b>{s.speaker_name}</b><span>{s.speaker_role}</span><span className="mono">{fmtOffset(s.offset_ms)}</span>
          {s.source !== 'live' && <span className="badge neutral">{s.source.replace('_', ' ')}</span>}
          {s.edited && <span className="badge warn" title={s.original_text ? `Original: ${s.original_text}` : undefined}>edited</span>}
          {actions && !editing && (
            <span className="seg-tools">
              <button className="btn ghost sm" aria-label="Edit segment" title="Correct this line" onClick={() => { setText(s.text); setRole(s.speaker_role); setEditing(true) }}><Pencil size={13} /></button>
              <button className="btn ghost sm" aria-label="Delete segment" title="Delete this line" onClick={() => { if (confirm('Delete this transcript line? This is recorded in the audit log.')) void actions.onDelete(s) }}><Trash2 size={13} /></button>
            </span>
          )}
        </div>
        {editing ? (
          <div className="stack" style={{ gap: 6, marginTop: 6 }}>
            <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-label="Segment text" />
            <div className="row wrap">
              <select className="input" style={{ width: 130 }} value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Speaker role">
                <option value="doctor">Doctor</option><option value="student">Student</option><option value="patient">Patient</option>
              </select>
              <button className="btn sm signal" disabled={busy || !text.trim()} onClick={save}>{busy ? <Spinner /> : <Check size={14} />} Save</button>
              <button className="btn sm ghost" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : <p>{s.text}</p>}
      </div>
    </div>
  )
}

export function TranscriptList({ segments, actions }: { segments: Segment[]; actions?: SegmentActions }) {
  if (!segments.length) return <Empty>No transcript yet.</Empty>
  return <div>{segments.map((s) => <SegmentRow key={s.id + (s.edited_at ?? '')} s={s} actions={actions} />)}</div>
}

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function ManageModal({ c, onClose, onSaved }: { c: Consultation; onClose: () => void; onSaved: (c: Consultation) => void }) {
  const [students, setStudents] = useState<User[]>([])
  const [f, setF] = useState({ when: toLocalInput(c.scheduled_at), reason: c.reason ?? '', student_id: c.student_id ?? '' })
  const [cancelReason, setCancelReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { api.staff('student').then(setStudents).catch(() => {}) }, [])
  const submit = async (body: Parameters<typeof api.updateConsultation>[1]) => {
    setBusy(true)
    setError(null)
    try { onSaved(await api.updateConsultation(c.id, body)) } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  const save = () => {
    const body: Parameters<typeof api.updateConsultation>[1] = {}
    if (c.status === 'scheduled' && f.when && f.when !== toLocalInput(c.scheduled_at)) body.scheduled_at = new Date(f.when).toISOString()
    if (f.reason !== (c.reason ?? '')) body.reason = f.reason
    if (f.student_id !== (c.student_id ?? '')) body.student_id = f.student_id
    if (!Object.keys(body).length) return onClose()
    void submit(body)
  }
  return (
    <Modal title="Manage consultation" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Close</button><button className="btn signal" disabled={busy} onClick={save}>{busy ? <Spinner /> : <Check size={16} />} Save changes</button></>}>
      <div className="stack" style={{ gap: 12 }}>
        {error && <Alert kind="error">{error}</Alert>}
        {c.status === 'scheduled' && (
          <label className="field"><span>Date and time</span>
            <input className="input" type="datetime-local" value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })} /></label>
        )}
        <label className="field"><span>Reason for visit</span>
          <input className="input" maxLength={300} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></label>
        <label className="field"><span>Medical student</span>
          <select className="input" value={f.student_id} onChange={(e) => setF({ ...f, student_id: e.target.value })}>
            <option value="">No student</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}{s.registration_number ? ` (${s.registration_number})` : ''}</option>)}
          </select></label>
        {c.status === 'scheduled' && (
          <div className="stack" style={{ gap: 8, borderTop: '1px solid var(--line-2)', paddingTop: 12 }}>
            <b className="small">Cancel this consultation</b>
            <input className="input" placeholder="Reason (shown to the patient)" maxLength={300} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            <button className="btn danger" disabled={busy} onClick={() => { if (confirm('Cancel this consultation? The patient will see it as cancelled.')) void submit({ status: 'cancelled', cancel_reason: cancelReason || undefined }) }}>
              <CalendarX size={16} /> Cancel consultation
            </button>
          </div>
        )}
      </div>
    </Modal>
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
  const [managing, setManaging] = useState(false)
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
    const overwrite = !!c.case_sheet_id
    if (overwrite && !confirm('Regenerate the case sheet from the transcript? Every edit made to the current draft will be replaced. The old version stays in the audit trail.')) return
    const sheet = await api.generateCaseSheet(c.id, overwrite)
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
  const editable = staff && !approved && c.status !== 'cancelled'
  const segActions: SegmentActions | undefined = editable ? {
    onSave: async (s, patch) => {
      if (!Object.keys(patch).length) return
      try {
        const u = await api.editSegment(c.id, s.id, patch)
        setSegments((xs) => xs.map((x) => (x.id === u.id ? u : x)))
      } catch (e) { setError(e instanceof Error ? e.message : String(e)); throw e }
    },
    onDelete: (s) => run('del', async () => {
      await api.deleteSegment(c.id, s.id)
      setSegments((xs) => xs.filter((x) => x.id !== s.id))
    }),
  } : undefined
  const exportTxt = () => run('export', async () => {
    const text = await api.transcriptText(c.id)
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `transcript-${c.room_code}.txt`
    a.click()
    URL.revokeObjectURL(url)
  })
  const loadScenario = (s: Scenario) => run('demo', async () => {
    let replace = false
    if (segments.length) {
      if (!confirm(`This consultation already has ${segments.length} transcript line(s). Replace them with the "${s.title}" demo?`)) return
      replace = true
    }
    const r = await api.loadDemo(c.id, s.key, replace)
    setScenarios(null)
    setNotice(`${replace ? 'Replaced transcript with' : 'Added'} ${r.added} demo segments (${s.title}).`)
    await load()
  })

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
          {staff && c.status === 'scheduled' && <button className="btn ghost" onClick={() => setManaging(true)}><Settings2 size={16} /> Manage</button>}
          {staff && c.status === 'live' && <button className="btn ghost" onClick={() => setManaging(true)}><Settings2 size={16} /> Care team</button>}
        </div>
      </div>
      {c.status === 'cancelled' && <Alert kind="warn">This consultation was cancelled{c.cancel_reason ? `: ${c.cancel_reason}` : '.'}</Alert>}
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
            <div className="row">
              <span className="muted small">{segments.length} segments</span>
              <button className="btn ghost sm" disabled={!segments.length || busy === 'export'} onClick={exportTxt} title="Download transcript as text"><FileDown size={14} /> Export</button>
            </div>
          </div>
          <div className="transcript"><TranscriptList segments={segments} actions={segActions} /></div>
          {editable && (
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
              {approved ? <Alert kind="success">The case sheet is approved and locked.</Alert> : c.status === 'cancelled' ? null : (
                <button className="btn signal" disabled={!!busy || !segments.length} onClick={generate}>
                  {busy === 'gen' ? <Spinner /> : <Sparkles size={16} />} {c.case_sheet_id ? 'Regenerate case sheet' : 'Generate case sheet'}
                </button>
              )}
              {!segments.length && <span className="muted small">Record or add a transcript first.</span>}
            </section>
          )}
          {editable && (
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
            <p className="muted small" style={{ margin: 0 }}>Loads a realistic sample doctor-patient conversation (marked as demo). If a transcript exists you will be asked to replace it.</p>
            {scenarios.map((s) => (
              <button key={s.key} className="list-item btn ghost" style={{ borderRadius: 12, justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left' }}
                disabled={!!busy}
                onClick={() => loadScenario(s)}>
                <div style={{ flex: 1 }}><b>{s.title}</b><div className="muted small">{s.specialty} - {s.chief_complaint} - {s.turn_count} turns</div></div>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {managing && <ManageModal c={c} onClose={() => setManaging(false)} onSaved={(u) => { setC({ ...c, ...u }); setManaging(false); setNotice('Consultation updated.') }} />}
    </div>
  )
}
