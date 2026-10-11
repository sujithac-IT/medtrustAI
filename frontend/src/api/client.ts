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

let onUnauthorized: (() => void) | null = null
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn }

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const d = (body as { detail: unknown }).detail
    if (typeof d === 'string') return d
    if (Array.isArray(d)) return d.map((e: { loc?: string[]; msg?: string }) => `${(e.loc ?? []).slice(1).join('.')}: ${e.msg}`).join('; ')
  }
  return fallback
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let res: Response
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'Cannot reach the MedTrust server. Check your connection.')
  }
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.()
    throw new ApiError(res.status, errorMessage(data, `${res.status} ${res.statusText}`))
  }
  return data as T
}

const get = <T,>(p: string) => request<T>('GET', p)
const post = <T,>(p: string, b?: unknown) => request<T>('POST', p, b ?? {})
const patch = <T,>(p: string, b: unknown) => request<T>('PATCH', p, b)

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
  startConsultation: (id: string) => post<Consultation>(`/api/consultations/${id}/start`),
  endConsultation: (id: string) => post<Consultation>(`/api/consultations/${id}/end`),
  transcript: (id: string) => get<Segment[]>(`/api/consultations/${id}/transcript`),
  addSegment: (id: string, b: { text: string; client_id?: string; language?: string; speaker_role?: Role }) =>
    post<Segment>(`/api/consultations/${id}/transcript`, b),
  scenarios: () => get<Scenario[]>('/api/consultations/demo/scenarios'),
  loadDemo: (id: string, scenario: string) => post<{ added: number }>(`/api/consultations/${id}/transcript/demo`, { scenario }),
  importGoogle: (id: string) => post<{ imported: number; total_entries: number }>(`/api/consultations/${id}/transcript/import-google`),

  generateCaseSheet: (cid: string) => post<CaseSheet>(`/api/consultations/${cid}/case-sheet`),
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

export function wsUrl(path: string): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(tokenStore.get() ?? '')}`
}
