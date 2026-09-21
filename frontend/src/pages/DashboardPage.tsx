import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Consultation, Patient, DashboardStats } from '../types'

// Demo data
const DEMO_PATIENTS: Patient[] = [
  { id: 'p1', name: 'Arjun Krishnamurthy', dob: '1985-06-15', age: 39, gender: 'male', phone: '+91 98765 43210', bloodGroup: 'B+', allergies: ['Penicillin'], conditions: ['Hypertension'], createdAt: '2024-01-10', updatedAt: '2024-09-20' },
  { id: 'p2', name: 'Priya Sundaram', dob: '1992-03-22', age: 32, gender: 'female', phone: '+91 87654 32109', bloodGroup: 'O+', allergies: [], conditions: ['Type 2 Diabetes'], createdAt: '2024-02-15', updatedAt: '2024-09-18' },
  { id: 'p3', name: 'Ravi Shankar', dob: '1970-11-08', age: 54, gender: 'male', phone: '+91 76543 21098', bloodGroup: 'A+', allergies: ['Sulfa'], conditions: ['COPD', 'Hypertension'], createdAt: '2024-03-01', updatedAt: '2024-09-15' },
  { id: 'p4', name: 'Meena Devi', dob: '1998-07-30', age: 26, gender: 'female', phone: '+91 65432 10987', bloodGroup: 'AB-', allergies: [], conditions: [], createdAt: '2024-04-20', updatedAt: '2024-09-10' },
]

const DEMO_CONSULTATIONS: Consultation[] = [
  { id: 'c1', patientId: 'p1', patientName: 'Arjun Krishnamurthy', doctorId: 'demo-doctor-001', doctorName: 'Dr. Rajesh Kumar', status: 'completed', startedAt: '2024-09-20T10:00:00Z', endedAt: '2024-09-20T10:35:00Z', duration: 35, transcript: [], caseSheetId: 'cs1', createdAt: '2024-09-20', reason: 'Chest pain evaluation' },
  { id: 'c2', patientId: 'p2', patientName: 'Priya Sundaram', doctorId: 'demo-doctor-001', doctorName: 'Dr. Rajesh Kumar', status: 'completed', startedAt: '2024-09-20T11:30:00Z', endedAt: '2024-09-20T12:00:00Z', duration: 30, transcript: [], caseSheetId: 'cs2', createdAt: '2024-09-20', reason: 'Diabetes follow-up' },
  { id: 'c3', patientId: 'p3', patientName: 'Ravi Shankar', doctorId: 'demo-doctor-001', doctorName: 'Dr. Rajesh Kumar', status: 'scheduled', transcript: [], createdAt: '2024-09-21', reason: 'COPD management' },
]

