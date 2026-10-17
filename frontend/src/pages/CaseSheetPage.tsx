import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BadgeCheck, Eye, History, Languages, Pencil, Plus, Printer, RefreshCw, Save, ShieldAlert, ShieldCheck, Square, Trash2, Volume2 } from 'lucide-react'
import { api } from '../api/client'
import type { CaseSheet, Consultation, Medication, Sections, Symptom, Vitals } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert, Modal, Spinner } from '../components/ui'
import { BrandMark } from '../components/Layout'
import { fmtDateTime } from '../lib/format'

const LANGS: [string, string, string][] = [
  ['en', 'English', 'en-IN'], ['ta', 'Tamil', 'ta-IN'], ['hi', 'Hindi', 'hi-IN'],
  ['te', 'Telugu', 'te-IN'], ['ml', 'Malayalam', 'ml-IN'], ['kn', 'Kannada', 'kn-IN'],
]
const VITALS: [keyof Vitals, string][] = [
  ['blood_pressure', 'BP'], ['pulse', 'Pulse'], ['temperature', 'Temp'], ['spo2', 'SpO2'], ['respiratory_rate', 'RR'], ['weight', 'Weight'],
]
const MED_COLS: [keyof Medication, string][] = [['name', 'Drug'], ['dose', 'Dose'], ['frequency', 'Frequency'], ['route', 'Route'], ['duration', 'Duration'], ['instructions', 'Instructions']]
const SYM_COLS: [keyof Symptom, string][] = [['name', 'Symptom'], ['severity', 'Severity'], ['duration', 'Duration'], ['notes', 'Notes']]
const PI_LABELS: Record<string, string> = {
  name: 'Name', mrn: 'MRN', age: 'Age', gender: 'Gender', date_of_birth: 'DOB', blood_group: 'Blood group', phone: 'Phone',
  consultation_date: 'Consultation date', attending_doctor: 'Attending doctor', doctor_registration: 'Reg. no.', student: 'Student', reason_for_visit: 'Reason for visit',
}
const TEXT_KEYS = new Set(['chief_complaint', 'history_of_present_illness', 'duration', 'family_history', 'social_history', 'assessment', 'treatment_plan', 'follow_up'])
const LIST_KEYS = new Set(['past_medical_history', 'allergies', 'investigations', 'missing_information', 'uncertain_information'])

function None() { return <span className="none">Not documented in the consultation</span> }

function RowTable<T extends object>({ rows, cols, edit, onChange, blank }: {
  rows: T[]; cols: [keyof T, string][]; edit: boolean; onChange: (r: T[]) => void; blank: T
}) {
  if (!edit && !rows.length) return <None />
  return (
    <div className="table-wrap">
      <table className={`table${edit ? ' med-table' : ''}`}>
        <thead><tr>{cols.map(([, l]) => <th key={l}>{l}</th>)}{edit && <th />}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map(([k, l]) => (
                <td key={String(k)}>
                  {edit ? <input aria-label={l} value={String(r[k] ?? '')} onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />
                    : String(r[k] ?? '') || <span className="muted">-</span>}
                </td>
              ))}
              {edit && <td><button className="btn ghost icon" style={{ width: 32, height: 32 }} onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove row"><Trash2 size={14} /></button></td>}
            </tr>
          ))}
        </tbody>
      </table>
      {edit && <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => onChange([...rows, { ...blank }])}><Plus size={14} /> Add row</button>}
    </div>
  )
}

