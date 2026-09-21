import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Patient } from '../types'

const INITIAL_PATIENTS: Patient[] = [
  { id: 'p1', name: 'Arjun Krishnamurthy', dob: '1985-06-15', age: 39, gender: 'male', phone: '+91 98765 43210', bloodGroup: 'B+', allergies: ['Penicillin'], conditions: ['Hypertension'], createdAt: '2024-01-10', updatedAt: '2024-09-20' },
  { id: 'p2', name: 'Priya Sundaram', dob: '1992-03-22', age: 32, gender: 'female', phone: '+91 87654 32109', bloodGroup: 'O+', allergies: [], conditions: ['Type 2 Diabetes'], createdAt: '2024-02-15', updatedAt: '2024-09-18' },
  { id: 'p3', name: 'Ravi Shankar', dob: '1970-11-08', age: 54, gender: 'male', phone: '+91 76543 21098', bloodGroup: 'A+', allergies: ['Sulfa'], conditions: ['COPD', 'Hypertension'], createdAt: '2024-03-01', updatedAt: '2024-09-15' },
  { id: 'p4', name: 'Meena Devi', dob: '1998-07-30', age: 26, gender: 'female', phone: '+91 65432 10987', bloodGroup: 'AB-', allergies: [], conditions: [], createdAt: '2024-04-20', updatedAt: '2024-09-10' },
  { id: 'p5', name: 'Suresh Babu', dob: '1960-12-05', age: 63, gender: 'male', phone: '+91 54321 09876', bloodGroup: 'O-', allergies: ['Aspirin', 'NSAIDs'], conditions: ['CAD', 'Hypertension', 'CKD Stage 2'], createdAt: '2024-05-10', updatedAt: '2024-09-12' },
]

