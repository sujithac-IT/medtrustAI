export type Role = 'doctor' | 'student' | 'patient'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  registration_number?: string | null
  specialization?: string | null
  designation?: string | null
  patient_id?: string | null
}

export interface Patient {
  id: string
  mrn: string
  first_name: string
  last_name: string
  full_name: string
  date_of_birth: string
  age: number | null
  gender: string
  blood_group?: string | null
  phone: string
  email?: string | null
  address?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  allergies: string[]
  conditions: string[]
  created_at: string
  updated_at: string
}

export interface MeetInfo {
  provider: 'in_app' | 'google_meet'
  meeting_uri?: string
  meeting_code?: string
  space_name?: string
  calendar_html_link?: string
  google_error?: string
}

export interface Consultation {
  id: string
  room_code: string
  join_path: string
  patient_id: string
  patient_name: string
  patient_mrn: string
  doctor_id: string
  doctor_name: string
  doctor_specialization?: string
  student_id?: string | null
  student_name?: string | null
  reason?: string | null
  scheduled_at: string
  status: 'scheduled' | 'live' | 'completed' | 'cancelled'
  started_at?: string | null
  ended_at?: string | null
  duration_seconds?: number | null
  case_sheet_id?: string | null
  case_sheet_status?: 'draft' | 'approved' | null
  segment_count: number
  meet: MeetInfo
  presence?: { admitted: number; waiting: number }
  ice_servers?: RTCIceServer[]
}

export interface Segment {
  id: string
  client_id: string
  speaker_role: Role
  speaker_user_id?: string | null
  speaker_name: string
  text: string
  language: string
  offset_ms: number
  source: 'live' | 'manual' | 'demo' | 'google_meet'
  created_at: string
}

export interface Medication { name: string; dose: string; frequency: string; route: string; duration: string; instructions: string }
export interface Symptom { name: string; severity: string; duration: string; notes: string }
export interface Vitals { blood_pressure: string; pulse: string; temperature: string; spo2: string; respiratory_rate: string; weight: string }

export interface Sections {
  patient_info: Record<string, string | number | null>
  chief_complaint: string
  history_of_present_illness: string
  symptoms: Symptom[]
  duration: string
  past_medical_history: string[]
  medications: Medication[]
  allergies: string[]
  family_history: string
  social_history: string
  doctor_observations: { summary: string; vitals: Vitals }
  investigations: string[]
  assessment: string
  treatment_plan: string
  follow_up: string
  missing_information: string[]
  uncertain_information: string[]
}

export interface Approval {
  approved_by: User
  approved_at: string
  content_hash: string
  statement: string
}

export interface CaseSheet {
  id: string
  consultation_id: string
  patient_id: string
  status: 'draft' | 'approved'
  version: number
  source: 'gemini' | 'local'
  sections: Sections
  summaries: { machine_translated: boolean; source: string; texts: Record<string, string> }
  approval: Approval | null
  content_hash?: string | null
  created_at: string
  updated_at: string
  section_titles: Record<string, string>
  section_order: (keyof Sections)[]
}

export interface CaseSheetListItem {
  id: string
  consultation_id: string
  patient_id: string
  patient_name: string
  patient_mrn: string
  doctor_name: string
  status: 'draft' | 'approved'
  version: number
  source: string
  chief_complaint: string
  assessment: string
  scheduled_at: string
  updated_at: string
  approval: Approval | null
}

export interface Scenario { key: string; title: string; specialty: string; patient_name: string; chief_complaint: string; turn_count: number }
