import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CaseSheetForm from '../components/CaseSheetForm'
import type { CaseSheet } from '../types'

// Default fallback demo case sheets if localStorage doesn't have it
const FALLBACK_SHEETS: Record<string, CaseSheet> = {
  cs1: {
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
  cs2: {
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
  },
}

export default function CaseSheetPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [caseSheet, setCaseSheet] = useState<CaseSheet | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }

    // Try finding in localStorage
    const saved = localStorage.getItem('medtrust_case_sheets')
    if (saved) {
      try {
        const list: CaseSheet[] = JSON.parse(saved)
        const found = list.find(s => s.id === id)
        if (found) {
          setCaseSheet(found)
          setLoading(false)
          return
        }
      } catch (err) {
        console.error('Error parsing stored case sheets:', err)
      }
    }

    // Fallback dictionary
    if (FALLBACK_SHEETS[id]) {
      setCaseSheet(FALLBACK_SHEETS[id])
    }

    setLoading(false)
  }, [id])

  const handleUpdate = (updated: CaseSheet) => {
    setCaseSheet(updated)
    const saved = localStorage.getItem('medtrust_case_sheets')
    if (saved) {
      try {
        const list: CaseSheet[] = JSON.parse(saved)
        const idx = list.findIndex(s => s.id === updated.id)
        if (idx >= 0) {
          list[idx] = updated
        } else {
          list.push(updated)
        }
        localStorage.setItem('medtrust_case_sheets', JSON.stringify(list))
      } catch (e) {
        console.error('Error updating case sheet in storage:', e)
      }
    }
  }

  const handleApprove = () => {
    if (!caseSheet) return
    const approved: CaseSheet = {
      ...caseSheet,
      isApproved: true,
      isReadOnly: true,
      approvedAt: new Date().toISOString(),
      approvedBy: user?.displayName || 'Attending Physician',
    }
    handleUpdate(approved)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 44, height: 44, border: '3px solid rgba(0,212,170,0.2)', borderTop: '3px solid var(--color-teal)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Loading Clinical Case Sheet...</p>
      </div>
    )
  }

  if (!caseSheet) {
    return (
      <div className="card" style={{ padding: 48, textAlign: 'center', maxWidth: 600, margin: '40px auto' }}>
        <span style={{ fontSize: 54 }}>📋</span>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text-primary)', marginTop: 16 }}>
          Case Sheet Not Found
        </h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 8, marginBottom: 24 }}>
          No case sheet with ID <code>{id}</code> could be located in your local session repository.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => navigate('/history')}>
            ← Back to History
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/consultation')}>
            Start New Consultation
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', gap: 14 }}>
      {/* Navigation and quick info bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'var(--color-bg-glass)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/history')}
            style={{ fontSize: 13, gap: 6 }}
          >
            ← Back
          </button>
          <div style={{ width: 1, height: 20, background: 'var(--color-border)' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text-primary)' }}>
                {caseSheet.patientName}
              </span>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                ({caseSheet.patientInfo.age}y {caseSheet.patientInfo.gender})
              </span>
              {caseSheet.isApproved ? (
                <span className="badge badge-success badge-dot">Approved</span>
              ) : (
                <span className="badge badge-warning badge-dot">Pending Review</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              Consultation ID: {caseSheet.consultationId} · Generated: {new Date(caseSheet.generatedAt).toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate(`/history/${caseSheet.patientId}`)}
          >
            👤 Patient Records
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => window.print()}
          >
            🖨️ Print Sheet
          </button>
        </div>
      </div>

      {/* Embedded Form Body */}
      <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
        <CaseSheetForm
          caseSheet={caseSheet}
          onUpdate={handleUpdate}
          onApprove={handleApprove}
          isDoctor={user?.role === 'doctor'}
        />
      </div>
    </div>
  )
}
