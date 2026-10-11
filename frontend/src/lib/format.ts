export const fmtDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-'
export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '-')
export const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return (h ? `${h}:` : '') + `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}
export const fmtOffset = (ms: number) => fmtClock(ms / 1000)
export function ageFromDob(dob: string): number | null {
  if (!dob) return null
  const b = new Date(dob + 'T00:00:00')
  if (isNaN(b.getTime())) return null
  const t = new Date()
  let a = t.getFullYear() - b.getFullYear()
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--
  return a
}
export const initials = (name: string) => name.replace(/^Dr\.?\s*/i, '').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
export const ROLE_LABEL = { doctor: 'Doctor', student: 'Student', patient: 'Patient' } as const
