import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
          {[['', 'All'], ['draft', 'Awaiting signature'], ['approved', 'Signed']].map(([v, l]) => (
            <button key={v} className={status === v ? 'on' : ''} onClick={() => setParams(v ? { status: v } : {}, { replace: true })}>{l}</button>
          ))}
        </div>
      )}
      {error && <Alert kind="error">{error}</Alert>}
      <div className="card">
        {!items ? <div className="card-pad"><Spinner /></div> : items.length === 0 ? (
          <Empty icon={<FileText size={36} />}>{staff ? 'No case sheets yet. Generate one from a consultation transcript.' : 'Your signed case sheets will appear here after each visit.'}</Empty>
        ) : items.map((s) => (
          <Link key={s.id} to={`/case-sheets/${s.id}`} className={`sheet-row${staff ? '' : ' patient'}`}>
            <div className="when small">{fmtDateTime(s.scheduled_at)}<div className="muted">{s.doctor_name}</div></div>
            {staff && <div><b>{s.patient_name}</b><div className="muted small mono">{s.patient_mrn}</div></div>}
            <div className="what small"><b>{s.chief_complaint || 'No chief complaint recorded'}</b>{s.assessment && <div className="muted clamp">{s.assessment}</div>}</div>
            <div className="state"><SheetBadge status={s.status} />{s.approval && <div className="muted small">{fmtDateTime(s.approval.approved_at)}</div>}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
