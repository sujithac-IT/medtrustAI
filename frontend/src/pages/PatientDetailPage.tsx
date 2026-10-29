import { Fragment, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FileText, Pencil, Save, Video, X } from 'lucide-react'
import { api } from '../api/client'
import type { Consultation, Patient } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert, Avatar, Empty, SheetBadge, Spinner, StatusBadge, TagInput } from '../components/ui'
import { fmtDate, fmtDateTime } from '../lib/format'

export default function PatientDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [history, setHistory] = useState<Consultation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ allergies: [] as string[], conditions: [] as string[], phone: '', address: '' })
  const [busy, setBusy] = useState(false)
  const staff = user?.role !== 'patient'

  useEffect(() => {
    api.history(id).then((h) => { setPatient(h.patient); setHistory(h.consultations) }).catch((e) => setError(e.message))
  }, [id])

  if (error) return <Alert kind="error">{error}</Alert>
  if (!patient) return <Spinner />

  const startEdit = () => {
    setDraft({ allergies: patient.allergies, conditions: patient.conditions, phone: patient.phone, address: patient.address ?? '' })
    setEditing(true)
  }
  const save = async () => {
    setBusy(true)
    try {
      setPatient(await api.updatePatient(patient.id, { ...draft, address: draft.address || null }))
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const facts: [string, string][] = [
    ['MRN', patient.mrn], ['Date of birth', `${fmtDate(patient.date_of_birth)} (${patient.age ?? '-'} y)`], ['Gender', patient.gender],
    ['Blood group', patient.blood_group || 'Unknown'], ['Phone', patient.phone], ['Email', patient.email || '-'],
    ['Emergency contact', [patient.emergency_contact_name, patient.emergency_contact_phone].filter(Boolean).join(' - ') || '-'],
  ]

  return (
    <div className="stack reveal" style={{ gap: 18 }}>
      <div className="page-head">
        <div className="row" style={{ gap: 16 }}>
          <Avatar name={patient.full_name} size="lg" />
          <div>
            <span className="tiny muted mono">{patient.mrn}</span>
            <h1>{patient.full_name}</h1>
            <p>{patient.age ?? '-'} years - {patient.gender} - registered {fmtDate(patient.created_at)}</p>
          </div>
        </div>
        {user?.role === 'doctor' || user?.role === 'student' ? (
          <Link className="btn signal" to={`/consultations?new=1&patient=${patient.id}`}><Video size={16} /> New consultation</Link>
        ) : null}
      </div>

      <div className="grid split">
        <section className="card">
          <div className="card-head">
            <h2>Demographics</h2>
            {staff && !editing && <button className="btn ghost sm" onClick={startEdit}><Pencil size={14} /> Edit</button>}
            {editing && (
              <div className="row">
                <button className="btn ghost sm" onClick={() => setEditing(false)}><X size={14} /></button>
                <button className="btn sm" disabled={busy} onClick={save}>{busy ? <Spinner light /> : <Save size={14} />} Save</button>
              </div>
            )}
          </div>
          <div className="card-pad stack">
            {!editing ? (
              <>
                <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', margin: 0 }}>
                  {facts.map(([k, v]) => <Fragment key={k}><dt className="muted small">{k}</dt><dd style={{ margin: 0 }}>{v}</dd></Fragment>)}
                  <dt className="muted small">Address</dt><dd style={{ margin: 0 }}>{patient.address || '-'}</dd>
                </dl>
                <div>
                  <div className="tiny muted" style={{ marginBottom: 6 }}>Allergies</div>
                  {patient.allergies.length ? <div className="tags">{patient.allergies.map((a) => <span className="tag allergy" key={a}>{a}</span>)}</div> : <span className="muted small">No known drug allergies recorded</span>}
                </div>
                <div>
                  <div className="tiny muted" style={{ marginBottom: 6 }}>Medical conditions</div>
                  {patient.conditions.length ? <div className="tags">{patient.conditions.map((a) => <span className="tag" key={a}>{a}</span>)}</div> : <span className="muted small">None recorded</span>}
                </div>
              </>
            ) : (
              <>
                <div className="field"><label>Phone</label><input className="input" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></div>
                <div className="field"><label>Address</label><input className="input" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></div>
                <div className="field"><label>Allergies</label><TagInput value={draft.allergies} onChange={(v) => setDraft({ ...draft, allergies: v })} variant="allergy" /></div>
                <div className="field"><label>Medical conditions</label><TagInput value={draft.conditions} onChange={(v) => setDraft({ ...draft, conditions: v })} /></div>
              </>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h2>Consultation history</h2><span className="muted small">{history.length} visits</span></div>
          {history.length === 0 ? <Empty>No consultations yet.</Empty> : history.map((c) => (
            <div className="list-item" key={c.id} style={{ alignItems: 'flex-start' }}>
              <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: c.case_sheet_status === 'approved' ? 'var(--ok)' : 'var(--line)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link to={`/consultations/${c.id}`} style={{ fontWeight: 600, textDecoration: 'none' }}>{fmtDateTime(c.scheduled_at)}</Link>
                <div className="muted small">{c.doctor_name}{c.student_name ? ` with ${c.student_name}` : ''}{c.reason ? ` - ${c.reason}` : ''}</div>
                <div className="row wrap" style={{ marginTop: 6 }}><StatusBadge c={c} /><SheetBadge status={c.case_sheet_status} /></div>
              </div>
              {c.case_sheet_id && <Link className="btn ghost sm" to={`/case-sheets/${c.case_sheet_id}`}><FileText size={14} /> Case sheet</Link>}
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
