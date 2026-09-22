import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  VideoMeetIcon,
  DoctorHostIcon,
  WaitingRoomIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
} from '../components/MedicalIcons'

export default function LoginPage() {
  const { demoLogin } = useAuth()
  const navigate = useNavigate()
  const [meetingCode, setMeetingCode] = useState('')

  const handleDoctorLogin = (name: string, email: string) => {
    // Single-click Google Meet Doctor Sign-in
    const doctorUser = {
      uid: email.includes('jenkins') ? 'doc-jenkins-02' : 'doc-sharma-01',
      email,
      displayName: name,
      role: 'doctor' as const,
      specialization: email.includes('jenkins') ? 'Emergency & Internal Medicine' : 'Cardiology & Telemedicine',
      licenseNumber: email.includes('jenkins') ? 'MCI-91823' : 'MCI-84920',
      department: email.includes('jenkins') ? 'Internal Medicine' : 'Cardiology',
    }
    localStorage.setItem('medtrust_demo_user', JSON.stringify(doctorUser))
    demoLogin('doctor')
    navigate('/consultation')
  }

  const handlePatientJoin = (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = meetingCode.trim().replace(/^https?:\/\/[^/]+\/(waiting-room\/|meet\/)?/, '')
    if (!cleaned) return
    navigate(`/waiting-room/${cleaned}`)
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#FFFFFF',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: "'Inter', 'Roboto', -apple-system, sans-serif",
      color: '#202124',
    }}>
      {/* Google Meet Style Login Card */}
      <div style={{
        width: '100%',
        maxWidth: 480,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        border: '1px solid #DADCE0',
        padding: '36px 32px',
        boxShadow: '0 2px 10px rgba(60,64,67,0.15)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        {/* Google Meet Header Icon */}
        <div style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: 'linear-gradient(135deg, #1A73E8 0%, #007A64 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          marginBottom: 16,
          boxShadow: '0 2px 8px rgba(26,115,232,0.3)',
        }}>
          <VideoMeetIcon size={28} color="#FFFFFF" />
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#202124', margin: 0, textAlign: 'center' }}>
          Google Meet Telehealth
        </h1>
        <p style={{ fontSize: 13, color: '#5F6368', marginTop: 6, marginBottom: 28, textAlign: 'center' }}>
          Select your Doctor account to host or enter a meeting code to join as patient
        </p>

        {/* ─── DOCTOR HOST SINGLE-CLICK SIGN-IN (GOOGLE SSO) ─── */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1A73E8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Doctor Host Accounts (Instant Sign-in)
          </div>

          {/* Doctor 1: Dr. Rajesh Sharma */}
          <button
            onClick={() => handleDoctorLogin('Dr. Rajesh Sharma, MD', 'dr.sharma@medtrust.hospital.org')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: '#F8FAFD',
              border: '1px solid #DADCE0',
              borderRadius: 12,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#E8F0FE'
              e.currentTarget.style.borderColor = '#1A73E8'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#F8FAFD'
              e.currentTarget.style.borderColor = '#DADCE0'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: '#1A73E8',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                RS
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#202124' }}>
                  Dr. Rajesh Sharma, MD
                </div>
                <div style={{ fontSize: 12, color: '#5F6368' }}>
                  dr.sharma@medtrust.hospital.org • Host
                </div>
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1A73E8' }}>Host &rarr;</span>
          </button>

          {/* Doctor 2: Dr. Sarah Jenkins */}
          <button
            onClick={() => handleDoctorLogin('Dr. Sarah Jenkins, MD', 'dr.jenkins@medtrust.hospital.org')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: '#F8FAFD',
              border: '1px solid #DADCE0',
              borderRadius: 12,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#E8F0FE'
              e.currentTarget.style.borderColor = '#1A73E8'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#F8FAFD'
              e.currentTarget.style.borderColor = '#DADCE0'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: '#007A64',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                SJ
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#202124' }}>
                  Dr. Sarah Jenkins, MD
                </div>
                <div style={{ fontSize: 12, color: '#5F6368' }}>
                  dr.jenkins@medtrust.hospital.org • Host
                </div>
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1A73E8' }}>Host &rarr;</span>
          </button>
        </div>

        {/* Divider */}
        <div style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          margin: '12px 0 20px 0',
          color: '#80868B',
          fontSize: 12,
        }}>
          <div style={{ flex: 1, height: 1, backgroundColor: '#E8EAED' }} />
          <span>OR JOIN AS PATIENT</span>
          <div style={{ flex: 1, height: 1, backgroundColor: '#E8EAED' }} />
        </div>

        {/* ─── PATIENT JOIN BY MEETING CODE (NO LOGIN REQUIRED) ─── */}
        <form onSubmit={handlePatientJoin} style={{ width: '100%' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: 12, top: 11, color: '#5F6368' }}>
                <WaitingRoomIcon size={18} color="#5F6368" />
              </span>
              <input
                type="text"
                placeholder="Enter meeting code or link"
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  borderRadius: 8,
                  border: '1px solid #DADCE0',
                  fontSize: 13,
                  outline: 'none',
                  color: '#202124',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={!meetingCode.trim()}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                backgroundColor: meetingCode.trim() ? '#1A73E8' : '#F1F3F4',
                color: meetingCode.trim() ? '#FFFFFF' : '#9AA0A6',
                border: 'none',
                fontWeight: 600,
                fontSize: 13,
                cursor: meetingCode.trim() ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
              }}
            >
              Join
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10, fontSize: 11, color: '#5F6368' }}>
            <span>Sample patient links:</span>
            <span
              style={{ color: '#1A73E8', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => setMeetingCode('abc-defg-hij')}
            >
              abc-defg-hij
            </span>
            <span>•</span>
            <span
              style={{ color: '#1A73E8', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => setMeetingCode('dr-sarah-cardiology')}
            >
              dr-sarah-cardiology
            </span>
          </div>
        </form>

        {/* Trust Badges */}
        <div style={{
          marginTop: 28,
          paddingTop: 16,
          borderTop: '1px solid #F1F3F4',
          width: '100%',
          display: 'flex',
          justifyContent: 'space-around',
          fontSize: 11,
          color: '#5F6368',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircleIcon size={14} color="#188038" />
            ABDM Certified (M1/M2/M3)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ShieldCheckIcon size={14} color="#1A73E8" />
            HIPAA Compliant
          </span>
        </div>
      </div>
    </div>
  )
}