function StatCard({ value, label, icon, color, change }: { value: number | string; label: string; icon: string; color: string; change?: string }) {
  return (
    <div className={`stat-card ${color}`} style={{ animation: 'slideUp 0.4s ease' }}>
      <div className={`stat-icon ${color}`} style={{ fontSize: 22 }}>{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {change && <div className={`stat-change up`}>↑ {change}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats] = useState<DashboardStats>({ totalPatients: 248, consultationsToday: 7, approvedSheets: 183, pendingReview: 3 })

  const isDoctor = user?.role === 'doctor'

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="section-title">
            Good morning, {user?.displayName?.split(' ')[0]} 👋
          </h1>
          <p className="section-subtitle">
            {isDoctor ? "Here's your clinical overview for today" : "Your health consultation dashboard"}
          </p>
        </div>
        <button
          id="new-consultation-btn"
          className="btn btn-primary"
          onClick={() => navigate('/consultation')}
          style={{ gap: 8 }}
        >
          <span>📹</span>
          {isDoctor ? 'Start Consultation' : 'Join Consultation'}
        </button>
      </div>

      {/* Stats grid */}
      {isDoctor && (
        <div className="grid grid-4" style={{ marginBottom: 32 }}>
          <StatCard value={stats.totalPatients} label="Total Patients" icon="👥" color="teal" change="12 this month" />
          <StatCard value={stats.consultationsToday} label="Today's Consultations" icon="📹" color="blue" change="2 from yesterday" />
          <StatCard value={stats.approvedSheets} label="Approved Case Sheets" icon="✅" color="green" />
          <StatCard value={stats.pendingReview} label="Pending Review" icon="⏳" color="amber" />
        </div>
      )}

      {/* Main content grid */}
      <div className="grid grid-2" style={{ marginBottom: 32 }}>
        {/* Recent consultations */}
        <div className="card" style={{ gridColumn: isDoctor ? '1' : '1 / -1' }}>
          <div className="card-header">
            <div className="card-title">
              <span>📋</span> Recent Consultations
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/history')}>View all →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DEMO_CONSULTATIONS.map(c => (
              <div
                key={c.id}
                onClick={() => c.caseSheetId && navigate(`/case-sheet/${c.caseSheetId}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  background: 'var(--color-bg-glass)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  cursor: c.caseSheetId ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                }}
                onMouseOver={e => { if (c.caseSheetId) (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border-hover)' }}
                onMouseOut={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'}
              >
                <div className="avatar avatar-teal" style={{ fontSize: 15 }}>
                  {c.patientName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>{c.patientName}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{c.reason}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span className={`badge ${c.status === 'completed' ? 'badge-success' : c.status === 'scheduled' ? 'badge-info' : 'badge-warning'} badge-dot`}>
                    {c.status}
                  </span>
                  {c.duration && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.duration} min</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Patient list (doctor only) */}
        {isDoctor && (
          <div className="card">
            <div className="card-header">
              <div className="card-title"><span>👥</span> Active Patients</div>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/patients')}>Manage →</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DEMO_PATIENTS.slice(0, 4).map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'background 0.15s',
                  cursor: 'pointer',
                }}
                  onMouseOver={e => (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-glass)'}
                  onMouseOut={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  onClick={() => navigate(`/history/${p.id}`)}
                >
                  <div className="avatar avatar-teal" style={{ fontSize: 13, width: 34, height: 34 }}>
                    {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{p.age}y · {p.bloodGroup} · {p.conditions.join(', ') || 'No conditions'}</div>
                  </div>
                  {p.allergies.length > 0 && (
                    <span className="badge badge-warning" style={{ fontSize: 10 }}>⚠ Allergy</span>
                  )}
                </div>
              ))}
              <button
                className="btn btn-secondary"
                style={{ marginTop: 8, width: '100%' }}
                onClick={() => navigate('/patients')}
              >
                + Add New Patient
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span>⚡</span> Quick Actions</div>
        </div>
        <div className="grid grid-4">
          {[
            { icon: '📹', label: 'New Video Consultation', desc: 'Start live meeting', action: () => navigate('/consultation'), color: 'teal' },
            { icon: '👥', label: 'Add Patient', desc: 'Register new patient', action: () => navigate('/patients'), color: 'blue' },
            { icon: '📋', label: 'View History', desc: 'Past consultations', action: () => navigate('/history'), color: 'green' },
            { icon: '🤖', label: 'AI Demo', desc: 'Try case sheet AI', action: () => navigate('/consultation'), color: 'amber' },
          ].map((a, i) => (
            <button
              key={i}
              onClick={a.action}
              style={{
                padding: 20,
                background: 'var(--color-bg-glass)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 8,
                transition: 'all 0.2s',
                textAlign: 'left',
              }}
              onMouseOver={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--color-border-hover)'; el.style.transform = 'translateY(-2px)' }}
              onMouseOut={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--color-border)'; el.style.transform = 'translateY(0)' }}
            >
              <span style={{ fontSize: 28 }}>{a.icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 2 }}>{a.label}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{a.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
