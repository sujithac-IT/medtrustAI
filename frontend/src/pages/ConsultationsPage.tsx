import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Copy, ExternalLink, Video } from 'lucide-react'
import { api } from '../api/client'
import type { Consultation, Patient, User } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert, Empty, Modal, SheetBadge, Spinner, StatusBadge } from '../components/ui'
import { fmtDateTime } from '../lib/format'

function localInput(d: Date) {
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}

function NewConsultationModal({ initialPatient, onClose, onCreated }: { initialPatient?: string; onClose: () => void; onCreated: (c: Consultation) => void }) {
  const { user } = useAuth()
  const [patients, setPatients] = useState<Patient[]>([])
  const [doctors, setDoctors] = useState<User[]>([])
  const [students, setStudents] = useState<User[]>([])
  const [f, setF] = useState({
    patient_id: initialPatient ?? '', doctor_id: user?.role === 'doctor' ? user.id : '', student_id: user?.role === 'student' ? user.id : '',
    reason: '', scheduled_at: localInput(new Date()), create_google_meet: true,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gm, setGm] = useState(false)

  useEffect(() => {
    api.patients().then(setPatients).catch((e) => setError(e.message))
    api.staff('doctor').then((d) => { setDoctors(d); setF((s) => ({ ...s, doctor_id: s.doctor_id || d[0]?.id || '' })) }).catch(() => {})
    api.staff('student').then(setStudents).catch(() => {})
    api.health().then((h) => setGm(h.google_meet)).catch(() => {})
  }, [])

  const submit = async () => {
    if (!f.patient_id) return setError('Select a patient')
    if (!f.doctor_id) return setError('Select the attending doctor')
    setBusy(true)
    setError(null)
    try {
      onCreated(await api.createConsultation({
        ...f, student_id: f.student_id || null, reason: f.reason || null,
        scheduled_at: new Date(f.scheduled_at).toISOString(), create_google_meet: gm && f.create_google_meet,
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="New consultation" onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn signal" disabled={busy} onClick={submit}>{busy ? <Spinner /> : <Video size={16} />} Create room</button>
      </>
    }>
      <div className="stack">
        {error && <Alert kind="error">{error}</Alert>}
        <div className="field">
          <label htmlFor="nc-p">Patient *</label>
          <select id="nc-p" className="input" value={f.patient_id} onChange={(e) => setF({ ...f, patient_id: e.target.value })}>
            <option value="">Select patient</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name} - {p.mrn}</option>)}
          </select>
        </div>
        <div className="grid g2">
          <div className="field">
            <label htmlFor="nc-d">Attending doctor *</label>
            <select id="nc-d" className="input" value={f.doctor_id} onChange={(e) => setF({ ...f, doctor_id: e.target.value })}>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="nc-s">Student</label>
            <select id="nc-s" className="input" value={f.student_id} onChange={(e) => setF({ ...f, student_id: e.target.value })}>
              <option value="">None</option>
              {students.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid g2">
          <div className="field">
            <label htmlFor="nc-t">Scheduled</label>
            <input id="nc-t" type="datetime-local" className="input" value={f.scheduled_at} onChange={(e) => setF({ ...f, scheduled_at: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="nc-r">Reason for visit</label>
            <input id="nc-r" className="input" maxLength={300} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Chest pain follow-up" />
          </div>
        </div>
        <label className="row small" style={{ opacity: gm ? 1 : 0.6 }}>
          <input type="checkbox" disabled={!gm} checked={gm && f.create_google_meet} onChange={(e) => setF({ ...f, create_google_meet: e.target.checked })} />
          Also create a Google Meet link and Calendar event {gm ? '' : '(Google OAuth not configured on server)'}
        </label>
        <p className="muted small" style={{ margin: 0 }}>A secure in-app video room with live transcription is always created. Share the room link with the patient.</p>
      </div>
    </Modal>
  )
}

export function JoinLinks({ c }: { c: Consultation }) {
  const [copied, setCopied] = useState(false)
  const url = `${location.origin}${c.join_path}`
  return (
    <div className="row wrap">
      <code className="mono small" style={{ background: 'var(--paper)', padding: '5px 10px', borderRadius: 8, border: '1px solid var(--line)' }}>{url}</code>
      <button className="btn ghost sm" onClick={() => { void navigator.clipboard?.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1500) }}>
        <Copy size={14} /> {copied ? 'Copied' : 'Copy link'}
      </button>
      {c.meet.meeting_uri && <a className="btn ghost sm" href={c.meet.meeting_uri} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Google Meet</a>}
    </div>
  )
}

const FILTERS = [['', 'All'], ['scheduled', 'Scheduled'], ['live', 'Live'], ['completed', 'Completed'], ['cancelled', 'Cancelled']] as const

export default function ConsultationsPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const status = params.get('status') ?? ''
  const [items, setItems] = useState<Consultation[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const staff = user?.role !== 'patient'

  useEffect(() => {
    setItems(null)
    api.consultations(status ? `?status=${status}` : '').then(setItems).catch((e) => setError(e.message))
  }, [status])

  const setParam = (k: string, v: string | null) => {
    const n = new URLSearchParams(params)
    if (v) n.set(k, v)
    else n.delete(k)
    setParams(n, { replace: true })
  }

  return (
    <div className="stack reveal" style={{ gap: 18 }}>
      <div className="page-head">
        <div><h1>{staff ? 'Consultations' : 'My consultations'}</h1><p>Video visits with live transcription and AI case sheets.</p></div>
        {staff && <button className="btn signal" onClick={() => setParam('new', '1')}><Video size={16} /> New consultation</button>}
      </div>
      <div className="tabs" role="tablist">
        {FILTERS.map(([v, l]) => <button key={v} className={status === v ? 'on' : ''} onClick={() => setParam('status', v || null)}>{l}</button>)}
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      <div className="card table-wrap">
        {!items ? <div className="card-pad"><Spinner /></div> : items.length === 0 ? <Empty icon={<Video size={36} />}>No consultations here yet.</Empty> : (
          <table className="table">
            <thead><tr><th>When</th><th>{staff ? 'Patient' : 'Doctor'}</th><th>Team</th><th>Status</th><th>Case sheet</th><th /></tr></thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="click" onClick={() => nav(`/consultations/${c.id}`)}>
                  <td className="small">{fmtDateTime(c.scheduled_at)}<div className="muted">{c.reason}</div></td>
                  <td>{staff ? <><b>{c.patient_name}</b><div className="muted small mono">{c.patient_mrn}</div></> : <b>{c.doctor_name}</b>}</td>
                  <td className="small">{c.doctor_name}{c.student_name && <div className="muted">{c.student_name}</div>}</td>
                  <td><StatusBadge c={c} /></td>
                  <td><SheetBadge status={c.case_sheet_status} /></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {(c.status === 'scheduled' || c.status === 'live') && <Link className="btn sm signal" to={c.join_path}><Video size={14} /> Join</Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {staff && params.get('new') && (
        <NewConsultationModal initialPatient={params.get('patient') ?? undefined} onClose={() => setParam('new', null)} onCreated={(c) => nav(`/consultations/${c.id}`)} />
      )}
    </div>
  )
}
