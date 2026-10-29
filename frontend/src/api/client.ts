import type { CaseSheet, CaseSheetListItem, Consultation, Patient, Scenario, Segment, User, Role, Sections } from './types'

const TOKEN_KEY = 'medtrust.token'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY),
  set: (t: string, remember: boolean) => {
    ;(remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, t)
  },
  clear: () => {
    sessionStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_KEY)
  },
}

let onUnauthorized: ((reason: string) => void) | null = null
export const setUnauthorizedHandler = (fn: (reason: string) => void) => { onUnauthorized = fn }

/** Seconds until the stored JWT expires (null when there is no readable token). */
export function tokenSecondsLeft(): number | null {
  const t = tokenStore.get()
  if (!t) return null
  try {
    const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp - Date.now() / 1000 : null
  } catch {
    return null
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const d = (body as { detail: unknown }).detail
    if (typeof d === 'string') return d
    if (Array.isArray(d)) return d.map((e: { loc?: string[]; msg?: string }) => `${(e.loc ?? []).slice(1).join('.')}: ${e.msg}`).join('; ')
  }
  return fallback
}

const DEFAULT_REMOTE_API = 'https://medtrust-api-x71g.onrender.com'
const DEFAULT_REMOTE_WS = 'wss://medtrust-api-x71g.onrender.com'

export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('MEDTRUST_API_URL')
    if (custom) return custom.replace(/\/$/, '')
    // When served directly (via tunnel, LAN IP, or localhost), use relative paths to same origin
    if (!window.location.hostname.endsWith('vercel.app')) {
      return ''
    }
  }
  const envVal = import.meta.env.VITE_API_BASE_URL as string | undefined
  if (envVal) return envVal.replace(/\/$/, '')
  return DEFAULT_REMOTE_API
}

const API_BASE = getApiBase()

async function request<T>(method: string, path: string, body?: unknown, raw = false): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let res: Response
  try {
    const url = `${API_BASE}${path}`
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'Cannot reach the MedTrust server. Check your connection.')
  }
  const text = await res.text()
  let data: unknown = null
  if (text && !(raw && res.ok)) {
    try { data = JSON.parse(text) } catch { data = { detail: text.slice(0, 200) } }
  }
  if (!res.ok) {
    const msg = errorMessage(data, `${res.status} ${res.statusText}`)
    if (res.status === 401 && token) onUnauthorized?.(msg)
    throw new ApiError(res.status, msg)
  }
  return (raw ? text : data) as T
}

const get = <T,>(p: string) => request<T>('GET', p)
const post = <T,>(p: string, b?: unknown) => request<T>('POST', p, b ?? {})
const patch = <T,>(p: string, b: unknown) => request<T>('PATCH', p, b)
const del = (p: string) => request<null>('DELETE', p)

export interface Session { token: string; user: User }
export interface AuthConfig {
  demo_mode: boolean
  firebase_enabled: boolean
  doctor_signup_requires_invite: boolean
  demo_accounts: Record<Role, { email: string; password: string }> | null
}

