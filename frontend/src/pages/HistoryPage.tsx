import React, { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { CaseSheet, Patient } from '../types'

// Demo initial case sheets if localStorage is empty
const INITIAL_CASE_SHEETS: CaseSheet[] = [
  {
    id: 'cs1',
    consultationId: 'c1',
    patientId: 'p1',
    patientName: 'Arjun Krishnamurthy',
    doctorId: 'demo-doctor-001',
    doctorName: 'Dr. Rajesh Kumar',
    generatedAt: '2024-09-20T10:35:00Z',
    approvedAt: '2024-09-20T10:42:00Z',
    approvedBy: 'Dr. Rajesh Kumar',
    isApproved: true,
    isReadOnly: true,
    patientInfo: {
      name: 'Arjun Krishnamurthy',
      age: '39',
      gender: 'male',
      bloodGroup: 'B+',
      phone: '+91 98765 43210',
      address: '14, Gandhi Nagar, Adyar, Chennai',
    },
    chiefComplaint: 'Severe central chest pain radiating to left shoulder for 3 days',
    hpi: 'Patient presents with 3-day history of sharp chest pain worsening on deep inspiration and exertion. Associated with nocturnal diaphoresis and mild exertional dyspnea. Denies nausea, palpitations, or syncope.',
    symptoms: ['Sharp chest pain', 'Left shoulder pain', 'Shortness of breath on exertion', 'Nocturnal diaphoresis'],
    duration: '3 days',
    pastMedicalHistory: 'Essential hypertension (2 years). No previous MI or revascularization.',
    medications: [
      { name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily (morning)', duration: 'Ongoing' },
      { name: 'Aspirin', dosage: '75mg', frequency: 'Once daily (post-food)', duration: '14 days' },
      { name: 'Atorvastatin', dosage: '20mg', frequency: 'Once daily (bedtime)', duration: '30 days' },
    ],
    allergies: ['Penicillin (skin rash, hives)'],
    familyHistory: 'Father: Acute Myocardial Infarction at age 58',
    socialHistory: 'Ex-smoker (cessation 5 years ago). Occasional alcohol consumption. Sedentary IT professional.',
    doctorObservations: 'BP: 148/94 mmHg | Pulse: 88 bpm regular | SpO2: 98% on RA | S1, S2 audible, no murmurs | Chest: Mild bibasal inspiratory crackles',
    investigations: ['12-lead ECG (urgent)', 'High-sensitivity Troponin I', '2D Echocardiogram', 'Chest X-Ray PA view', 'Complete Blood Count (CBC)'],
    assessment: 'Suspected Acute Coronary Syndrome (ACS) - Rule out NSTEMI / Unstable Angina. Poorly controlled hypertension.',
    treatmentPlan: '1. Immediate 12-lead ECG and serial cardiac troponin monitoring.\n2. Dual antiplatelet protocol initiated.\n3. Continue Amlodipine 5mg OD; add Atorvastatin 20mg OD.\n4. Avoid penicillin group drugs.\n5. Strict bed rest with telemetry monitoring.',
    followUp: 'Review with ECG and Troponin reports within 48-72 hours. Strict BP diary. Emergency protocol provided.',
    missingInformation: ['Exact onset time of primary pain episode', 'Baseline lipid profile and HbA1c'],
    uncertainInformation: ['Musculoskeletal contribution vs ischemic cardiac etiology'],
    summaries: {
      en: 'Patient Arjun Krishnamurthy presented with acute chest pain and exertional dyspnea. Evaluated for suspected Acute Coronary Syndrome. Vitals: BP 148/94, pulse 88. ECG, Troponin, and Echo ordered. Initiated Aspirin and Atorvastatin.',
      ta: 'நோயாளி அர்ஜுன் கிருஷ்ணமூர்த்தி மார்பு வலி மற்றும் மூச்சுத்திணறல் காரணமாக வந்தார். கடுமையான இதய நோய் பரிசோதிக்கப்படுகிறது. ஆஸ்பிரின் மற்றும் அடோர்வாஸ்டாடின் தொடங்கப்பட்டது.',
      hi: 'रोगी अर्जुन कृष्णमूर्ति सीने में दर्द और सांस फूलने की समस्या के साथ उपस्थित हुए। संभावित एक्यूट कोरोनरी सिंड्रोम का मूल्यांकन किया गया।',
    },
  },
  {
    id: 'cs2',
    consultationId: 'c2',
    patientId: 'p2',
    patientName: 'Priya Sundaram',
    doctorId: 'demo-doctor-001',
    doctorName: 'Dr. Rajesh Kumar',
    generatedAt: '2024-09-20T12:05:00Z',
    approvedAt: '2024-09-20T12:12:00Z',
    approvedBy: 'Dr. Rajesh Kumar',
    isApproved: true,
    isReadOnly: true,
    patientInfo: {
      name: 'Priya Sundaram',
      age: '32',
      gender: 'female',
      bloodGroup: 'O+',
      phone: '+91 87654 32109',
      address: '22/B, Anna Nagar West, Chennai',
    },
    chiefComplaint: 'Routine diabetes quarterly review and progressive fatigue',
    hpi: 'Known patient with Type 2 Diabetes Mellitus (diagnosed 3 years ago). Reports persistent lethargy, polyuria, and occasional burning sensation in both feet over past 4 weeks. No hypoglycemic episodes.',
    symptoms: ['Fatigue and lethargy', 'Polyuria', 'Bilateral mild pedal tingling'],
    duration: '4 weeks',
    pastMedicalHistory: 'Type 2 Diabetes Mellitus, Gestational diabetes in past pregnancy (2018).',
    medications: [
      { name: 'Metformin Hydrochloride', dosage: '500mg', frequency: 'Twice daily with meals', duration: 'Ongoing' },
      { name: 'Vitamin B-Complex with Methylcobalamin', dosage: '1 tablet', frequency: 'Once daily', duration: '30 days' },
    ],
    allergies: ['NKDA (No Known Drug Allergies)'],
    familyHistory: 'Maternal grandmother and mother have Type 2 Diabetes.',
    socialHistory: 'Non-smoker, non-drinker. High work-related screen time.',
    doctorObservations: 'BP: 122/80 mmHg | Pulse: 76 bpm regular | BMI: 27.2 kg/m² | Foot exam: Monofilament 10g intact, peripheral pulses palpable.',
    investigations: ['Fasting & Postprandial Blood Glucose', 'HbA1c', 'Urine Microalbumin/Creatinine Ratio', 'Lipid Profile', 'Serum Creatinine'],
    assessment: 'Type 2 Diabetes Mellitus with suboptimal glycemic control. Early signs of mild diabetic peripheral neuropathy. Overweight (BMI 27.2).',
    treatmentPlan: '1. Up-titrate Metformin to 850mg BD post meals after lab review.\n2. Add Methylcobalamin for neuropathic symptom relief.\n3. Medical nutrition therapy: low glycemic index diet.\n4. Daily 30-minute brisk walk.',
    followUp: 'Review in 2 weeks with HbA1c and urine microalbumin reports.',
    missingInformation: ['Last documented home glucometer log', 'Fundus examination date'],
    uncertainInformation: ['Degree of nephropathy awaiting microalbumin ratio'],
    summaries: {
      en: 'Priya Sundaram reviewed for Type 2 Diabetes and fatigue. BP 122/80, BMI 27.2. HbA1c, microalbumin, and lipid tests ordered. Nutritional therapy and nerve support prescribed.',
      ta: 'பிரியா சுந்தரம் டைப் 2 நீரிழிவு மற்றும் சோர்வுக்காக பரிசோதிக்கப்பட்டார். ரத்த சர்க்கரை மற்றும் சிறுநீரக பரிசோதனை பரிந்துரைக்கப்பட்டது.',
      hi: 'प्रिया सुंदरम का टाइप 2 डायबिटीज और थकान की समीक्षा की गई। रक्त शर्करा और पोषण परामर्श दिया गया।',
    },
  },
  {
    id: 'cs3',
    consultationId: 'c3',
    patientId: 'p3',
    patientName: 'Ravi Shankar',
    doctorId: 'demo-doctor-001',
    doctorName: 'Dr. Rajesh Kumar',
    generatedAt: '2024-09-21T09:15:00Z',
    isApproved: false,
    isReadOnly: false,
    patientInfo: {
      name: 'Ravi Shankar',
      age: '54',
      gender: 'male',
      bloodGroup: 'A+',
      phone: '+91 76543 21098',
      address: '7, Valmiki Street, Thiruvanmiyur, Chennai',
    },
    chiefComplaint: 'Chronic cough with yellowish expectoration and worsening breathlessness',
    hpi: 'Patient with known chronic obstructive pulmonary disease presents with 5-day history of increased sputum production and wheezing. Symptoms aggravated by dust exposure and cold mornings.',
    symptoms: ['Productive cough with yellowish sputum', 'Exertional dyspnea (mMRC grade 2)', 'Bilateral wheezing', 'Chest tightness'],
    duration: '5 days',
    pastMedicalHistory: 'COPD (diagnosed 6 years ago), Essential hypertension (4 years).',
    medications: [
      { name: 'Formoterol + Budesonide MDI', dosage: '6/200 mcg', frequency: '2 puffs twice daily', duration: 'Ongoing' },
      { name: 'Levocetirizine', dosage: '5mg', frequency: 'Once daily at night', duration: '7 days' },
      { name: 'Telmisartan', dosage: '40mg', frequency: 'Once daily', duration: 'Ongoing' },
    ],
    allergies: ['Sulfa drugs (Cotrimoxazole caused angioedema)'],
    familyHistory: 'Brother has allergic asthma.',
    socialHistory: 'Heavy smoker for 25 years (30 pack-years); quit 2 years ago.',
    doctorObservations: 'BP: 136/88 mmHg | Pulse: 92 bpm | SpO2: 94% on room air | Respiratory rate: 22/min | Chest: Diffuse expiratory polyphonic wheezes bilaterally.',
    investigations: ['Spirometry with bronchodilator reversibility', 'Sputum culture and sensitivity', 'Chest X-Ray PA view', 'Serum IgE levels'],
    assessment: 'Acute Exacerbation of Chronic Obstructive Pulmonary Disease (AECOPD) - mild to moderate severity, non-infective vs early bacterial. Essential hypertension.',
    treatmentPlan: '1. Nebulization with Salbutamol + Ipratropium Bromide tid.\n2. Inhaled corticosteroid combination optimized.\n3. Short 5-day course of Oral Prednisolone 30mg with tapering.\n4. Avoid all sulfa compounds.\n5. Pulmonary rehabilitation breathing exercises.',
    followUp: 'Review after 5 days or sooner if SpO2 drops below 92% or resting breathlessness worsens.',
    missingInformation: ['Baseline FEV1 value from previous year', 'Influenza and pneumococcal vaccination history'],
    uncertainInformation: ['Need for antibiotic therapy pending sputum microbiology'],
    summaries: {
      en: 'Ravi Shankar evaluated for acute COPD exacerbation with productive cough and wheezing. SpO2 94%. Nebulization, optimized inhalers, and spirometry advised. Sulfa allergy noted.',
      ta: 'ரவி சங்கர் சிஓபிடி தீவிரமடைதல் காரணமாக பரிசோதிக்கப்பட்டார். நெபுலைசேஷன் மற்றும் மூச்சுப்பயிற்சி பரிந்துரைக்கப்பட்டது.',
      hi: 'रवि शंकर का सीओपीडी तीव्रता के लिए परीक्षण किया गया। नेबुलाइजेशन और श्वास व्यायाम की सलाह दी गई।',
    },
  },
]

export default function HistoryPage() {
  const { patientId } = useParams<{ patientId?: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  // Load case sheets from localStorage or fallback
  const [caseSheets, setCaseSheets] = useState<CaseSheet[]>(() => {
    const saved = localStorage.getItem('medtrust_case_sheets')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch (e) {
        console.error('Failed parsing case sheets:', e)
      }
    }
    // Seed localStorage with initial data
    localStorage.setItem('medtrust_case_sheets', JSON.stringify(INITIAL_CASE_SHEETS))
    return INITIAL_CASE_SHEETS
  })

  // Load patients from localStorage
  const patients = useMemo<Patient[]>(() => {
    const saved = localStorage.getItem('medtrust_patients')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch { /* fallback */ }
    }
    return [
      { id: 'p1', name: 'Arjun Krishnamurthy', dob: '1985-06-15', age: 39, gender: 'male', phone: '+91 98765 43210', bloodGroup: 'B+', allergies: ['Penicillin'], conditions: ['Hypertension'], createdAt: '2024-01-10', updatedAt: '2024-09-20' },
      { id: 'p2', name: 'Priya Sundaram', dob: '1992-03-22', age: 32, gender: 'female', phone: '+91 87654 32109', bloodGroup: 'O+', allergies: [], conditions: ['Type 2 Diabetes'], createdAt: '2024-02-15', updatedAt: '2024-09-18' },
      { id: 'p3', name: 'Ravi Shankar', dob: '1970-11-08', age: 54, gender: 'male', phone: '+91 76543 21098', bloodGroup: 'A+', allergies: ['Sulfa'], conditions: ['COPD', 'Hypertension'], createdAt: '2024-03-01', updatedAt: '2024-09-15' },
    ]
  }, [])

  const currentPatient = useMemo(() => {
    if (!patientId) return null
    return patients.find(p => p.id === patientId) || null
  }, [patientId, patients])

  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'pending'>('all')
  const [selectedSheetForQuickView, setSelectedSheetForQuickView] = useState<CaseSheet | null>(null)

  // Filtered sheets
  const filteredSheets = useMemo(() => {
    return caseSheets.filter(sheet => {
      // Patient filter if param present
      if (patientId && sheet.patientId !== patientId) {
        return false
      }
      // Status filter
      if (filterStatus === 'approved' && !sheet.isApproved) return false
      if (filterStatus === 'pending' && sheet.isApproved) return false
      // Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const matchesName = sheet.patientName.toLowerCase().includes(q)
        const matchesDoctor = sheet.doctorName.toLowerCase().includes(q)
        const matchesComplaint = sheet.chiefComplaint.toLowerCase().includes(q)
        const matchesAssessment = sheet.assessment.toLowerCase().includes(q)
        const matchesDiagnosis = sheet.symptoms.some(s => s.toLowerCase().includes(q))
        if (!matchesName && !matchesDoctor && !matchesComplaint && !matchesAssessment && !matchesDiagnosis) {
          return false
        }
      }
      return true
    })
  }, [caseSheets, patientId, filterStatus, searchTerm])

  const stats = useMemo(() => {
    const list = patientId ? caseSheets.filter(s => s.patientId === patientId) : caseSheets
    return {
      total: list.length,
      approved: list.filter(s => s.isApproved).length,
      pending: list.filter(s => !s.isApproved).length,
      uniquePatients: new Set(list.map(s => s.patientId)).size,
    }
  }, [caseSheets, patientId])

  const handleDeleteSheet = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm('Are you sure you want to remove this case sheet from history?')) {
      const updated = caseSheets.filter(s => s.id !== id)
      setCaseSheets(updated)
      localStorage.setItem('medtrust_case_sheets', JSON.stringify(updated))
      if (selectedSheetForQuickView?.id === id) setSelectedSheetForQuickView(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Banner */}
      <div className="section-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="section-title">
              {currentPatient ? `Medical History: ${currentPatient.name}` : 'Consultation History & Case Sheets'}
            </h1>
            {currentPatient && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate('/history')}
                style={{ fontSize: 12, padding: '4px 10px' }}
              >
                ← View All Patients
              </button>
            )}
          </div>
          <p className="section-subtitle">
            {currentPatient
              ? `Review longitudinal clinical encounters, diagnosis timeline, and approved case sheets for ${currentPatient.name}`
              : 'Complete repository of clinical case sheets generated from teleconsultations, doctor electronic sign-offs, and diagnosis history'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/patients')}
            style={{ gap: 8 }}
          >
            <span>👥</span> Patient Directory
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/consultation')}
            style={{ gap: 8 }}
          >
            <span>📹</span> New Consultation
          </button>
        </div>
      </div>

      {/* Patient Highlight Card (if patientId is provided) */}
      {currentPatient && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(14, 116, 144, 0.25) 0%, rgba(15, 23, 42, 0.6) 100%)',
            border: '1px solid var(--color-border-hover)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div className="avatar avatar-teal avatar-lg" style={{ fontSize: 24, width: 64, height: 64 }}>
                {currentPatient.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text-primary)' }}>
                    {currentPatient.name}
                  </h2>
                  <span className="badge badge-info">{currentPatient.gender.toUpperCase()} · {currentPatient.age} yrs</span>
                  <span className="badge badge-teal">Blood: {currentPatient.bloodGroup || 'Not specified'}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Phone: <strong>{currentPatient.phone}</strong> {currentPatient.address && `· Address: ${currentPatient.address}`}
                </div>
              </div>
            </div>

            {/* Badges / Alerts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Allergies:</span>
                {currentPatient.allergies.length > 0 ? (
                  currentPatient.allergies.map(a => (
                    <span key={a} className="badge badge-warning" style={{ fontSize: 11 }}>⚠️ {a}</span>
                  ))
                ) : (
                  <span className="badge badge-success" style={{ fontSize: 11 }}>No Known Allergies</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Conditions:</span>
                {currentPatient.conditions.length > 0 ? (
                  currentPatient.conditions.map(c => (
                    <span key={c} className="badge badge-blue" style={{ fontSize: 11 }}>{c}</span>
                  ))
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>None recorded</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-4">
        <div className="stat-card teal">
          <div className="stat-icon teal">📋</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Case Sheets</div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon green">✅</div>
          <div className="stat-value">{stats.approved}</div>
          <div className="stat-label">Clinically Approved</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-icon amber">⏳</div>
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">Pending Sign-off</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon blue">👥</div>
          <div className="stat-value">{stats.uniquePatients}</div>
          <div className="stat-label">{patientId ? 'Patient Profile' : 'Unique Patients'}</div>
        </div>
      </div>

      {/* Controls Toolbar: Search & Filters */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
            <span style={{ fontSize: 16 }}>🔍</span>
            <input
              type="text"
              className="form-input"
              style={{ margin: 0 }}
              placeholder="Search by patient, doctor, diagnosis, symptoms, or complaint..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setSearchTerm('')}
                style={{ padding: '4px 8px' }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Filter:</span>
            <button
              className={`btn btn-sm ${filterStatus === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterStatus('all')}
            >
              All ({stats.total})
            </button>
            <button
              className={`btn btn-sm ${filterStatus === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterStatus('approved')}
            >
              Approved ({stats.approved})
            </button>
            <button
              className={`btn btn-sm ${filterStatus === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterStatus('pending')}
            >
              Pending ({stats.pending})
            </button>
          </div>
        </div>
      </div>

      {/* Case Sheets List */}
      {filteredSheets.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <span style={{ fontSize: 48 }}>📂</span>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 12 }}>
            No Case Sheets Found
          </h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4, maxWidth: 400, margin: '6px auto 16px' }}>
            {searchTerm
              ? `No records match "${searchTerm}". Try resetting your search filters.`
              : 'No medical consultations have been recorded for this view yet. Start a consultation to automatically generate case sheets.'}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/consultation')}
            style={{ margin: '0 auto' }}
          >
            Start Teleconsultation
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredSheets.map((sheet, idx) => {
            const isApproved = sheet.isApproved
            const dateStr = new Date(sheet.generatedAt).toLocaleDateString('en-IN', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <div
                key={sheet.id}
                className="card"
                style={{
                  padding: 20,
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                  border: isApproved ? '1px solid var(--color-border)' : '1px solid rgba(245, 158, 11, 0.4)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onClick={() => navigate(`/case-sheet/${sheet.id}`)}
                onMouseOver={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-teal)'
                  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
                }}
                onMouseOut={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = isApproved
                    ? 'var(--color-border)'
                    : 'rgba(245, 158, 11, 0.4)'
                  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                }}
              >
                {/* Accent line on left */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: 4,
                    background: isApproved ? 'var(--color-teal)' : 'var(--color-warning)',
                  }}
                />

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  {/* Left block: Patient + Complaint */}
                  <div style={{ display: 'flex', gap: 14, flex: 1, minWidth: 280 }}>
                    <div className="avatar avatar-teal" style={{ fontSize: 16, marginTop: 2 }}>
                      {sheet.patientName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)' }}>
                          {sheet.patientName}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                          ({sheet.patientInfo.age}y · {sheet.patientInfo.gender})
                        </span>
                        {isApproved ? (
                          <span className="badge badge-success badge-dot">Approved</span>
                        ) : (
                          <span className="badge badge-warning badge-dot">Pending Review</span>
                        )}
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>ID: {sheet.id}</span>
                      </div>

                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-teal)', marginTop: 4 }}>
                        Chief Complaint: {sheet.chiefComplaint}
                      </div>

                      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4, lineHeight: 1.5, maxHeight: 42, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sheet.assessment}
                      </p>

                      {/* Symptoms & Meds pill row */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                        {sheet.symptoms.slice(0, 3).map((symp, i) => (
                          <span key={i} className="badge badge-blue" style={{ fontSize: 11 }}>🩺 {symp}</span>
                        ))}
                        {sheet.symptoms.length > 3 && (
                          <span className="badge badge-ghost" style={{ fontSize: 11 }}>+{sheet.symptoms.length - 3} more</span>
                        )}
                        {sheet.medications.length > 0 && (
                          <span className="badge badge-info" style={{ fontSize: 11 }}>
                            💊 {sheet.medications.length} Rx {sheet.medications.map(m => m.name).slice(0, 2).join(', ')}
                          </span>
                        )}
                        {sheet.allergies.length > 0 && !sheet.allergies.includes('NKDA (No Known Drug Allergies)') && (
                          <span className="badge badge-warning" style={{ fontSize: 11 }}>
                            ⚠️ {sheet.allergies.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right block: Doctor, Date, Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {sheet.doctorName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        📅 {dateStr}
                      </div>
                      {isApproved && sheet.approvedBy && (
                        <div style={{ fontSize: 11, color: 'var(--color-success)', marginTop: 2 }}>
                          Signed by {sheet.approvedBy}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedSheetForQuickView(sheet)
                        }}
                      >
                        👁 Quick View
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/case-sheet/${sheet.id}`)
                        }}
                      >
                        Open Sheet →
                      </button>
                      {user?.role === 'doctor' && (
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          title="Delete case sheet"
                          onClick={(e) => handleDeleteSheet(sheet.id, e)}
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Quick View Modal */}
      {selectedSheetForQuickView && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedSheetForQuickView(null)}
        >
          <div
            className="modal"
            style={{ maxWidth: 760, maxHeight: '85vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="modal-title">Clinical Snapshot: {selectedSheetForQuickView.patientName}</div>
                  {selectedSheetForQuickView.isApproved ? (
                    <span className="badge badge-success">Approved</span>
                  ) : (
                    <span className="badge badge-warning">Pending Review</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Consultation on {new Date(selectedSheetForQuickView.generatedAt).toLocaleString()} · Attending: {selectedSheetForQuickView.doctorName}
                </div>
              </div>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setSelectedSheetForQuickView(null)}
              >
                ✕
              </button>
            </div>

            {/* Quick content sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
              {/* Patient Demographics */}
              <div style={{ background: 'var(--color-bg-glass)', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                  Patient Demographics & Vitals
                </div>
                <div className="grid grid-3" style={{ gap: 8, fontSize: 13 }}>
                  <div><strong>Age/Gender:</strong> {selectedSheetForQuickView.patientInfo.age} yrs / {selectedSheetForQuickView.patientInfo.gender}</div>
                  <div><strong>Blood Group:</strong> {selectedSheetForQuickView.patientInfo.bloodGroup || 'N/A'}</div>
                  <div><strong>Contact:</strong> {selectedSheetForQuickView.patientInfo.phone || 'N/A'}</div>
                </div>
                {selectedSheetForQuickView.doctorObservations && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-teal)', borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
                    <strong>Observations:</strong> {selectedSheetForQuickView.doctorObservations}
                  </div>
                )}
              </div>

              {/* Chief Complaint & HPI */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>🏥 Chief Complaint & Duration</div>
                <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 4, padding: '8px 12px', background: 'var(--color-bg-glass)', borderRadius: 'var(--radius-sm)' }}>
                  {selectedSheetForQuickView.chiefComplaint} ({selectedSheetForQuickView.duration})
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>📝 Assessment & Diagnosis</div>
                <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 4, padding: '8px 12px', background: 'var(--color-bg-glass)', borderRadius: 'var(--radius-sm)' }}>
                  {selectedSheetForQuickView.assessment}
                </div>
              </div>

              {/* Medications Table */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>💊 Prescribed Medications</div>
                {selectedSheetForQuickView.medications.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No medications prescribed</div>
                ) : (
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Drug</th><th>Dosage</th><th>Frequency</th><th>Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSheetForQuickView.medications.map((m, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{m.name}</td>
                            <td>{m.dosage}</td>
                            <td>{m.frequency}</td>
                            <td>{m.duration}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Treatment Plan & Follow up */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>💉 Treatment Plan & Follow-Up</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4, whiteSpace: 'pre-line', padding: '8px 12px', background: 'var(--color-bg-glass)', borderRadius: 'var(--radius-sm)' }}>
                  {selectedSheetForQuickView.treatmentPlan}
                  {'\n\n'}<strong>Follow-up:</strong> {selectedSheetForQuickView.followUp}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedSheetForQuickView(null)}
              >
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  navigate(`/case-sheet/${selectedSheetForQuickView.id}`)
                }}
              >
                Open Full 17-Section Sheet →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
