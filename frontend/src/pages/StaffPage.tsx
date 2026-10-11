import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { UserPlus } from 'lucide-react'
import { api } from '../api/client'
import type { User } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert, Avatar, Empty, Modal, RoleBadge, Spinner } from '../components/ui'

const BLANK = { name: '', email: '', role: 'student' as 'doctor' | 'student', password: '', registration_number: '', specialization: '', designation: '' }

export default function StaffPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<User[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState(BLANK)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => { api.allStaff().then(setItems).catch((e) => setError(e.message)) }, [])
  useEffect(load, [load])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setFormErr(null)
    if (f.role === 'doctor' && !f.registration_number.trim()) return setFormErr('Medical registration number is required for doctors.')
    setBusy(true)
    try {
      const u = await api.createStaff(Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '')))
      setAdding(false)
      setF(BLANK)
      setNotice(`${u.name} can now sign in as ${u.role}. Share the temporary password securely and ask them to change it in Settings.`)
      load()
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : String(err))
    } finally { setBusy(false) }
  }
  const toggle = async (u: User) => {
    if (!u.disabled && !confirm(`Disable ${u.name}? They will be signed out immediately.`)) return
    try {
      const r = await api.updateStaff(u.id, { disabled: !u.disabled })
      setItems((xs) => xs?.map((x) => (x.id === r.id ? r : x)) ?? null)
    } catch (err) { setError(err instanceof Error ? err.message : String(err)) }
  }

  return (
    <div className="stack reveal" style={{ gap: 18 }}>
      <div className="page-head">
        <div><h1>Clinical staff</h1><p>Doctors and medical students who can run consultations and draft case sheets.</p></div>
        <button className="btn signal" onClick={() => setAdding(true)}><UserPlus size={16} /> Add staff member</button>
      </div>
      {error && <Alert kind="error" onClose={() => setError(null)}>{error}</Alert>}
      {notice && <Alert kind="success" onClose={() => setNotice(null)}>{notice}</Alert>}
      <section className="card">
        {!items ? <div className="card-pad"><Spinner /></div> : !items.length ? <Empty>No staff accounts.</Empty> : items.map((u) => (
          <div className="list-item" key={u.id} style={{ opacity: u.disabled ? 0.55 : 1 }}>
            <Avatar name={u.name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{u.name}</b> {u.id === user?.id && <span className="muted small">(you)</span>}
              <div className="muted small">{u.email}{u.registration_number ? ` - ${u.registration_number}` : ''}</div>
              {(u.designation || u.specialization) && <div className="small">{[u.designation, u.specialization].filter(Boolean).join(' - ')}</div>}
            </div>
            <RoleBadge role={u.role} />
            {u.disabled && <span className="badge danger">Disabled</span>}
            {u.id !== user?.id && <button className="btn sm ghost" onClick={() => toggle(u)}>{u.disabled ? 'Re-enable' : 'Disable'}</button>}
          </div>
        ))}
      </section>
      {adding && (
        <Modal title="Add staff member" onClose={() => setAdding(false)}
          footer={<><button className="btn ghost" onClick={() => setAdding(false)}>Cancel</button><button className="btn signal" form="staff-form" disabled={busy}>{busy ? <Spinner /> : <UserPlus size={16} />} Create account</button></>}>
          <form id="staff-form" className="stack" style={{ gap: 12 }} onSubmit={create}>
            {formErr && <Alert kind="error">{formErr}</Alert>}
            <div className="tabs" role="radiogroup" aria-label="Role">
              {(['student', 'doctor'] as const).map((r) => <button type="button" key={r} className={f.role === r ? 'on' : ''} onClick={() => setF({ ...f, role: r })}>{r === 'doctor' ? 'Doctor' : 'Medical student'}</button>)}
            </div>
            <label className="field"><span>Full name</span><input className="input" required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label className="field"><span>Email</span><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
            <label className="field"><span>Temporary password</span><input className="input" type="text" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
            <label className="field"><span>{f.role === 'doctor' ? 'Medical council registration no.' : 'Student ID'}</span><input className="input" required={f.role === 'doctor'} value={f.registration_number} onChange={(e) => setF({ ...f, registration_number: e.target.value })} /></label>
            <label className="field"><span>Designation</span><input className="input" value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} /></label>
            <label className="field"><span>Specialization / year</span><input className="input" value={f.specialization} onChange={(e) => setF({ ...f, specialization: e.target.value })} /></label>
          </form>
        </Modal>
      )}
    </div>
  )
}
