// ─── Types ───────────────────────────────────────────────────────────────────

export type UserRole = 'doctor' | 'patient'

export interface User {
  uid: string
  email: string
  displayName: string
  role: UserRole
  photoURL?: string
  specialization?: string
  licenseNumber?: string
  department?: string
}

export interface Patient {
  id: string
  name: string
  dob: string
  age: number
  gender: 'male' | 'female' | 'other'
  phone: string
  email?: string
  bloodGroup?: string
  address?: string
  allergies: string[]
  conditions: string[]
  emergencyContact?: string
  createdAt: string
  updatedAt: string
}

export interface TranscriptEntry {
  id: string
  speaker: 'doctor' | 'patient' | 'unknown'
  text: string
  timestamp: number
  language?: string
}

export interface MedicationRow {
  name: string
  dosage: string
  frequency: string
  duration: string
}

export interface CaseSheet {
  id: string
  consultationId: string
  patientId: string
  patientName: string
  doctorId: string
  doctorName: string
  generatedAt: string
  approvedAt?: string
  approvedBy?: string
  isApproved: boolean
  isReadOnly: boolean

  // 17 Sections
  patientInfo: {
    name: string
    age: string
    gender: string
    bloodGroup: string
    phone: string
    address: string
  }
  chiefComplaint: string
  hpi: string
  symptoms: string[]
  duration: string
  pastMedicalHistory: string
  medications: MedicationRow[]
  allergies: string[]
  familyHistory: string
  socialHistory: string
  doctorObservations: string
  investigations: string[]
  assessment: string
  treatmentPlan: string
  followUp: string
  missingInformation: string[]
  uncertainInformation: string[]

  // Summary translations
  summaries?: {
    en?: string
    ta?: string
    hi?: string
    te?: string
    ml?: string
    kn?: string
  }
}

export interface Consultation {
  id: string
  patientId: string
  patientName: string
  doctorId: string
  doctorName: string
  meetLink?: string
  status: 'scheduled' | 'active' | 'completed' | 'cancelled'
  startedAt?: string
  endedAt?: string
  duration?: number
  transcript: TranscriptEntry[]
  caseSheetId?: string
  createdAt: string
  specialty?: string
  reason?: string
}

export interface DashboardStats {
  totalPatients: number
  consultationsToday: number
  approvedSheets: number
  pendingReview: number
}
