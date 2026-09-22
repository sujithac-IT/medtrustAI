/**
 * MedTrust AI - Real-Time Consultation & Waiting Room Synchronization Service
 * 
 * Provides synchronization between Doctor (Permanent Host) and Patient (Waiting Room)
 * Supports unique Google Meet link generation, session states, and admission events.
 */

export interface WaitingPatient {
  id: string
  meetingCode: string
  name: string
  mrn: string
  age: number
  gender: string
  chiefComplaint: string
  joinedAt: number
  status: 'waiting' | 'admitted' | 'declined' | 'in_session'
  micReady: boolean
  cameraReady: boolean
}

export interface NvidiaEffectsConfig {
  virtualBackground: boolean
  studioLighting: boolean
  eyeContactGaze: boolean
  superResolution: boolean
  noiseRemoval: boolean
  echoCancellation: boolean
  gpuModel: string
  tensorRtLatencyMs: number
}

const STORAGE_KEY_PATIENTS = 'medtrust_waiting_patients'
const STORAGE_KEY_ROOM_STATUS = 'medtrust_room_status_'
const SYNC_CHANNEL_NAME = 'medtrust_consultation_sync'

// BroadcastChannel for instant multi-tab synchronization
let channel: BroadcastChannel | null = null
try {
  channel = new BroadcastChannel(SYNC_CHANNEL_NAME)
} catch {
  // Fallback if BroadcastChannel unavailable
}

export function getWaitingPatients(meetingCode: string = 'abc-defg-hij'): WaitingPatient[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_PATIENTS)
    if (!data) {
      // Seed default demo patient in waiting room
      const initial: WaitingPatient[] = [
        {
          id: 'pat-sundaram',
          meetingCode: 'abc-defg-hij',
          name: 'K. Sundaram',
          mrn: 'MT-2026-0841',
          age: 58,
          gender: 'Male',
          chiefComplaint: 'Exertional chest pain & dry cough',
          joinedAt: Date.now() - 120000,
          status: 'waiting',
          micReady: true,
          cameraReady: true,
        },
      ]
      localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(initial))
      return initial.filter(p => p.meetingCode === meetingCode && p.status === 'waiting')
    }
    const parsed: WaitingPatient[] = JSON.parse(data)
    return parsed.filter(p => p.meetingCode === meetingCode && p.status === 'waiting')
  } catch {
    return []
  }
}

export function registerPatientInWaitingRoom(patient: Omit<WaitingPatient, 'joinedAt' | 'status'>): WaitingPatient {
  const all: WaitingPatient[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PATIENTS) || '[]')
  const existingIdx = all.findIndex(p => p.id === patient.id && p.meetingCode === patient.meetingCode)
  
  const fullPatient: WaitingPatient = {
    ...patient,
    joinedAt: Date.now(),
    status: 'waiting',
  }

  if (existingIdx >= 0) {
    all[existingIdx] = fullPatient
  } else {
    all.push(fullPatient)
  }

  localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(all))
  notifySync({ type: 'PATIENT_JOINED_WAITING_ROOM', patient: fullPatient })
  return fullPatient
}

export function admitPatientToSession(meetingCode: string, patientId: string) {
  const all: WaitingPatient[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PATIENTS) || '[]')
  const target = all.find(p => p.id === patientId && p.meetingCode === meetingCode)
  if (target) {
    target.status = 'admitted'
    localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(all))
    localStorage.setItem(STORAGE_KEY_ROOM_STATUS + meetingCode, JSON.stringify({
      status: 'active',
      admittedPatientId: patientId,
      timestamp: Date.now(),
    }))
    notifySync({ type: 'PATIENT_ADMITTED', meetingCode, patientId })
  }
}

export function checkPatientSessionStatus(meetingCode: string, patientId: string): 'waiting' | 'admitted' | 'declined' {
  try {
    const all: WaitingPatient[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PATIENTS) || '[]')
    const target = all.find(p => p.id === patientId && p.meetingCode === meetingCode)
    if (target) return target.status as any
    const room = localStorage.getItem(STORAGE_KEY_ROOM_STATUS + meetingCode)
    if (room) {
      const parsed = JSON.parse(room)
      if (parsed.admittedPatientId === patientId) return 'admitted'
    }
  } catch {}
  return 'waiting'
}

function notifySync(message: any) {
  try {
    channel?.postMessage(message)
  } catch {}
}

export function subscribeToConsultationSync(callback: (msg: any) => void) {
  if (!channel) return () => {}
  const handler = (event: MessageEvent) => {
    callback(event.data)
  }
  channel.addEventListener('message', handler)
  return () => {
    channel?.removeEventListener('message', handler)
  }
}

// Default NVIDIA Maxine & AI Acceleration Configuration
export const DEFAULT_NVIDIA_CONFIG: NvidiaEffectsConfig = {
  virtualBackground: true,
  studioLighting: true,
  eyeContactGaze: true,
  superResolution: true,
  noiseRemoval: true,
  echoCancellation: true,
  gpuModel: 'NVIDIA RTX 6000 Ada / L4 Tensor Core GPU',
  tensorRtLatencyMs: 14.8,
}