function calculateAge(dob: string) {
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

export default function PatientsPage() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState<Patient[]>(() => {
    const saved = localStorage.getItem('medtrust_patients')
    return saved ? JSON.parse(saved) : INITIAL_PATIENTS
  })
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [newPatient, setNewPatient] = useState({
    name: '', dob: '', gender: 'male' as Patient['gender'],
    phone: '', email: '', bloodGroup: 'O+', address: '',
    allergies: '', conditions: '',
  })

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search) ||
    p.conditions.some(c => c.toLowerCase().includes(search.toLowerCase()))
  )

  const savePatients = (list: Patient[]) => {
    setPatients(list)
    localStorage.setItem('medtrust_patients', JSON.stringify(list))
  }

  const addPatient = () => {
    const age = newPatient.dob ? calculateAge(newPatient.dob) : 0
    const patient: Patient = {
      id: `p_${Date.now()}`,
      name: newPatient.name,
      dob: newPatient.dob,
      age,
      gender: newPatient.gender,
      phone: newPatient.phone,
      email: newPatient.email,
      bloodGroup: newPatient.bloodGroup,
      address: newPatient.address,
      allergies: newPatient.allergies ? newPatient.allergies.split(',').map(a => a.trim()).filter(Boolean) : [],
      conditions: newPatient.conditions ? newPatient.conditions.split(',').map(c => c.trim()).filter(Boolean) : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    savePatients([patient, ...patients])
    setShowForm(false)
    setNewPatient({ name: '', dob: '', gender: 'male', phone: '', email: '', bloodGroup: 'O+', address: '', allergies: '', conditions: '' })
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">Patient Management</h1>
          <p className="section-subtitle">{patients.length} registered patients</p>
        </div>
        <button id="new-patient-btn" className="btn btn-primary" onClick={() => setShowForm(true)}>
          + New Patient
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <div className="search-bar">
          <span className="search-icon" style={{ fontSize: 16 }}>🔍</span>
          <input
            id="patient-search"
            className="search-input"
            placeholder="Search by name, phone, condition..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Patient table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Age / Gender</th>
                <th>Blood Group</th>
                <th>Contact</th>
                <th>Conditions</th>
                <th>Allergies</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 40 }}>
                    No patients found. Add your first patient to get started.
                  </td>
                </tr>
              )}
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar avatar-teal" style={{ width: 36, height: 36, fontSize: 13 }}>
                        {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text-primary)' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{p.email || 'No email'}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>{p.age} years</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{p.gender}</div>
                  </td>
                  <td>
                    <span className="badge badge-blue">{p.bloodGroup || '—'}</span>
                  </td>
                  <td style={{ fontSize: 13 }}>{p.phone}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {p.conditions.length === 0
                        ? <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>None</span>
                        : p.conditions.map(c => <span key={c} className="badge badge-muted" style={{ fontSize: 11 }}>{c}</span>)
                      }
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {p.allergies.length === 0
                        ? <span style={{ fontSize: 12, color: 'var(--color-success)', fontWeight: 600 }}>NKDA</span>
                        : p.allergies.map(a => <span key={a} className="badge badge-warning" style={{ fontSize: 11 }}>⚠ {a}</span>)
                      }
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {new Date(p.updatedAt).toLocaleDateString('en-IN')}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/consultation?patient=${p.id}`)}
                      >📹</button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/history/${p.id}`)}
                      >📋</button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setSelectedPatient(p)}
                      >👁</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Patient Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Register New Patient</div>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>Enter patient demographics and medical information</p>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>

            <div className="grid grid-2" style={{ gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input id="patient-name" className="form-input" placeholder="Enter full name" value={newPatient.name} onChange={e => setNewPatient(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Date of Birth *</label>
                <input id="patient-dob" type="date" className="form-input" value={newPatient.dob} onChange={e => setNewPatient(p => ({ ...p, dob: e.target.value }))} />
                {newPatient.dob && <div style={{ fontSize: 12, color: 'var(--color-teal)', marginTop: 4 }}>Age: {calculateAge(newPatient.dob)} years</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Gender</label>
                <select className="form-select" value={newPatient.gender} onChange={e => setNewPatient(p => ({ ...p, gender: e.target.value as Patient['gender'] }))}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Blood Group</label>
                <select className="form-select" value={newPatient.bloodGroup} onChange={e => setNewPatient(p => ({ ...p, bloodGroup: e.target.value }))}>
                  {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input className="form-input" placeholder="+91 XXXXX XXXXX" value={newPatient.phone} onChange={e => setNewPatient(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="form-input" type="email" placeholder="patient@email.com" value={newPatient.email} onChange={e => setNewPatient(p => ({ ...p, email: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-2" style={{ gap: 16, marginBottom: 20 }}>
              <div className="form-group">
                <label className="form-label">Known Allergies</label>
                <input className="form-input" placeholder="Penicillin, Sulfa (comma separated)" value={newPatient.allergies} onChange={e => setNewPatient(p => ({ ...p, allergies: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Medical Conditions</label>
                <input className="form-input" placeholder="Hypertension, Diabetes (comma separated)" value={newPatient.conditions} onChange={e => setNewPatient(p => ({ ...p, conditions: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button
                id="save-patient-btn"
                className="btn btn-primary"
                disabled={!newPatient.name || !newPatient.phone}
                onClick={addPatient}
              >
                + Register Patient
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient detail modal */}
      {selectedPatient && (
        <div className="modal-overlay" onClick={() => setSelectedPatient(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="avatar avatar-teal avatar-lg">{selectedPatient.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                <div>
                  <div className="modal-title">{selectedPatient.name}</div>
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {selectedPatient.age} years · {selectedPatient.gender} · {selectedPatient.bloodGroup}
                  </p>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSelectedPatient(null)}>✕</button>
            </div>

            <div className="grid grid-2" style={{ gap: 12 }}>
              {[
                ['Phone', selectedPatient.phone],
                ['Email', selectedPatient.email || '—'],
                ['Blood Group', selectedPatient.bloodGroup || '—'],
                ['Date of Birth', selectedPatient.dob],
              ].map(([l, v]) => (
                <div key={l} style={{ padding: 12, background: 'var(--color-bg-glass)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 4 }}>{l}</div>
                  <div style={{ fontSize: 14, color: 'var(--color-text-primary)' }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: 8 }}>ALLERGIES</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedPatient.allergies.length === 0
                  ? <span className="badge badge-success">NKDA</span>
                  : selectedPatient.allergies.map(a => <span key={a} className="badge badge-warning">⚠ {a}</span>)}
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: 8 }}>CONDITIONS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedPatient.conditions.length === 0
                  ? <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>None documented</span>
                  : selectedPatient.conditions.map(c => <span key={c} className="badge badge-info">{c}</span>)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setSelectedPatient(null); navigate('/consultation') }}>
                📹 Start Consultation
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setSelectedPatient(null); navigate(`/history/${selectedPatient.id}`) }}>
                📋 View History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
