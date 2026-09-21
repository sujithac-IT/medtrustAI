import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Patient } from '../types'

const INITIAL_PATIENTS: Patient[] = [
  {
    id: 'p_102345',
    name: 'K. Sundaram',
    mrn: '102345',
    dob: '1966-04-12',
    age: 58,
    gender: 'male',
    phone: '+91 98765 43210',
    bloodGroup: 'B+',
    allergies: ['Penicillin', 'Dust'],
    conditions: ['Hypertension', 'Type 2 Diabetes'],
    lastVisit: '12 Apr 2025',
    createdAt: '2024-01-10',
    updatedAt: '2024-09-20',
  },
  {
    id: 'p_102346',
    name: 'Lakshmi Devi',
    mrn: '102346',
    dob: '1979-08-20',
    age: 45,
    gender: 'female',
    phone: '+91 87654 32109',
    bloodGroup: 'O+',
    allergies: ['Sulfa'],
    conditions: ['Hypothyroidism'],
    lastVisit: '08 Apr 2025',
    createdAt: '2024-02-15',
    updatedAt: '2024-09-18',
  },
  {
    id: 'p_102347',
    name: 'R. Prakash',
    mrn: '102347',
    dob: '1992-11-05',
    age: 32,
    gender: 'male',
    phone: '+91 51234 56789',
    bloodGroup: 'A+',
    allergies: [],
    conditions: ['Migraine'],
    lastVisit: '03 Apr 2025',
    createdAt: '2024-03-01',
    updatedAt: '2024-09-15',
  },
  {
    id: 'p_102348',
    name: 'A. Priya',
    mrn: '102348',
    dob: '2012-05-18',
    age: 12,
    gender: 'female',
    phone: '+91 93456 78901',
    bloodGroup: 'B-',
    allergies: ['Peanuts'],
    conditions: ['Pediatric Asthma'],
    lastVisit: '28 Mar 2025',
    createdAt: '2024-04-20',
    updatedAt: '2024-09-10',
  },
  {
    id: 'p_102349',
    name: 'S. Kumar',
    mrn: '102349',
    dob: '1957-02-14',
    age: 67,
    gender: 'male',
    phone: '+91 94567 89012',
    bloodGroup: 'AB+',
    allergies: ['Aspirin'],
    conditions: ['CAD', 'Hypertension'],
    lastVisit: '20 Mar 2025',
    createdAt: '2024-05-10',
    updatedAt: '2024-09-12',
  },
]

function calculateAge(dob: string) {
  if (!dob) return 34
  const birth = new Date(dob)
  const now = new Date('2025-04-12') // relative reference date
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--
  }
  return isNaN(age) || age <= 0 ? 34 : age
}

