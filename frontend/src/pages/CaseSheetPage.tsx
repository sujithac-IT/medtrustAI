import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CaseSheetForm from '../components/CaseSheetForm'
import type { CaseSheet } from '../types'

const SUNDARAM_SHEET: CaseSheet = {
  id: 'cs-sundaram',
  consultationId: 'c_102345',
  patientId: 'p_sundaram',
  patientName: 'K. Sundaram',
  doctorId: 'doc-001',
  doctorName: 'Dr. Rajesh Sharma, MD',
  department: 'Cardiology',
  generatedAt: '2025-04-12T10:30:00Z',
  isApproved: false,
  isReadOnly: false,
  patientInfo: {
    name: 'K. Sundaram',
    age: '58',
    gender: 'Male',
    bloodGroup: 'B+',
    phone: '+91 98765 43210',
    address: 'No. 12, Gandhi Nagar, Madurai',
    mrn: '102345',
    dob: '1966-04-12',
  },
  chiefComplaint: 'Chest pain',
  hpi: 'Patient is a 56-year-old male who presents with complaints of chest pain for the past 3 weeks. The pain is exertional and relieved with rest. Associated with exertional shortness of breath and follow-up in 2 weeks.',
  symptoms: ['Chest pain (moderate)', 'Shortness of breath (mild)'],
  duration: '3 weeks, gradual onset',
  pastMedicalHistory: 'Hypertension, Type 2 Diabetes',
  medications: [
    { name: 'Aspirin', dosage: '75mg', frequency: 'OD', route: 'Oral', duration: 'Long-term' },
    { name: 'Atorvastatin', dosage: '20mg', frequency: 'OD', route: 'Oral', duration: 'Long-term' },
    { name: 'Metformin', dosage: '500mg', frequency: 'BD', route: 'Oral', duration: '3 months' },
  ],
  allergies: ['Penicillin', 'Dust'],
  familyHistory: 'Father - Diabetes',
  socialHistory: 'Desk job, non-smoker, occasional alcohol',
  doctorObservations: 'BP: 148/94 mmHg | Pulse: 88 bpm regular | SpO2: 98% on room air | S1, S2 audible, no murmurs',
  investigations: ['12-lead ECG', 'Serum Cardiac Troponin I', '2D Echocardiogram', 'HbA1c & Fasting Glucose', 'Lipid Profile'],
  assessment: 'Exertional chest pain — rule out Angina Pectoris / Coronary Artery Disease. Background of Essential Hypertension and Type 2 Diabetes.',
  treatmentPlan: '1. Continue Aspirin 75mg OD and Atorvastatin 20mg OD.\n2. Continue Metformin 500mg BD.\n3. Complete 12-lead ECG and 2D Echo.\n4. Avoid Penicillin group antibiotics.\n5. Low sodium, diabetic diet with daily light walking.',
  followUp: 'Review in 2 weeks with ECG and Cardiac Troponin reports.',
  missingInformation: ['Baseline Lipid profile values', 'Previous year HbA1c trending log'],
  uncertainInformation: ['Cardiac ischemia vs musculoskeletal chest wall component pending ECG'],
  summaries: {
    en: 'Mr. K. Sundaram, 58 years old male, presented with chest pain for the past 3 weeks. He has a history of hypertension and type 2 diabetes. Currently on aspirin, atorvastatin and metformin. Advised further cardiac evaluation and follow-up in 2 weeks.',
    ta: 'திரு கே. சுந்தரம், 58 வயது ஆண், கடந்த 3 வாரங்களாக மார்பு வலியுடன் வந்துள்ளார். அவருக்கு உயர் இரத்த அழுத்தம் மற்றும் வகை 2 நீரிழிவு நோய் வரலாறு உள்ளது. தற்போது ஆஸ்பிரின், அடோர்வாஸ்டாடின் மற்றும் மெட்ஃபோர்மின் சாப்பிடுகிறார். மேலும் இதய பரிசோதனை மற்றும் 2 வாரங்களில் மறு சோதனை பரிந்துரைக்கப்பட்டது.',
    hi: 'श्री के. सुंदरम, 58 वर्षीय पुरुष, पिछले 3 हफ्तों से सीने में दर्द के साथ आए। उन्हें उच्च रक्तचाप और टाइप 2 मधुमेह का इतिहास है। वर्तमान में एस्पिरिन, एटोरवास्टेटिन और मेटफॉर्मिन ले रहे हैं। आगे हृदय मूल्यांकन और 2 सप्ताह में अनुवर्ती की सलाह दी गई।',
    te: 'శ్రీ కె. సుందరం, 58 సంవత్సరాల పురుషుడు, గత 3 వారాలుగా ఛాతీ నొప్పితో వచ్చారు. వారికి హైపర్టెన్షన్ మరియు టైప్ 2 మధుమేహ చరిత్ర ఉంది. ప్రస్తుతం ఆస్పిరిన్, అటోర్వాస్టాటిన్ మరియు మెట్‌ఫార్మిన్ తీసుకుంటున్నారు. మరింత గుండె మూల్యాంకనం మరియు 2 వారాల్లో ఫాలో-అప్ సలహా ఇవ్వబడింది.',
    ml: 'ശ്രീ കെ. സുന്ദരം, 58 വയസ്സുള്ള പുരുഷൻ, കഴിഞ്ഞ 3 ആഴ്ചയായി നെഞ്ചുവേദനയുമായി വന്നു. അദ്ദേഹത്തിന് ഹൈപ്പർടെൻഷനും ടൈപ്പ് 2 പ്രമേഹവും ഉണ്ട്. ഇപ്പോൾ ആസ്പിരിൻ, അറ്റോർവാസ്റ്റാറ്റിൻ, മെറ്റ്ഫോർമിൻ എന്നിവ കഴിക്കുന്നു. കൂടുതൽ ഹൃദയ പരിശോധനയും 2 ആഴ്ചയ്ക്കുള്ളിൽ ഫോളോ-അപ്പും നിർദ്ദേശിച്ചു.',
    kn: 'ಶ್ರೀ ಕೆ. ಸುಂದರಂ, 58 ವರ್ಷದ ಪುರುಷ, ಕಳೆದ 3 ವಾರಗಳಿಂದ ಎದೆ ನೋವಿನೊಂದಿಗೆ ಬಂದಿದ್ದಾರೆ. ಅವರಿಗೆ ಅಧಿಕ ರಕ್ತದೊತ್ತಡ ಮತ್ತು ಟೈಪ್ 2 ಮಧುಮೇಹ ಇತಿಹಾಸ ಇದೆ. ಪ್ರಸ್ತುತ ಆಸ್ಪಿರಿನ್, ಅಟೋರ್ವಾಸ್ಟಾಟಿನ್ ಮತ್ತು ಮೆಟ್ಫಾರ್ಮಿನ್ ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದ್ದಾರೆ. ಹೆಚ್ಚಿನ ಹೃದಯ ಮೌಲ್ಯಮಾಪನ ಮತ್ತು 2 ವಾರಗಳಲ್ಲಿ ಫಾಲೋ-ಅಪ್ ಸೂಚಿಸಲಾಗಿದೆ.',
  },
}

