import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { api } from '../api/client'
import type { CaseSheetListItem } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert, Empty, SheetBadge, Spinner } from '../components/ui'
import { fmtDateTime } from '../lib/format'

export default function CaseSheetsPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const [items, setItems] = useState<CaseSheetListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()
  const staff = user?.role !== 'patient'

  useEffect(() => {
    setItems(null)
    api.caseSheets(status ? `?status=${status}` : '').then(setItems).catch((e) => setError(e.message))
  }, [status])

  return (
    <div className="stack reveal" style={{ gap: 18 }}>
      <div className="page-head">
        <div><h1>{staff ? 'Case sheets' : 'My case sheets'}</h1><p>{staff ? 'AI drafts and signed clinical records.' : 'Records signed by your doctor.'}</p></div>
      </div>
      {staff && (
        <div className="tabs">
          {[['', 'All'], ['draft', 'Awaiting approval'], ['approved', 'Approved']].map(([v, l]) => (
            <button key={v} className={status === v ? 'on' : ''} onClick={() => setParams(v ? { status: v } : {}, { replace: true })}>{l}</button>
          ))}
        </div>
      )}
      {error && <Alert kind="error">{error}</Alert>}
      <div className="card table-wrap">
        {!items ? <div className="card-pad"><Spinner /></div> : items.length === 0 ? <Empty icon={<FileText size={36} />}>No case sheets yet.</Empty> : (
          <table className="table">
            <thead><tr><th>Consultation</th><th>Patient</th><th>Chief complaint</th><th>Assessment</th><th>Status</th></tr></thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="click" onClick={() => nav(`/case-sheets/${s.id}`)}>
                  <td className="small">{fmtDateTime(s.scheduled_at)}<div className="muted">{s.doctor_name}</div></td>
                  <td><b>{s.patient_name}</b><div className="muted small mono">{s.patient_mrn}</div></td>
                  <td className="small" style={{ maxWidth: 260 }}>{s.chief_complaint || <span className="muted">-</span>}</td>
                  <td className="small" style={{ maxWidth: 260 }}>{s.assessment || <span className="muted">-</span>}</td>
                  <td><SheetBadge status={s.status} />{s.approval && <div className="muted small">{fmtDateTime(s.approval.approved_at)}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
