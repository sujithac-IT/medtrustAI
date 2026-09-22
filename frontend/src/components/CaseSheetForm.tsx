import React, { useState, useRef } from 'react'
import type { CaseSheet, MedicationRow } from '../types'
import hospitalLogoImg from '../assets/hospital_logo.jpg'

interface CaseSheetFormProps {
  caseSheet: CaseSheet
  onUpdate: (updated: CaseSheet) => void
  onApprove?: () => void
  isDoctor?: boolean
  onBack?: () => void
}

const SECTIONS_NAV = [
  { id: 'sec-1', name: '1. Patient Info' },
  { id: 'sec-2', name: '2. Chief Complaint' },
  { id: 'sec-3', name: '3. HPI' },
  { id: 'sec-4', name: '4. Symptoms & Severity' },
  { id: 'sec-5', name: '5. Duration & Onset' },
  { id: 'sec-6', name: '6. Past Medical History' },
  { id: 'sec-7', name: '7. Current Medications' },
  { id: 'sec-8', name: '8. Allergies & Reactions' },
  { id: 'sec-9', name: '9. Family History' },
  { id: 'sec-10', name: '10. Social / Occupational' },
  { id: 'sec-11', name: '11. Doctor Observations' },
  { id: 'sec-12', name: '12. Investigations' },
  { id: 'sec-13', name: '13. Assessment' },
  { id: 'sec-14', name: '14. Treatment Plan' },
  { id: 'sec-15', name: '15. Follow-up & Red Flags' },
  { id: 'sec-16', name: '16. Missing Information' },
  { id: 'sec-17', name: '17. Uncertain Information' },
]

