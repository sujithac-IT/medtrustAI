import React from 'react'

interface IconProps {
  size?: number
  color?: string
  style?: React.CSSProperties
  className?: string
}

// 1. Stethoscope Icon
export const StethoscopeIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <path d="M4.5 3v5a5.5 5.5 0 0 0 11 0V3" />
    <path d="M3 3h3" />
    <path d="M14 3h3" />
    <path d="M10 13.5v3.5a4 4 0 0 0 4 4h1a3 3 0 0 0 3-3v-1" />
    <circle cx="18" cy="14" r="2.5" fill={color} fillOpacity="0.2" />
  </svg>
)

// 2. Hospital / Caduceus Medical Cross Icon
export const HospitalCrossIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <path d="M12 4v16" />
    <path d="M4 12h16" />
    <rect x="2" y="2" width="20" height="20" rx="6" strokeWidth="1.75" />
  </svg>
)

// 3. ECG Pulse / Vitals Icon
export const PulseIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <path d="M3 12h4l2.5-7 4 14 3-9 2.5 4h5" />
  </svg>
)

// 4. Prescription / Rx Pill Capsule Icon
export const PillIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
    <path d="m8.5 8.5 7 7" />
  </svg>
)

// 5. Clinical Case Sheet / Medical Clipboard Icon
export const ClipboardMedicalIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M12 11h4" />
    <path d="M12 16h4" />
    <path d="M8 11h.01" />
    <path d="M8 16h.01" />
  </svg>
)

// 6. Video Camera (Google Meet style)
export const VideoMeetIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <path d="m16 10 5.3-3.6A1 1 0 0 1 23 7.2v9.6a1 1 0 0 1-1.7.8L16 14" />
    <rect width="13" height="14" x="2" y="5" rx="3" />
  </svg>
)

// 7. Video Camera Off Icon
export const VideoOffIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <path d="M2 2l20 20" />
    <path d="m16 10 5.3-3.6A1 1 0 0 1 23 7.2v9.6a1 1 0 0 1-1.7.8L16 14" />
    <path d="M10.4 5H13a2 2 0 0 1 2 2v2.6" />
    <path d="M3 7v10a2 2 0 0 0 2 2h10" />
  </svg>
)

// 8. Microphone Icon
export const MicIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
)

// 9. Microphone Mute Icon
export const MicOffIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <line x1="2" x2="22" y1="2" y2="22" />
    <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
    <path d="M5 10v2a7 7 0 0 0 12 5" />
    <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
)

// 10. Waiting Room / Clock Hourglass Icon
export const WaitingRoomIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

// 11. Doctor Host Badge Icon
export const DoctorHostIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 11l-3 3-2-2" />
    <circle cx="19" cy="12" r="4" strokeWidth="1.5" />
  </svg>
)

// 12. Patient User Icon
export const PatientIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

// 13. NVIDIA AI Processor Badge Icon
export const NvidiaIcon: React.FC<IconProps> = ({ size = 20, color = '#76B900', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M8 12c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4" />
    <path d="M8 8.5C9 7.5 10.4 7 12 7c2.8 0 5 2.2 5 5" />
    <circle cx="12" cy="12" r="1.5" fill={color} />
  </svg>
)

// 14. Lock Room Icon
export const LockIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

// 15. Sparkles / AI Scribe Icon
export const SparklesIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
  </svg>
)

// 16. Multilingual Language Globe Icon
export const GlobeLanguageIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" x2="22" y1="12" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
)

// 17. Shield / HIPAA Security Icon
export const ShieldCheckIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)

// 18. End Call Phone Hangup Icon
export const PhoneOffIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.8 19.8 0 0 1-3.12-8.68A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </svg>
)

// 19. Screen Share Icon
export const ScreenShareIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <rect width="18" height="12" x="3" y="4" rx="2" />
    <line x1="8" x2="16" y1="20" y2="20" />
    <line x1="12" x2="12" y1="16" y2="20" />
    <path d="m10 9 2-2 2 2" />
    <line x1="12" x2="12" y1="7" y2="13" />
  </svg>
)

// 20. FHIR / Health Interoperability Icon
export const FhirIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
)

// 21. Camera Icon (Hardware Video)
export const CameraIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <path d="M23 7l-7 5 7 5V7z" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
)

// 22. Camera Off Icon
export const CameraOffIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M21 15.5l2 1.5V7l-7 5 1.5 1.1" />
    <path d="M1 5a2 2 0 0 1 2-2h1.5" />
    <path d="M9 3h7a2 2 0 0 1 2 2v10" />
    <path d="M3 7v12a2 2 0 0 0 2 2h12" />
  </svg>
)

// 23. Check Circle Icon
export const CheckCircleIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)

// 24. Clock Icon
export const ClockIcon: React.FC<IconProps> = ({ size = 20, color = 'currentColor', style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

