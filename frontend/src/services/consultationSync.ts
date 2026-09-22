/**
 * MedTrust AI - Real-Time Consultation & Google Meet Synchronization Service
 * 
 * Supports:
 * 1. Linked Email IDs for Doctor & Patient (Google Calendar / Meet)
 * 2. Multi-tab WebRTC / Media stream signaling
 * 3. YouTube-style multilingual live captions with automatic English translation
 * 4. Waiting room admission & host control synchronization
 */

export interface WaitingPatient {
  id: string
  meetingCode: string
  name: string
  email: string
  doctorEmail: string
  mrn: string
  age: number
  gender: string
  chiefComplaint: string
  joinedAt: number
  status: 'waiting' | 'admitted' | 'declined' | 'in_session'
  micReady: boolean
  cameraReady: boolean
  hasLiveWebcam?: boolean
}

export interface LiveCaptionItem {
  id: string
  speaker: 'doctor' | 'patient'
  speakerName: string
  originalLanguage: string
  originalText: string
  englishTranslation: string
  timestamp: number
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

let channel: BroadcastChannel | null = null
try {
  channel = new BroadcastChannel(SYNC_CHANNEL_NAME)
} catch {
  // BroadcastChannel fallback
}

export const DEFAULT_DOCTOR_EMAIL = 'dr.sharma@medtrust.hospital.org'
export const DEFAULT_PATIENT_EMAIL = 'sundaram.k@gmail.com'

export function generateGoogleCalendarUrl(
  meetingCode: string,
  doctorEmail: string = DEFAULT_DOCTOR_EMAIL,
  patientEmail: string = DEFAULT_PATIENT_EMAIL,
  patientName: string = 'K. Sundaram'
): string {
  const title = encodeURIComponent(`Apollo MedTrust Telehealth Consultation - ${patientName}`)
  const details = encodeURIComponent(
    `Virtual Doctor Consultation with Dr. Rajesh Sharma, MD.\n\nJoin Link: https://meet.google.com/${meetingCode}\nPatient: ${patientName} (${patientEmail})\nDoctor: Dr. Rajesh Sharma (${doctorEmail})\n\nABDM Compliant EMR Platform.`
  )
  const attendees = encodeURIComponent(`${patientEmail},${doctorEmail}`)
  return `https://calendar.google.com/calendar/r/eventedit?text=${title}&details=${details}&add=${attendees}`
}

export function generatePatientMeetingUrl(
  meetingCode: string = 'abc-defg-hij',
  doctorEmail: string = DEFAULT_DOCTOR_EMAIL,
  patientEmail: string = DEFAULT_PATIENT_EMAIL
): string {
  const origin = window.location.origin
  return `${origin}/meet/${meetingCode}?docEmail=${encodeURIComponent(doctorEmail)}&patEmail=${encodeURIComponent(patientEmail)}`
}

export function getWaitingPatients(meetingCode: string = 'abc-defg-hij'): WaitingPatient[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_PATIENTS)
    if (!data) {
      const initial: WaitingPatient[] = [
        {
          id: 'pat-sundaram',
          meetingCode: 'abc-defg-hij',
          name: 'K. Sundaram',
          email: DEFAULT_PATIENT_EMAIL,
          doctorEmail: DEFAULT_DOCTOR_EMAIL,
          mrn: 'MT-2026-0841',
          age: 58,
          gender: 'Male',
          chiefComplaint: 'Retrosternal chest heaviness & dry cough',
          joinedAt: Date.now() - 120000,
          status: 'waiting',
          micReady: true,
          cameraReady: true,
        },
      ]
      localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(initial))
      return initial.filter((p) => p.meetingCode === meetingCode && p.status === 'waiting')
    }
    const parsed: WaitingPatient[] = JSON.parse(data)
    return parsed.filter((p) => p.meetingCode === meetingCode && p.status === 'waiting')
  } catch {
    return []
  }
}

export function registerPatientInWaitingRoom(
  patient: Omit<WaitingPatient, 'joinedAt' | 'status'>
): WaitingPatient {
  const all: WaitingPatient[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PATIENTS) || '[]')
  const existingIdx = all.findIndex((p) => p.id === patient.id && p.meetingCode === patient.meetingCode)

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
  const target = all.find((p) => p.id === patientId && p.meetingCode === meetingCode)
  if (target) {
    target.status = 'admitted'
    localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(all))
    localStorage.setItem(
      STORAGE_KEY_ROOM_STATUS + meetingCode,
      JSON.stringify({
        status: 'active',
        admittedPatientId: patientId,
        timestamp: Date.now(),
      })
    )
    notifySync({ type: 'PATIENT_ADMITTED', meetingCode, patientId })
  }
}

export function checkPatientSessionStatus(
  meetingCode: string,
  patientId: string
): 'waiting' | 'admitted' | 'declined' {
  try {
    const all: WaitingPatient[] = JSON.parse(localStorage.getItem(STORAGE_KEY_PATIENTS) || '[]')
    const target = all.find((p) => p.id === patientId && p.meetingCode === meetingCode)
    if (target) return target.status as any
    const room = localStorage.getItem(STORAGE_KEY_ROOM_STATUS + meetingCode)
    if (room) {
      const parsed = JSON.parse(room)
      if (parsed.admittedPatientId === patientId) return 'admitted'
    }
  } catch {}
  return 'waiting'
}

export function broadcastLiveCaption(caption: LiveCaptionItem) {
  notifySync({ type: 'LIVE_CAPTION', caption })
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

export const DEFAULT_NVIDIA_CONFIG: NvidiaEffectsConfig = {
  virtualBackground: true,
  studioLighting: true,
  eyeContactGaze: true,
  superResolution: true,
  noiseRemoval: true,
  echoCancellation: true,
  gpuModel: 'NVIDIA RTX 6000 Ada / L4 Tensor Core GPU',
  tensorRtLatencyMs: 14.2,
}