export const api = {
  health: () => get<{ status: string; gemini: boolean; google_meet: boolean; firebase: boolean; demo_mode: boolean; turn: boolean }>('/api/health'),
  authConfig: () => get<AuthConfig>('/api/auth/config'),
  login: (email: string, password: string) => post<Session>('/api/auth/login', { email, password }),
  demo: (role: Role) => post<Session>('/api/auth/demo', { role }),
  register: (body: Record<string, unknown>) => post<Session>('/api/auth/register', body),
  firebase: (id_token: string, role: Role) => post<Session>('/api/auth/firebase', { id_token, role }),
  me: () => get<User>('/api/auth/me'),
  updateMe: (b: { name?: string; phone?: string; specialization?: string; designation?: string }) => patch<User>('/api/auth/me', b),
  changePassword: (current_password: string, new_password: string) =>
    post<Session>('/api/auth/password', { current_password, new_password }),
  createStaff: (b: Record<string, unknown>) => post<User>('/api/users', b),
  updateStaff: (id: string, b: { disabled?: boolean; is_admin?: boolean; designation?: string; specialization?: string }) => patch<User>(`/api/users/${id}`, b),
  allStaff: () => get<User[]>('/api/users?include_disabled=true'),
  dashboard: () => get<DashboardData>('/api/dashboard'),
  staff: (role?: Role) => get<User[]>(`/api/users${role ? `?role=${role}` : ''}`),

  patients: (q?: string) => get<Patient[]>(`/api/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  patient: (id: string) => get<Patient>(`/api/patients/${id}`),
  createPatient: (b: Record<string, unknown>) => post<Patient>('/api/patients', b),
  updatePatient: (id: string, b: Record<string, unknown>) => patch<Patient>(`/api/patients/${id}`, b),
  history: (id: string) => get<{ patient: Patient; consultations: Consultation[] }>(`/api/patients/${id}/history`),

  consultations: (params = '') => get<Consultation[]>(`/api/consultations${params}`),
  consultation: (idOrCode: string) => get<Consultation>(`/api/consultations/${idOrCode}`),
  createConsultation: (b: Record<string, unknown>) => post<Consultation>('/api/consultations', b),
  updateConsultation: (id: string, b: { scheduled_at?: string; reason?: string; student_id?: string; doctor_id?: string; status?: 'cancelled'; cancel_reason?: string }) =>
    patch<Consultation>(`/api/consultations/${id}`, b),
  startConsultation: (id: string) => post<Consultation>(`/api/consultations/${id}/start`),
  endConsultation: (id: string) => post<Consultation>(`/api/consultations/${id}/end`),
  transcript: (id: string) => get<Segment[]>(`/api/consultations/${id}/transcript`),
  addSegment: (id: string, b: { text: string; client_id?: string; language?: string; speaker_role?: Role }) =>
    post<Segment>(`/api/consultations/${id}/transcript`, b),
  scenarios: () => get<Scenario[]>('/api/consultations/demo/scenarios'),
  loadDemo: (id: string, scenario: string, replace = false) =>
    post<{ added: number }>(`/api/consultations/${id}/transcript/demo`, { scenario, replace }),
  editSegment: (cid: string, sid: string, b: { text?: string; speaker_role?: Role }) =>
    patch<Segment>(`/api/consultations/${cid}/transcript/${sid}`, b),
  deleteSegment: (cid: string, sid: string) => del(`/api/consultations/${cid}/transcript/${sid}`),
  transcriptText: (cid: string) => request<string>('GET', `/api/consultations/${cid}/transcript.txt`, undefined, true),
  importGoogle: (id: string) => post<{ imported: number; total_entries: number }>(`/api/consultations/${id}/transcript/import-google`),

  generateCaseSheet: (cid: string, overwrite = false) =>
    post<CaseSheet>(`/api/consultations/${cid}/case-sheet${overwrite ? '?overwrite=true' : ''}`),
  wsTicket: (consultation_id?: string) => post<{ ticket: string }>('/api/auth/ws-ticket', consultation_id ? { consultation_id } : {}),
  caseSheets: (params = '') => get<CaseSheetListItem[]>(`/api/case-sheets${params}`),
  caseSheet: (id: string) => get<CaseSheet>(`/api/case-sheets/${id}`),
  updateCaseSheet: (id: string, version: number, sections: Partial<Sections>) =>
    patch<CaseSheet>(`/api/case-sheets/${id}`, { version, sections }),
  refreshSummaries: (id: string) => post<CaseSheet['summaries']>(`/api/case-sheets/${id}/summaries`),
  approve: (id: string, version: number) => post<CaseSheet>(`/api/case-sheets/${id}/approve`, { version, confirm_reviewed: true }),
  audit: (id: string) => get<{ at: string; action: string; user_name: string; user_role: string }[]>(`/api/case-sheets/${id}/audit`),
}

export interface DashboardData {
  role: Role
  stats?: { patients: number; completed: number; drafts: number; approved: number }
  live?: Consultation[]
  upcoming: Consultation[]
  awaiting_approval?: Consultation[]
  recent_approved?: Consultation[]
  past?: Consultation[]
}

/**
 * WebSocket URL with a one-minute ticket. The long-lived session token never appears in a URL
 * (URLs are written to proxy and server access logs).
 */
export async function wsUrl(path: string, consultationId?: string): Promise<string> {
  const { ticket } = await api.wsTicket(consultationId)
  let configuredWs = (
    (typeof window !== 'undefined' ? localStorage.getItem('MEDTRUST_WS_URL') : null) ||
    (import.meta.env.VITE_WS_BASE_URL as string | undefined)
  )?.replace(/\/$/, '')
  if (!configuredWs && typeof window !== 'undefined' && window.location.hostname.endsWith('vercel.app')) {
    configuredWs = DEFAULT_REMOTE_WS
  }
  if (configuredWs) {
    return `${configuredWs}${path}${path.includes('?') ? '&' : '?'}ticket=${encodeURIComponent(ticket)}`
  }
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}${path}${path.includes('?') ? '&' : '?'}ticket=${encodeURIComponent(ticket)}`
}
