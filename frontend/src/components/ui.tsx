import { useEffect, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { initials } from '../lib/format'
import type { Consultation, Role } from '../api/types'

export function Spinner({ light }: { light?: boolean }) {
  return <span className={`spinner${light ? ' light' : ''}`} role="status" aria-label="Loading" />
}

export function FullPageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="center-screen">
      <div className="stack" style={{ alignItems: 'center' }}>
        <Spinner />
        <span className="muted small">{label}</span>
      </div>
    </div>
  )
}

export function Alert({ kind = 'info', children, onClose }: { kind?: 'info' | 'error' | 'warn' | 'success'; children: ReactNode; onClose?: () => void }) {
  const Icon = kind === 'error' || kind === 'warn' ? AlertTriangle : kind === 'success' ? CheckCircle2 : Info
  return (
    <div className={`alert ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon size={18} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>{children}</div>
      {onClose && (
        <button className="btn ghost sm" style={{ border: 'none', padding: 2 }} onClick={onClose} aria-label="Dismiss">
          <X size={16} />
        </button>
      )}
    </div>
  )
}

export function Avatar({ name, size }: { name: string; size?: 'lg' }) {
  return <span className={`avatar${size ? ` ${size}` : ''}`}>{initials(name)}</span>
}

export function RoleBadge({ role }: { role: Role }) {
  return <span className={`badge ${role}`}>{role[0].toUpperCase() + role.slice(1)}</span>
}

export function StatusBadge({ c }: { c: Pick<Consultation, 'status' | 'presence'> }) {
  if (c.status === 'live' || (c.presence && c.presence.admitted > 0)) return <span className="badge live">Live</span>
  if (c.status === 'completed') return <span className="badge ok">Completed</span>
  if (c.status === 'cancelled') return <span className="badge danger">Cancelled</span>
  return <span className="badge neutral">Scheduled</span>
}

export function SheetBadge({ status }: { status?: string | null }) {
  if (status === 'approved') return <span className="badge ok">Approved</span>
  if (status === 'draft') return <span className="badge warn">Draft - needs approval</span>
  return <span className="badge neutral">No case sheet</span>
}

export function Modal({ title, children, onClose, footer }: { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="card-head">
          <h2>{title}</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="card-pad">{children}</div>
        {footer && <div className="card-head" style={{ borderTop: '1px solid var(--line-2)', borderBottom: 'none', justifyContent: 'flex-end' }}>{footer}</div>}
      </div>
    </div>
  )
}

export function Empty({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return <div className="empty">{icon}<div>{children}</div></div>
}

export function TagInput({ value, onChange, placeholder, variant }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; variant?: 'allergy' }) {
  const add = (raw: string) => {
    const t = raw.trim()
    if (t && !value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t])
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      {value.length > 0 && (
        <div className="tags">
          {value.map((v) => (
            <span key={v} className={`tag${variant ? ` ${variant}` : ''}`}>
              {v}
              <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}><X size={13} /></button>
            </span>
          ))}
        </div>
      )}
      <input
        className="input"
        placeholder={placeholder ?? 'Type and press Enter'}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add(e.currentTarget.value)
            e.currentTarget.value = ''
          }
        }}
        onBlur={(e) => {
          add(e.currentTarget.value)
          e.currentTarget.value = ''
        }}
      />
    </div>
  )
}