export default function CaseSheetForm({
  caseSheet,
  onUpdate,
  onBack,
}: CaseSheetFormProps) {
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit')
  const [activeNav, setActiveNav] = useState('sec-1')
  const [saveToast, setSaveToast] = useState(false)
  const [newMedModal, setNewMedModal] = useState(false)
  const [newMed, setNewMed] = useState<MedicationRow>({
    name: '',
    dosage: '',
    frequency: 'OD',
    route: 'Oral',
    duration: 'Long-term',
  })

  // Tag inputs
  const [newAllergy, setNewAllergy] = useState('')
  const [showAllergyInput, setShowAllergyInput] = useState(false)
  const [newCondition, setNewCondition] = useState('')
  const [showConditionInput, setShowConditionInput] = useState(false)
  const [newFamily, setNewFamily] = useState('')
  const [showFamilyInput, setShowFamilyInput] = useState(false)

  const printRef = useRef<HTMLDivElement>(null)

  const handleFieldChange = (field: keyof CaseSheet, value: any) => {
    onUpdate({
      ...caseSheet,
      [field]: value,
    })
  }

  const handlePatientInfoChange = (field: string, value: string) => {
    onUpdate({
      ...caseSheet,
      patientInfo: {
        ...caseSheet.patientInfo,
        [field]: value,
      },
      patientName: field === 'name' ? value : caseSheet.patientName,
    })
  }

  const handleDeleteMedication = (index: number) => {
    const updated = [...(caseSheet.medications || [])]
    updated.splice(index, 1)
    onUpdate({ ...caseSheet, medications: updated })
  }

  const handleAddMedication = () => {
    if (!newMed.name) return
    const updated = [...(caseSheet.medications || []), newMed]
    onUpdate({ ...caseSheet, medications: updated })
    setNewMed({ name: '', dosage: '', frequency: 'OD', route: 'Oral', duration: 'Long-term' })
    setNewMedModal(false)
  }

  const handleAddAllergy = () => {
    if (!newAllergy.trim()) return
    const updated = [...(caseSheet.allergies || []), newAllergy.trim()]
    onUpdate({ ...caseSheet, allergies: updated })
    setNewAllergy('')
    setShowAllergyInput(false)
  }

  const handleRemoveAllergy = (index: number) => {
    const updated = [...(caseSheet.allergies || [])]
    updated.splice(index, 1)
    onUpdate({ ...caseSheet, allergies: updated })
  }

  const handleAddCondition = () => {
    if (!newCondition.trim()) return
    const current = caseSheet.pastMedicalHistory ? caseSheet.pastMedicalHistory.split(',').map(s => s.trim()) : []
    current.push(newCondition.trim())
    onUpdate({ ...caseSheet, pastMedicalHistory: current.join(', ') })
    setNewCondition('')
    setShowConditionInput(false)
  }

  const handleAddFamily = () => {
    if (!newFamily.trim()) return
    const current = caseSheet.familyHistory ? caseSheet.familyHistory.split(',').map(s => s.trim()) : []
    current.push(newFamily.trim())
    onUpdate({ ...caseSheet, familyHistory: current.join(', ') })
    setNewFamily('')
    setShowFamilyInput(false)
  }

  const handleSaveChanges = () => {
    setSaveToast(true)
    setTimeout(() => setSaveToast(false), 2500)
  }

  const handlePrint = () => {
    window.print()
  }

  const pInfo = caseSheet.patientInfo || {
    name: 'K. Sundaram',
    age: '58',
    gender: 'Male',
    bloodGroup: 'B+',
    phone: '+91 98765 43210',
    address: 'No. 12, Gandhi Nagar, Madurai',
    mrn: '102345',
    dob: '1966-04-12',
  }

  const historyConditions = caseSheet.pastMedicalHistory
    ? caseSheet.pastMedicalHistory.split(',').map(s => s.trim()).filter(Boolean)
    : ['Hypertension', 'Type 2 Diabetes']

  const familyHistoryList = caseSheet.familyHistory
    ? caseSheet.familyHistory.split(',').map(s => s.trim()).filter(Boolean)
    : ['Father - Diabetes']

  // ─── Preview Mode: Screen 5 (Apollo MedTrust Clinical Case Sheet) ───────────
  if (viewMode === 'preview') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 14, overflowY: 'auto' }}>
        {/* Top bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'var(--color-bg-glass)',
          borderRadius: 10,
          border: '1px solid var(--color-border)',
        }}>
          <button
            onClick={() => setViewMode('edit')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-primary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ← Back to Edit
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handlePrint}
              style={{
                padding: '8px 16px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: 'white',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              🖨️ Print
            </button>
            <button
              onClick={handlePrint}
              style={{
                padding: '8px 16px',
                background: '#2563EB',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 10px rgba(37,99,235,0.3)',
              }}
            >
              📥 Download PDF
            </button>
          </div>
        </div>

        {/* Paper Sheet Matching Screen 5 */}
        <div
          ref={printRef}
          id="clinical-case-sheet-paper"
          style={{
            background: '#FFFFFF',
            color: '#0F172A',
            padding: '40px 48px',
            borderRadius: 8,
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
            maxWidth: 960,
            margin: '0 auto',
            width: '100%',
            position: 'relative',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {/* Watermark */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${hospitalLogoImg})`,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '320px',
            opacity: 0.04,
            pointerEvents: 'none',
          }} />

          {/* Hospital Letterhead */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px solid #2563EB',
            paddingBottom: 20,
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <img
                src={hospitalLogoImg}
                alt="Hospital Logo"
                style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'contain' }}
              />
              <div>
                <h1 style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: '#1E3A8A',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}>
                  Apollo MedTrust
                </h1>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  University Teaching Hospital
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Clinical Case Sheet
              </h2>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                Department of Cardiology • Medical Records
              </div>
            </div>
          </div>

          {/* Patient Metadata Box */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            padding: '14px 18px',
            background: '#F8FAFC',
            borderRadius: 6,
            border: '1px solid #E2E8F0',
            marginBottom: 24,
            fontSize: 12,
          }}>
            <div>
              <span style={{ color: '#64748B', fontWeight: 600 }}>Patient Name : </span>
              <strong style={{ color: '#0F172A' }}>{pInfo.name}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B', fontWeight: 600 }}>Date : </span>
              <strong style={{ color: '#0F172A' }}>12-04-2025</strong>
            </div>
            <div>
              <span style={{ color: '#64748B', fontWeight: 600 }}>Doctor : </span>
              <strong style={{ color: '#0F172A' }}>{caseSheet.doctorName || 'Dr. Rajesh Sharma, MD'}</strong>
            </div>

            <div>
              <span style={{ color: '#64748B', fontWeight: 600 }}>Age / Gender : </span>
              <strong style={{ color: '#0F172A' }}>{pInfo.age} / {pInfo.gender === 'Male' ? 'M' : 'F'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B', fontWeight: 600 }}>MRN : </span>
              <strong style={{ color: '#0F172A' }}>{pInfo.mrn || '102345'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B', fontWeight: 600 }}>Dept : </span>
              <strong style={{ color: '#0F172A' }}>Cardiology</strong>
            </div>
          </div>

          {/* 2-Column Clinical Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
            {/* Left Column (Sections 1 - 5) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* 1. Patient Information */}
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1E293B', marginBottom: 4, textTransform: 'uppercase' }}>
                  1. Patient Information
                </h3>
                <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                  <div>Blood Group : <strong>{pInfo.bloodGroup}</strong></div>
                  <div>Contact : <strong>{pInfo.phone}</strong></div>
                  <div>Address : {pInfo.address}</div>
                </div>
              </div>

              {/* 2. Chief Complaint */}
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1E293B', marginBottom: 4, textTransform: 'uppercase' }}>
                  2. Chief Complaint
                </h3>
                <p style={{ fontSize: 12, color: '#334155', margin: 0, lineHeight: 1.5 }}>
                  {caseSheet.chiefComplaint}
                </p>
              </div>

              {/* 3. History of Present Illness */}
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1E293B', marginBottom: 4, textTransform: 'uppercase' }}>
                  3. History of Present Illness (HPI)
                </h3>
                <p style={{ fontSize: 12, color: '#334155', margin: 0, lineHeight: 1.6 }}>
                  {caseSheet.hpi}
                </p>
              </div>

              {/* 4. Symptoms & Severity */}
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1E293B', marginBottom: 4, textTransform: 'uppercase' }}>
                  4. Symptoms & Severity
                </h3>
                <div style={{ fontSize: 12, color: '#334155' }}>
                  {caseSheet.symptoms && caseSheet.symptoms.length > 0 ? (
                    caseSheet.symptoms.join(', ')
                  ) : (
                    'Chest pain (moderate), SOB (mild)'
                  )}
                </div>
              </div>

              {/* 5. Duration & Onset */}
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1E293B', marginBottom: 4, textTransform: 'uppercase' }}>
                  5. Duration & Onset
                </h3>
                <p style={{ fontSize: 12, color: '#334155', margin: 0 }}>
                  {caseSheet.duration || '3 weeks, gradual onset'}
                </p>
              </div>
            </div>

            {/* Right Column (Sections 6 - 10) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* 6. Past Medical History */}
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1E293B', marginBottom: 4, textTransform: 'uppercase' }}>
                  6. Past Medical History
                </h3>
                <p style={{ fontSize: 12, color: '#334155', margin: 0 }}>
                  {caseSheet.pastMedicalHistory}
                </p>
              </div>

              {/* 7. Current Medications */}
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1E293B', marginBottom: 4, textTransform: 'uppercase' }}>
                  7. Current Medications
                </h3>
                <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                  {caseSheet.medications?.map((m, i) => (
                    <div key={i}>
                      • {m.name} {m.dosage} {m.frequency} {m.route || 'Oral'} ({m.duration})
                    </div>
                  ))}
                </div>
              </div>

              {/* 8. Allergies & Reactions */}
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1E293B', marginBottom: 4, textTransform: 'uppercase' }}>
                  8. Allergies & Reactions
                </h3>
                <p style={{ fontSize: 12, color: '#DC2626', margin: 0, fontWeight: 600 }}>
                  {caseSheet.allergies?.join(', ') || 'Penicillin (rash)'}
                </p>
              </div>

              {/* 9. Family History */}
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1E293B', marginBottom: 4, textTransform: 'uppercase' }}>
                  9. Family History
                </h3>
                <p style={{ fontSize: 12, color: '#334155', margin: 0 }}>
                  {caseSheet.familyHistory}
                </p>
              </div>

              {/* 10. Social / Occupational History */}
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1E293B', marginBottom: 4, textTransform: 'uppercase' }}>
                  10. Social / Occupational History
                </h3>
                <p style={{ fontSize: 12, color: '#334155', margin: 0 }}>
                  {caseSheet.socialHistory}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            marginTop: 40,
            paddingTop: 16,
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
            color: '#64748B',
          }}>
            <span>Apollo MedTrust University Teaching Hospital</span>
            <span>Confidential Medical Record</span>
          </div>
        </div>
      </div>
    )
  }

  // ─── Edit Mode: Screen 2 (17-Section Case Sheet) ────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      {/* Top Header Matching Screen 2 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: 'var(--color-bg-glass)',
        borderRadius: 10,
        border: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        {/* Left: Back + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-primary)',
              fontSize: 18,
              cursor: 'pointer',
              padding: '4px 8px',
            }}
            title="Back"
          >
            ←
          </button>
          <h1 style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
            17-Section Case Sheet
          </h1>
        </div>

        {/* Right: Mode switches + AI Generate + Share */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Edit Mode Button */}
          <button
            onClick={() => setViewMode('edit')}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              border: '1px solid #2563EB',
              background: viewMode === 'edit' ? '#2563EB' : 'transparent',
              color: viewMode === 'edit' ? 'white' : 'var(--color-text-secondary)',
            }}
          >
            Edit Mode
          </button>

          {/* Preview Mode Button */}
          <button
            onClick={() => setViewMode('preview')}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid var(--color-border)',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Preview Mode
          </button>

          {/* AI Generate Button */}
          <button
            onClick={handleSaveChanges}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              background: '#2563EB',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
            }}
          >
            <span>🤖</span>
            AI Generate
          </button>

          {/* Share/Export icon button */}
          <button
            onClick={handlePrint}
            style={{
              width: 34,
              height: 34,
              borderRadius: 6,
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
            }}
            title="Export / Share"
          >
            ↗
          </button>
        </div>
      </div>

      {/* Main Area: Left subnav + 2-Column form */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '200px 1fr', gap: 14, minHeight: 0 }}>
        {/* Left Sub-Navigation (1 to 17 sections) */}
        <div style={{
          background: 'var(--color-bg-glass)',
          borderRadius: 10,
          border: '1px solid var(--color-border)',
          overflowY: 'auto',
          padding: '8px 0',
        }}>
          {SECTIONS_NAV.map(s => (
            <div
              key={s.id}
              onClick={() => setActiveNav(s.id)}
              style={{
                padding: '9px 14px',
                fontSize: 12,
                fontWeight: activeNav === s.id ? 700 : 500,
                color: activeNav === s.id ? 'var(--color-teal)' : 'var(--color-text-muted)',
                background: activeNav === s.id ? 'rgba(0, 212, 170, 0.08)' : 'transparent',
                borderLeft: `3px solid ${activeNav === s.id ? 'var(--color-teal)' : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {s.name}
            </div>
          ))}
        </div>

        {/* Center / Right Form Area (2 Columns) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          overflowY: 'auto',
          paddingRight: 6,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
            {/* Left Column: 1. Patient Info, 2. Chief Complaint, 3. HPI */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* 1. Patient Information */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 14 }}>
                  1. Patient Information
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 11 }}>Patient Name</label>
                    <input
                      className="form-input"
                      value={pInfo.name}
                      onChange={e => handlePatientInfoChange('name', e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: 11 }}>Age</label>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          className="form-input"
                          value={pInfo.age}
                          onChange={e => handlePatientInfoChange('age', e.target.value)}
                        />
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Years</span>
                      </div>
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 11 }}>Gender</label>
                      <select
                        className="form-select"
                        value={pInfo.gender}
                        onChange={e => handlePatientInfoChange('gender', e.target.value)}
                      >
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: 11 }}>MRN</label>
                      <input
                        className="form-input"
                        value={pInfo.mrn || '102345'}
                        onChange={e => handlePatientInfoChange('mrn', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 11 }}>Date of Birth</label>
                      <input
                        type="date"
                        className="form-input"
                        value={pInfo.dob || '1966-04-12'}
                        onChange={e => handlePatientInfoChange('dob', e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="form-label" style={{ fontSize: 11 }}>Blood Group</label>
                      <select
                        className="form-select"
                        value={pInfo.bloodGroup || 'B+'}
                        onChange={e => handlePatientInfoChange('bloodGroup', e.target.value)}
                      >
                        <option>A+</option>
                        <option>A-</option>
                        <option>B+</option>
                        <option>B-</option>
                        <option>AB+</option>
                        <option>AB-</option>
                        <option>O+</option>
                        <option>O-</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: 11 }}>Contact Number</label>
                      <input
                        className="form-input"
                        value={pInfo.phone}
                        onChange={e => handlePatientInfoChange('phone', e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: 11 }}>Address & Reaction</label>
                    <input
                      className="form-input"
                      value={pInfo.address || 'No. 12, Gandhi Nagar, Madurai'}
                      onChange={e => handlePatientInfoChange('address', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* 2. Chief Complaint */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 8 }}>
                  2. Chief Complaint
                </div>
                <input
                  className="form-input"
                  value={caseSheet.chiefComplaint}
                  onChange={e => handleFieldChange('chiefComplaint', e.target.value)}
                />
              </div>

              {/* 3. History of Present Illness (HPI) */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 8 }}>
                  3. History of Present Illness (HPI)
                </div>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={caseSheet.hpi}
                  onChange={e => handleFieldChange('hpi', e.target.value)}
                />
              </div>
            </div>

            {/* Right Column: Medications, Allergies, Past Medical History, Family History */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Medications Card */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 12 }}>
                  Medications
                </div>

                <div style={{ overflowX: 'auto', marginBottom: 12 }}>
                  <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', color: 'var(--color-text-muted)' }}>
                        <th style={{ padding: '6px 4px' }}>Drug Name</th>
                        <th style={{ padding: '6px 4px' }}>Dosage</th>
                        <th style={{ padding: '6px 4px' }}>Frequency</th>
                        <th style={{ padding: '6px 4px' }}>Route</th>
                        <th style={{ padding: '6px 4px' }}>Duration</th>
                        <th style={{ padding: '6px 4px', width: 24 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {caseSheet.medications?.map((m, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '8px 4px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{m.name}</td>
                          <td style={{ padding: '8px 4px', color: 'var(--color-text-secondary)' }}>{m.dosage}</td>
                          <td style={{ padding: '8px 4px', color: 'var(--color-text-secondary)' }}>{m.frequency}</td>
                          <td style={{ padding: '8px 4px', color: 'var(--color-text-secondary)' }}>{m.route || 'Oral'}</td>
                          <td style={{ padding: '8px 4px', color: 'var(--color-text-secondary)' }}>{m.duration}</td>
                          <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                            <button
                              onClick={() => handleDeleteMedication(idx)}
                              style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 12 }}
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {newMedModal ? (
                  <div style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <input className="form-input" placeholder="Drug Name" value={newMed.name} onChange={e => setNewMed({ ...newMed, name: e.target.value })} style={{ fontSize: 11 }} />
                      <input className="form-input" placeholder="Dosage (e.g. 75mg)" value={newMed.dosage} onChange={e => setNewMed({ ...newMed, dosage: e.target.value })} style={{ fontSize: 11 }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                      <input className="form-input" placeholder="Freq (OD/BD)" value={newMed.frequency} onChange={e => setNewMed({ ...newMed, frequency: e.target.value })} style={{ fontSize: 11 }} />
                      <input className="form-input" placeholder="Route (Oral)" value={newMed.route} onChange={e => setNewMed({ ...newMed, route: e.target.value })} style={{ fontSize: 11 }} />
                      <input className="form-input" placeholder="Duration" value={newMed.duration} onChange={e => setNewMed({ ...newMed, duration: e.target.value })} style={{ fontSize: 11 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => setNewMedModal(false)} style={{ fontSize: 11 }}>Cancel</button>
                      <button className="btn btn-sm btn-primary" onClick={handleAddMedication} style={{ fontSize: 11 }}>Add</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setNewMedModal(true)}
                    style={{
                      padding: '6px 12px',
                      background: '#2563EB',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    + Add Medication
                  </button>
                )}
              </div>

              {/* Allergies Card */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 10 }}>
                  Allergies
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {caseSheet.allergies?.map((a, i) => (
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
                        gap: 6,
                      }}
                    >
                      {a}
                      <span onClick={() => handleRemoveAllergy(i)} style={{ cursor: 'pointer', opacity: 0.7 }}>✕</span>
                    </span>
                  ))}

                  {showAllergyInput ? (
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      <input
                        className="form-input"
                        placeholder="Allergy..."
                        value={newAllergy}
                        onChange={e => setNewAllergy(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddAllergy()}
                        style={{ width: 110, padding: '2px 8px', fontSize: 11 }}
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
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      + Add
                    </button>
                  )}
                </div>
              </div>

              {/* Past Medical History Card */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 10 }}>
                  Past Medical History
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {historyConditions.map((c, i) => (
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
                      }}
                    >
                      {c}
                    </span>
                  ))}

                  {showConditionInput ? (
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      <input
                        className="form-input"
                        placeholder="Condition..."
                        value={newCondition}
                        onChange={e => setNewCondition(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddCondition()}
                        style={{ width: 120, padding: '2px 8px', fontSize: 11 }}
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
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      + Add
                    </button>
                  )}
                </div>
              </div>

              {/* Family History Card */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 10 }}>
                  Family History
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {familyHistoryList.map((f, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '4px 10px',
                        background: 'rgba(168, 85, 247, 0.08)',
                        border: '1px solid rgba(168, 85, 247, 0.25)',
                        color: '#C084FC',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {f}
                    </span>
                  ))}

                  {showFamilyInput ? (
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      <input
                        className="form-input"
                        placeholder="e.g. Father - Diabetes"
                        value={newFamily}
                        onChange={e => setNewFamily(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddFamily()}
                        style={{ width: 140, padding: '2px 8px', fontSize: 11 }}
                        autoFocus
                      />
                      <button className="btn btn-sm btn-primary" onClick={handleAddFamily} style={{ padding: '2px 8px', fontSize: 11 }}>✓</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowFamilyInput(true)}
                      style={{
                        background: 'transparent',
                        border: '1px dashed var(--color-border)',
                        color: 'var(--color-text-muted)',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontSize: 12,
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

          {/* Sticky Bottom Bar Matching Material 3 Hospital White Theme */}
          <div style={{
            position: 'sticky',
            bottom: 0,
            background: '#FFFFFF',
            borderRadius: 10,
            border: '1px solid #E2E8F0',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
            marginTop: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                backgroundColor: '#EFF6FF',
                color: '#1D4ED8',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                border: '1px solid #BFDBFE',
              }}>
                HL7 FHIR R4 Ready
              </span>
              <span style={{ color: '#64748B', fontSize: 12 }}>
                Doctor Signature: Dr. Rajesh Sharma, MD (TNMC-84920)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {saveToast && (
                <span style={{ color: '#10B981', fontSize: 12, fontWeight: 700 }}>
                  ✓ Changes Saved to Hospital EMR!
                </span>
              )}

              {/* HL7 FHIR R4 Export Button */}
              <button
                onClick={() => {
                  const fhirBundle = {
                    resourceType: 'Bundle',
                    type: 'document',
                    timestamp: new Date().toISOString(),
                    identifier: { system: 'https://medtrust.ai/fhir/casesheets', value: caseSheet.id },
                    entry: [
                      {
                        resource: {
                          resourceType: 'Patient',
                          id: caseSheet.patientId,
                          name: [{ text: pInfo.name }],
                          telecom: [{ system: 'phone', value: pInfo.phone }],
                          gender: pInfo.gender.toLowerCase(),
                          birthDate: pInfo.dob,
                        },
                      },
                      {
                        resource: {
                          resourceType: 'Encounter',
                          id: caseSheet.consultationId,
                          status: 'finished',
                          class: { code: 'VR', display: 'virtual' },
                          reasonCode: [{ text: caseSheet.chiefComplaint }],
                        },
                      },
                      {
                        resource: {
                          resourceType: 'Condition',
                          clinicalStatus: { text: 'active' },
                          verificationStatus: { text: 'provisional' },
                          code: { text: caseSheet.assessment },
                          subject: { reference: `Patient/${caseSheet.patientId}` },
                        },
                      },
                      {
                        resource: {
                          resourceType: 'CarePlan',
                          status: 'active',
                          intent: 'order',
                          description: caseSheet.treatmentPlan,
                        },
                      },
                    ],
                  }
                  const blob = new Blob([JSON.stringify(fhirBundle, null, 2)], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `FHIR_R4_${caseSheet.patientId}_${caseSheet.id}.json`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                style={{
                  padding: '9px 16px',
                  backgroundColor: '#F8FAFD',
                  color: '#0B57D0',
                  border: '1px solid #BFDBFE',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                title="Download Standardized HL7 FHIR R4 Clinical Document Bundle"
              >
                <span>🌐</span>
                <span>Export HL7 FHIR R4</span>
              </button>

              <button
                onClick={handleSaveChanges}
                style={{
                  padding: '9px 20px',
                  backgroundColor: '#0B57D0',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(11,87,208,0.25)',
                }}
              >
                Save & Update EMR
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
