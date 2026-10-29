import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, UserPlus, Users } from 'lucide-react'
import { api } from '../api/client'
import type { Patient } from '../api/types'
import { Alert, Empty, Modal, Spinner, TagInput } from '../components/ui'
import { ageFromDob, fmtDate } from '../lib/format'

const PHONE_RE = /^\+?[0-9][0-9 -]{7,16}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const BLOOD = ['Unknown', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const empty = {
  first_name: '', last_name: '', date_of_birth: '', gender: 'Female', phone: '', email: '', blood_group: 'Unknown',
  address: '', emergency_contact_name: '', emergency_contact_phone: '', allergies: [] as string[], conditions: [] as string[],
}

export function validatePatient(f: typeof empty): Record<string, string> {
  const e: Record<string, string> = {}
  if (!f.first_name.trim()) e.first_name = 'Required'
  if (!f.last_name.trim()) e.last_name = 'Required'
  if (!f.date_of_birth) e.date_of_birth = 'Required'
  else {
    const age = ageFromDob(f.date_of_birth)
    if (age === null || age < 0) e.date_of_birth = 'Cannot be in the future'
    else if (age > 125) e.date_of_birth = 'Not plausible'
  }
  if (!PHONE_RE.test(f.phone.trim())) e.phone = '8-17 digits, optional leading +'
  if (f.email && !EMAIL_RE.test(f.email)) e.email = 'Invalid email'
  if (f.emergency_contact_phone && !PHONE_RE.test(f.emergency_contact_phone.trim())) e.emergency_contact_phone = 'Invalid phone'
  return e
}

function NewPatientModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Patient) => void }) {
  const [f, setF] = useState(empty)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errs = validatePatient(f)
  const show = (k: string) => touched && errs[k]
  const set = (k: keyof typeof empty, v: string | string[]) => setF((s) => ({ ...s, [k]: v }))
  const age = f.date_of_birth ? ageFromDob(f.date_of_birth) : null
  const today = new Date().toISOString().slice(0, 10)

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    setTouched(true)
    if (Object.keys(errs).length) return
    setBusy(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { ...f, blood_group: f.blood_group === 'Unknown' ? null : f.blood_group }
      for (const k of ['email', 'address', 'emergency_contact_name', 'emergency_contact_phone']) if (!body[k]) body[k] = null
      onCreated(await api.createPatient(body))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const field = (k: keyof typeof empty, label: string, props: Record<string, unknown> = {}) => (
    <div className="field">
      <label htmlFor={`np-${k}`}>{label}</label>
      <input id={`np-${k}`} className={`input${show(k) ? ' invalid' : ''}`} value={f[k] as string} onChange={(e) => set(k, e.target.value)} {...props} />
      {show(k) && <span className="err">{errs[k]}</span>}
    </div>
  )

  return (
    <Modal title="Register new patient" onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn" disabled={busy} onClick={() => void submit()}>{busy ? <Spinner light /> : <UserPlus size={16} />} Register</button>
      </>
    }>
      <form className="stack" onSubmit={submit}>
        {error && <Alert kind="error">{error}</Alert>}
        <div className="grid g2">
          {field('first_name', 'First name *', { autoFocus: true })}
          {field('last_name', 'Last name *')}
        </div>
        <div className="grid g3">
          <div className="field">
            <label htmlFor="np-dob">Date of birth *</label>
            <input id="np-dob" type="date" max={today} className={`input${show('date_of_birth') ? ' invalid' : ''}`} value={f.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} />
            {show('date_of_birth') ? <span className="err">{errs.date_of_birth}</span> : <span className="muted small">Age: {age ?? '-'}{age !== null ? ' years' : ''}</span>}
          </div>
          <div className="field">
            <label htmlFor="np-gender">Gender *</label>
            <select id="np-gender" className="input" value={f.gender} onChange={(e) => set('gender', e.target.value)}>
              <option>Female</option><option>Male</option><option>Other</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="np-bg">Blood group</label>
            <select id="np-bg" className="input" value={f.blood_group} onChange={(e) => set('blood_group', e.target.value)}>
              {BLOOD.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
        </div>
        <div className="grid g2">
          {field('phone', 'Phone *', { type: 'tel', placeholder: '+91 98400 12345' })}
          {field('email', 'Email', { type: 'email' })}
        </div>
        {field('address', 'Address')}
        <div className="grid g2">
          {field('emergency_contact_name', 'Emergency contact')}
          {field('emergency_contact_phone', 'Emergency phone', { type: 'tel' })}
        </div>
        <div className="field"><label>Allergies</label><TagInput value={f.allergies} onChange={(v) => set('allergies', v)} variant="allergy" placeholder="e.g. Penicillin, then Enter" /></div>
        <div className="field"><label>Known conditions</label><TagInput value={f.conditions} onChange={(v) => set('conditions', v)} placeholder="e.g. Type 2 diabetes, then Enter" /></div>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

export default function PatientsPage() {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Patient[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    const t = window.setTimeout(() => {
      api.patients(q.trim() || undefined).then(setItems).catch((e) => setError(e.message))
    }, 220)
    return () => window.clearTimeout(t)
  }, [q])

  return (
    <div className="stack reveal" style={{ gap: 18 }}>
      <div className="page-head">
        <div><h1>Patients</h1><p>Search by name, MRN or phone.</p></div>
        <button className="btn signal" onClick={() => setCreating(true)}><UserPlus size={16} /> New patient</button>
      </div>
      <div className="row" style={{ maxWidth: 480, position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: 12, color: 'var(--ink-soft)' }} />
        <input className="input" style={{ paddingLeft: 36 }} placeholder="Search patients" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search patients" />
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      <div className="card table-wrap">
        {!items ? <div className="card-pad"><Spinner /></div> : items.length === 0 ? <Empty icon={<Users size={36} />}>No patients match "{q}".</Empty> : (
          <table className="table">
            <thead><tr><th>Patient</th><th>MRN</th><th>Age / Sex</th><th>Phone</th><th>Allergies</th><th>Registered</th></tr></thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="click" onClick={() => nav(`/patients/${p.id}`)}>
                  <td><b>{p.full_name}</b>{p.conditions.length > 0 && <div className="muted small">{p.conditions.join(', ')}</div>}</td>
                  <td className="mono small">{p.mrn}</td>
                  <td>{p.age ?? '-'} / {p.gender[0]}</td>
                  <td className="small">{p.phone}</td>
                  <td>{p.allergies.length ? <div className="tags">{p.allergies.map((a) => <span key={a} className="tag allergy">{a}</span>)}</div> : <span className="muted small">NKDA</span>}</td>
                  <td className="small muted">{fmtDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {creating && <NewPatientModal onClose={() => setCreating(false)} onCreated={(p) => nav(`/patients/${p.id}`)} />}
    </div>
  )
}