function ListEdit({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return <textarea className="input" rows={Math.max(2, value.length + 1)} value={value.join('\n')} placeholder="One item per line"
    onChange={(e) => onChange(e.target.value.split('\n'))} onBlur={() => onChange(value.map((s) => s.trim()).filter(Boolean))} />
}

export default function CaseSheetPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [sheet, setSheet] = useState<CaseSheet | null>(null)
  const [consult, setConsult] = useState<Consultation | null>(null)
  const [draft, setDraft] = useState<Sections | null>(null)
  const [mode, setMode] = useState<'preview' | 'edit'>('preview')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [lang, setLang] = useState('en')
  const [speaking, setSpeaking] = useState(false)
  const [audit, setAudit] = useState<{ at: string; action: string; user_name: string; user_role: string }[] | null>(null)
  const staff = user?.role !== 'patient'

  const load = useCallback(async () => {
    try {
      const s = await api.caseSheet(id)
      setSheet(s)
      setDraft(s.sections)
      api.consultation(s.consultation_id).then(setConsult).catch(() => {})
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [id])
  useEffect(() => { void load() }, [load])
  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  if (error && !sheet) return <Alert kind="error">{error}</Alert>
  if (!sheet || !draft) return <Spinner />

  const locked = sheet.status === 'approved'
  const edit = mode === 'edit' && !locked && staff
  const dirty = JSON.stringify(draft) !== JSON.stringify(sheet.sections)
  const set = <K extends keyof Sections>(k: K, v: Sections[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setError(null); setNotice(null)
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(null) }
  }
  const save = () => run('save', async () => {
    const s = await api.updateCaseSheet(sheet.id, sheet.version, draft)
    setSheet(s); setDraft(s.sections); setNotice('Saved. Version ' + s.version)
  })
  const approve = () => run('approve', async () => {
    const s = await api.approve(sheet.id, sheet.version)
    setSheet(s); setDraft(s.sections); setApproving(false); setMode('preview')
    setNotice('Case sheet signed and locked. The patient summary was rebuilt from the signed content.')
  })
  const speak = () => {
    const synth = window.speechSynthesis
    if (!synth) return setError('Voice playback is not supported in this browser.')
    if (speaking) { synth.cancel(); setSpeaking(false); return }
    const text = sheet.summaries?.texts?.[lang]
    if (!text) return
    const bcp = LANGS.find((l) => l[0] === lang)![2]
    const u = new SpeechSynthesisUtterance(text)
    u.lang = bcp
    const voice = synth.getVoices().find((v) => v.lang === bcp) ?? synth.getVoices().find((v) => v.lang.startsWith(lang))
    if (voice) u.voice = voice
    else if (lang !== 'en') setNotice(`No ${LANGS.find((l) => l[0] === lang)![1]} voice is installed on this device; playback may use a default voice.`)
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    setSpeaking(true)
    synth.speak(u)
  }

  const canSign = user?.role === 'doctor' && user.id === sheet.attending_doctor_id
  const removed = sheet.guardrails?.removed ?? []
  const order = sheet.section_order
  const titles = sheet.section_titles
  const pi = draft.patient_info

  const renderSection = (k: keyof Sections) => {
    if (k === 'patient_info') {
      return (
        <div className="sheet-banner" style={{ marginBottom: 0 }}>
          {Object.keys(PI_LABELS).filter((x) => x in pi).map((x) => (
            <div key={x}>
              <span>{PI_LABELS[x]}</span>
              {edit && (x === 'reason_for_visit' || x === 'blood_group')
                ? <input className="input" style={{ padding: '4px 6px' }} value={String(pi[x] ?? '')} onChange={(e) => set('patient_info', { ...pi, [x]: e.target.value })} />
                : <b>{String(pi[x] ?? '') || '-'}</b>}
            </div>
          ))}
        </div>
      )
    }
    if (k === 'symptoms') return <RowTable rows={draft.symptoms} cols={SYM_COLS} edit={edit} onChange={(v) => set('symptoms', v)} blank={{ name: '', severity: '', duration: '', notes: '' }} />
    if (k === 'medications') return <RowTable rows={draft.medications} cols={MED_COLS} edit={edit} onChange={(v) => set('medications', v)} blank={{ name: '', dose: '', frequency: '', route: '', duration: '', instructions: '' }} />
    if (k === 'doctor_observations') {
      const o = draft.doctor_observations
      return (
        <>
          {edit ? <textarea className="input" value={o.summary} onChange={(e) => set('doctor_observations', { ...o, summary: e.target.value })} />
            : o.summary ? <div className="body">{o.summary}</div> : <None />}
          <div className="vitals">
            {VITALS.map(([vk, l]) => (
              <div key={vk}><span>{l}</span>
                {edit ? <input className="input" style={{ padding: '3px 6px' }} value={o.vitals[vk] ?? ''} onChange={(e) => set('doctor_observations', { ...o, vitals: { ...o.vitals, [vk]: e.target.value } })} />
                  : <b>{o.vitals[vk] || '-'}</b>}
              </div>
            ))}
          </div>
        </>
      )
    }
    if (TEXT_KEYS.has(k)) {
      const v = draft[k] as string
      return edit ? <textarea className="input" value={v} onChange={(e) => set(k, e.target.value as never)} /> : v ? <div className="body">{v}</div> : <None />
    }
    if (LIST_KEYS.has(k)) {
      const v = draft[k] as string[]
      if (edit) return <ListEdit value={v} onChange={(x) => set(k, x as never)} />
      if (!v.length) return k === 'missing_information' || k === 'uncertain_information' ? <span className="none">None</span> : <None />
      return k === 'allergies'
        ? <div className="tags">{v.map((a) => <span className="tag allergy" key={a}>{a}</span>)}</div>
        : <ul style={{ margin: 0, paddingLeft: 20 }}>{v.map((a, i) => <li key={i}>{a}</li>)}</ul>
    }
    return null
  }

  return (
    <div className="sheet">
      <div className="toolbar">
        <Link to={`/consultations/${sheet.consultation_id}`} className="btn ghost sm">Back to consultation</Link>
        <div style={{ flex: 1 }} />
        {staff && !locked && (
          <div className="tabs">
            <button className={mode === 'edit' ? 'on' : ''} onClick={() => setMode('edit')}><Pencil size={13} /> Edit</button>
            <button className={mode === 'preview' ? 'on' : ''} onClick={() => setMode('preview')}><Eye size={13} /> Preview</button>
          </div>
        )}
        {staff && !locked && <button className="btn sm" disabled={!dirty || !!busy} onClick={save}>{busy === 'save' ? <Spinner light /> : <Save size={14} />} Save</button>}
        {canSign && !locked && (
          <button className="btn ok sm" disabled={!!busy} onClick={() => { if (dirty) { setError('Save your edits before approving.'); return } setReviewed(false); setApproving(true) }}>
            <ShieldCheck size={14} /> Review and sign
          </button>
        )}
        <button className="btn ghost sm" onClick={() => window.print()}><Printer size={14} /> Print / PDF</button>
      </div>

      {error && <div className="no-print" style={{ marginBottom: 12 }}><Alert kind="error" onClose={() => setError(null)}>{error}</Alert></div>}
      {notice && <div className="no-print" style={{ marginBottom: 12 }}><Alert kind="success" onClose={() => setNotice(null)}>{notice}</Alert></div>}
      {!locked && <div className="no-print" style={{ marginBottom: 12 }}><Alert kind="warn">
        AI-generated draft ({sheet.source === 'gemini' ? 'Gemini' : 'local transcript extractor'}). Not valid for clinical use until reviewed and approved by the attending doctor.
        {user?.role === 'student' && ' Students can edit the draft; only the attending doctor can sign.'}
        {staff && !canSign && user?.role === 'doctor' && ' Only the attending doctor of this consultation can sign it.'}
      </Alert></div>}
      {!locked && staff && removed.length > 0 && <div className="no-print" style={{ marginBottom: 12 }}><Alert kind="info">
        <ShieldAlert size={15} /> AI safety check removed {removed.length} suggestion{removed.length === 1 ? '' : 's'} that the transcript does not support. They are listed under Uncertain Information.
      </Alert></div>}
      {locked && sheet.integrity_ok === false && <div style={{ marginBottom: 12 }}><Alert kind="error">
        Integrity check failed: the stored record no longer matches its signature. Do not rely on this copy; contact the records office.
      </Alert></div>}

      <article className={`sheet-paper${edit ? ' sheet-edit' : ''}`}>
        <header className="sheet-head">
          <div className="row" style={{ gap: 14 }}>
            <BrandMark />
            <div>
              <div className="hosp">MedTrust University Teaching Hospital</div>
              <div className="muted small">Teleconsultation case sheet</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {locked ? <span className="stamp"><BadgeCheck size={16} /> Signed</span> : <span className="badge warn">Draft, version {sheet.version}</span>}
            <div className="muted small mono" style={{ marginTop: 6 }}>{sheet.id}</div>
            {consult && <div className="muted small">{fmtDateTime(consult.started_at ?? consult.scheduled_at)}</div>}
          </div>
        </header>

        {order.map((k, i) => {
          const flag = k === 'missing_information' && draft.missing_information.length ? ' flag-missing'
            : k === 'uncertain_information' && draft.uncertain_information.length ? ' flag-uncertain' : ''
          return (
            <section key={k} className={`sec${flag}`}>
              <div className="sec-title"><span className="num">{String(i + 1).padStart(2, '0')}</span><h3>{titles[k]}</h3></div>
              {renderSection(k)}
            </section>
          )
        })}

        <div className="sign">
          <div>
            <div className="sig-name" style={{ fontSize: 16, fontWeight: 400, color: 'var(--graphite)' }}>{consult?.student_name ?? ''}</div>
            <div className="line">Prepared with medical student</div>
          </div>
          <div>
            <div className="sig-name">{locked && sheet.approval ? sheet.approval.approved_by.name : ''}</div>
            <div className="line">
              Attending doctor{locked && sheet.approval ? ` - Reg. ${sheet.approval.approved_by.registration_number ?? '-'} - signed ${fmtDateTime(sheet.approval.approved_at)}` : ' (signature pending)'}
            </div>
          </div>
        </div>
        {locked && sheet.approval && (
          <div className="seal">
            <ShieldCheck size={18} style={{ flexShrink: 0 }} />
            <div>
              <b>Electronically signed{sheet.integrity_ok ? ', integrity verified' : ''}.</b> {sheet.approval.statement}
              <div style={{ marginTop: 4 }}>Fingerprint <code>{sheet.approval.content_hash}</code></div>
            </div>
          </div>
        )}
      </article>

      <section className="card card-pad stack no-print" style={{ marginTop: 18 }}>
        <div className="row spread wrap">
          <div className="row"><Languages size={18} /><h3>Patient summary</h3>
            {sheet.summaries?.source && <span className="badge neutral">{sheet.summaries.machine_translated ? 'AI translated - verify with the patient' : 'Template - clinical details in English'}</span>}</div>
          {staff && !locked && <button className="btn ghost sm" disabled={!!busy} onClick={() => run('sum', async () => { const sm = await api.refreshSummaries(sheet.id); setSheet({ ...sheet, summaries: sm }) })}>
            {busy === 'sum' ? <Spinner /> : <RefreshCw size={14} />} Refresh from latest edits</button>}
        </div>
        <div className="row wrap">
          {LANGS.map(([code, label]) => <button key={code} className={`lang-btn${lang === code ? ' on' : ''}`} onClick={() => { window.speechSynthesis?.cancel(); setSpeaking(false); setLang(code) }}>{label}</button>)}
        </div>
        <div className="body" style={{ whiteSpace: 'pre-wrap', background: 'var(--chart)', borderRadius: 10, padding: 14, border: '1px solid var(--rule)' }}>
          {sheet.summaries?.texts?.[lang] || 'Summary not available.'}
        </div>
        <div><button className="btn sm" onClick={speak} disabled={!sheet.summaries?.texts?.[lang]}>{speaking ? <Square size={14} /> : <Volume2 size={14} />} {speaking ? 'Stop' : 'Play voice'}</button></div>
      </section>

      {staff && (
        <section className="card card-pad stack no-print" style={{ marginTop: 18 }}>
          <div className="row spread"><div className="row"><History size={18} /><h3>Audit trail</h3></div>
            {!audit && <button className="btn ghost sm" onClick={() => api.audit(sheet.id).then(setAudit).catch((e) => setError(e.message))}>Show</button>}</div>
          {audit && (audit.length === 0 ? <span className="muted small">No events.</span> : (
            <table className="table"><tbody>
              {audit.map((a, i) => <tr key={i}><td className="small mono">{fmtDateTime(a.at)}</td><td><b>{a.action}</b></td><td className="small">{a.user_name} ({a.user_role})</td></tr>)}
            </tbody></table>
          ))}
        </section>
      )}

      {approving && user && (
        <Modal title="Clinical verification" onClose={() => setApproving(false)} footer={
          <>
            <button className="btn ghost" onClick={() => setApproving(false)}>Cancel</button>
            <button className="btn ok" disabled={!reviewed || busy === 'approve'} onClick={approve}>{busy === 'approve' ? <Spinner light /> : <ShieldCheck size={16} />} Sign case sheet</button>
          </>
        }>
          <div className="stack">
            <div className="card card-pad" style={{ background: 'var(--chart)' }}>
              <div className="tiny muted">Signing as</div>
              <b style={{ fontSize: 18 }}>{user.name}</b>
              <div className="small">{user.designation ?? 'Attending physician'}{user.specialization ? ` - ${user.specialization}` : ''}</div>
              <div className="small mono">Registration {user.registration_number ?? '-'}</div>
            </div>
            {draft.missing_information.length > 0 && <Alert kind="warn">{draft.missing_information.length} item(s) are listed as missing information. Confirm they are acceptable before signing.</Alert>}
            {draft.uncertain_information.length > 0 && <Alert kind="warn">{draft.uncertain_information.length} item(s) are flagged as uncertain.</Alert>}
            <label className="row" style={{ alignItems: 'flex-start' }}>
              <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} style={{ marginTop: 4 }} />
              <span>I have reviewed every section of this AI-assisted case sheet (version {sheet.version}) against the consultation and confirm it is clinically accurate. After approval the record becomes read-only.</span>
            </label>
          </div>
        </Modal>
      )}
    </div>
  )
}