export default function CaseSheetPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [caseSheet, setCaseSheet] = useState<CaseSheet>(SUNDARAM_SHEET)

  useEffect(() => {
    const targetId = id || 'cs-sundaram'
    const saved = localStorage.getItem('medtrust_case_sheets')
    if (saved) {
      try {
        const list: CaseSheet[] = JSON.parse(saved)
        const found = list.find(s => s.id === targetId || s.id === 'cs-sundaram')
        if (found) {
          setCaseSheet(found)
          return
        }
      } catch (err) {
        console.error('Error reading case sheets from localStorage:', err)
      }
    }
    setCaseSheet(SUNDARAM_SHEET)
  }, [id])

  const handleUpdate = (updated: CaseSheet) => {
    setCaseSheet(updated)
    const saved = localStorage.getItem('medtrust_case_sheets')
    let list: CaseSheet[] = []
    if (saved) {
      try { list = JSON.parse(saved) } catch {}
    }
    const idx = list.findIndex(s => s.id === updated.id)
    if (idx >= 0) {
      list[idx] = updated
    } else {
      list.push(updated)
    }
    localStorage.setItem('medtrust_case_sheets', JSON.stringify(list))
  }

  const handleApprove = () => {
    const approved: CaseSheet = {
      ...caseSheet,
      isApproved: true,
      isReadOnly: true,
      approvedAt: new Date().toISOString(),
      approvedBy: user?.displayName || 'Dr. Rajesh Sharma, MD',
    }
    handleUpdate(approved)
  }

  return (
    <div style={{ height: 'calc(100vh - 110px)', display: 'flex', flexDirection: 'column' }}>
      <CaseSheetForm
        caseSheet={caseSheet}
        onUpdate={handleUpdate}
        onApprove={handleApprove}
        isDoctor={user?.role === 'doctor'}
        onBack={() => navigate('/consultation')}
      />
    </div>
  )
}