export default function PatientsPage() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState<Patient[]>(() => {
    const saved = localStorage.getItem('medtrust_patients')
    return saved ? JSON.parse(saved) : INITIAL_PATIENTS
  })
  const [search, setSearch] = useState('')
  const [showAddForm, setShowAddForm] = useState(true)

  // Add Patient Form State matching Screen 3
  const [newName, setNewName] = useState('R. Meenakshi')
  const [newDob, setNewDob] = useState('1990-08-15')
  const [newGender, setNewGender] = useState('Female')
  const [newPhone, setNewPhone] = useState('+91 98765 43210')
  const [newBloodGroup, setNewBloodGroup] = useState('O+')
  const [allergiesList, setAllergiesList] = useState<string[]>(['Pollen', 'Dust'])
  const [conditionsList, setConditionsList] = useState<string[]>(['Asthma', 'Anxiety'])

  const [inputAllergy, setInputAllergy] = useState('')
  const [showAllergyInput, setShowAllergyInput] = useState(false)
  const [inputCondition, setInputCondition] = useState('')
  const [showConditionInput, setShowConditionInput] = useState(false)

  const computedAge = calculateAge(newDob)

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.mrn && p.mrn.includes(search)) ||
    p.phone.includes(search)
  )

  const handleSavePatient = () => {
    if (!newName.trim()) return
    const newPatient: Patient = {
      id: `p_${Date.now()}`,
      name: newName,
      dob: newDob,
      age: computedAge,
      gender: newGender.toLowerCase() as any,
      phone: newPhone,
      bloodGroup: newBloodGroup,
      allergies: allergiesList,
      conditions: conditionsList,
      mrn: String(102350 + patients.length),
      lastVisit: 'Today',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const updated = [newPatient, ...patients]
    setPatients(updated)
    localStorage.setItem('medtrust_patients', JSON.stringify(updated))
    setNewName('')
    setShowAddForm(false)
  }

  const handleAddAllergy = () => {
    if (!inputAllergy.trim()) return
    setAllergiesList([...allergiesList, inputAllergy.trim()])
    setInputAllergy('')
    setShowAllergyInput(false)
  }

  const handleAddCondition = () => {
    if (!inputCondition.trim()) return
    setConditionsList([...conditionsList, inputCondition.trim()])
    setInputCondition('')
    setShowConditionInput(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Top Header Matching Screen 3 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>👤</span>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
            Patient Management
          </h1>
        </div>

        {/* Search bar & Add New Patient button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, maxWidth: 540, justifyContent: 'flex-end' }}>
          <div style={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
          }}>
            <span style={{ position: 'absolute', left: 12, color: 'var(--color-text-muted)', fontSize: 14 }}>🔍</span>
            <input
              className="form-input"
              placeholder="Search patients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, borderRadius: 8, height: 38, fontSize: 13 }}
            />
          </div>

          <button
            onClick={() => setShowAddForm(true)}
            style={{
              padding: '9px 18px',
              background: '#2563EB',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 10px rgba(37,99,235,0.3)',
            }}
          >
            + Add New Patient
          </button>
        </div>
      </div>

      {/* Patient Table Matching Screen 3 */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr style={{
              background: 'rgba(255,255,255,0.02)',
              borderBottom: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
              fontSize: 12,
              fontWeight: 600,
            }}>
              <th style={{ padding: '12px 16px' }}>Name</th>
              <th style={{ padding: '12px 16px' }}>Age/Gender</th>
              <th style={{ padding: '12px 16px' }}>MRN</th>
              <th style={{ padding: '12px 16px' }}>Phone</th>
              <th style={{ padding: '12px 16px' }}>Last Visit</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatients.map((p) => (
              <tr
                key={p.id}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  transition: 'background 0.15s',
                  cursor: 'pointer',
                }}
                onClick={() => navigate('/consultation')}
              >
                {/* Name with Avatar */}
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, rgba(37,99,235,0.3), rgba(0,212,170,0.3))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-teal)',
                      fontWeight: 700,
                      fontSize: 12,
                    }}>
                      {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{p.name}</span>
                  </div>
                </td>

                {/* Age/Gender */}
                <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)' }}>
                  {p.age}{p.gender === 'male' ? 'M' : 'F'}
                </td>

                {/* MRN */}
                <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                  {p.mrn}
                </td>

                {/* Phone */}
                <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)' }}>
                  {p.phone}
                </td>

                {/* Last Visit */}
                <td style={{ padding: '14px 16px', color: 'var(--color-text-secondary)' }}>
                  {p.lastVisit || '12 Apr 2025'}
                </td>

                {/* Actions 3 dots */}
                <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/history/${p.id}`)
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-text-muted)',
                      fontSize: 18,
                      cursor: 'pointer',
                    }}
                  >
                    ⋮
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add New Patient Form Matching Screen 3 */}
      {showAddForm && (
        <div className="card" style={{ padding: 22, marginTop: 4 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: 10,
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Add New Patient
            </h2>
            <button
              onClick={() => setShowAddForm(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 16 }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
            {/* Left Column of inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Row 1: Name and Date of Birth */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 11 }}>Name *</label>
                  <input
                    className="form-input"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 11 }}>Date of Birth *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={newDob}
                    onChange={e => setNewDob(e.target.value)}
                  />
                </div>
              </div>

              {/* Row 2: Gender and Phone Number */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 11 }}>Gender *</label>
                  <select
                    className="form-select"
                    value={newGender}
                    onChange={e => setNewGender(e.target.value)}
                  >
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 11 }}>Phone Number</label>
                  <input
                    className="form-input"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Row 3: Blood Group */}
              <div style={{ width: '48%' }}>
                <label className="form-label" style={{ fontSize: 11 }}>Blood Group *</label>
                <select
                  className="form-select"
                  value={newBloodGroup}
                  onChange={e => setNewBloodGroup(e.target.value)}
                >
                  <option>O+</option>
                  <option>O-</option>
                  <option>A+</option>
                  <option>A-</option>
                  <option>B+</option>
                  <option>B-</option>
                  <option>AB+</option>
                  <option>AB-</option>
                </select>
              </div>
            </div>

            {/* Right Column: Auto-Calculated Age Box, Medical Conditions, Allergies */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Prominent Auto-Calculated Age Card Matching Screen 3 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '12px 18px',
                background: 'rgba(37, 99, 235, 0.08)',
                border: '1px solid rgba(37, 99, 235, 0.25)',
                borderRadius: 8,
              }}>
                <span style={{ fontSize: 28 }}>📅</span>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    Auto-Calculated Age
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)' }}>
                    {computedAge} years
                  </div>
                </div>
              </div>

              {/* Medical Conditions Tags */}
              <div>
                <label className="form-label" style={{ fontSize: 11 }}>Medical Conditions</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  {conditionsList.map((c, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '4px 10px',
                        background: 'rgba(0, 212, 170, 0.08)',
                        border: '1px solid rgba(0, 212, 170, 0.25)',
                        color: 'var(--color-teal)',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {c}
                      <span
                        onClick={() => setConditionsList(conditionsList.filter((_, idx) => idx !== i))}
                        style={{ cursor: 'pointer', opacity: 0.7 }}
                      >
                        ✕
                      </span>
                    </span>
                  ))}

                  {showConditionInput ? (
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      <input
                        className="form-input"
                        placeholder="Condition..."
                        value={inputCondition}
                        onChange={e => setInputCondition(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddCondition()}
                        style={{ width: 110, padding: '2px 8px', fontSize: 11 }}
                        autoFocus
                      />
                      <button className="btn btn-sm btn-primary" onClick={handleAddCondition} style={{ padding: '2px 8px', fontSize: 11 }}>✓</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowConditionInput(true)}
                      style={{
                        background: 'transparent',
                        border: '1px dashed var(--color-border)',
                        color: 'var(--color-text-muted)',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      + Add
                    </button>
                  )}
                </div>
              </div>

              {/* Allergies Tags */}
              <div>
                <label className="form-label" style={{ fontSize: 11 }}>Allergies</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  {allergiesList.map((a, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '4px 10px',
                        background: 'rgba(59, 130, 246, 0.12)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        color: '#60A5FA',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {a}
                      <span
                        onClick={() => setAllergiesList(allergiesList.filter((_, idx) => idx !== i))}
                        style={{ cursor: 'pointer', opacity: 0.7 }}
                      >
                        ✕
                      </span>
                    </span>
                  ))}

                  {showAllergyInput ? (
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      <input
                        className="form-input"
                        placeholder="Allergy..."
                        value={inputAllergy}
                        onChange={e => setInputAllergy(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddAllergy()}
                        style={{ width: 100, padding: '2px 8px', fontSize: 11 }}
                        autoFocus
                      />
                      <button className="btn btn-sm btn-primary" onClick={handleAddAllergy} style={{ padding: '2px 8px', fontSize: 11 }}>✓</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAllergyInput(true)}
                      style={{
                        background: 'transparent',
                        border: '1px dashed var(--color-border)',
                        color: 'var(--color-text-muted)',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      + Add
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions Matching Screen 3 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
            <button
              onClick={() => setShowAddForm(false)}
              style={{
                padding: '9px 18px',
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSavePatient}
              style={{
                padding: '9px 22px',
                background: '#2563EB',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(37,99,235,0.4)',
              }}
            >
              Save Patient
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
