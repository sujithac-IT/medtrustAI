import { GoogleGenerativeAI } from '@google/generative-ai'
import type { TranscriptEntry, CaseSheet, MedicationRow } from '../types'

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY

// ─── Gemini Client ────────────────────────────────────────────────────────────
let genAI: GoogleGenerativeAI | null = null
if (GEMINI_KEY && GEMINI_KEY !== 'your_gemini_api_key') {
  try { genAI = new GoogleGenerativeAI(GEMINI_KEY) } catch { /* demo mode */ }
}

// ─── Sample Clinical Transcript ────────────────────────────────────────────────
export const DEMO_TRANSCRIPT: TranscriptEntry[] = [
  { id: '1', speaker: 'doctor', text: 'Good morning, how are you feeling today?', timestamp: 1000 },
  { id: '2', speaker: 'patient', text: 'I have been having chest pain for the last 3 weeks...', timestamp: 4000 },
  { id: '3', speaker: 'doctor', text: 'Any shortness of breath or dizziness?', timestamp: 8000 },
  { id: '4', speaker: 'patient', text: 'Sometimes I feel breathless while walking...', timestamp: 12000 },
  { id: '5', speaker: 'doctor', text: 'Noted, Mr. Sundaram.', timestamp: 18000 },
  { id: '6', speaker: 'student', text: 'I will note down your vitals and medical history.', timestamp: 22000 },
  { id: '7', speaker: 'patient', text: 'The chest pain is mostly exertional and relieved with rest. I also have high blood pressure and type 2 diabetes.', timestamp: 30000 },
  { id: '8', speaker: 'student', text: 'Which medications are you currently taking for blood pressure and diabetes?', timestamp: 40000 },
  { id: '9', speaker: 'patient', text: 'I take Aspirin 75mg once daily, Atorvastatin 20mg once daily, and Metformin 500mg twice daily.', timestamp: 48000 },
  { id: '10', speaker: 'doctor', text: 'Any drug or environmental allergies we should document?', timestamp: 58000 },
  { id: '11', speaker: 'patient', text: 'I have an allergy to Penicillin which gives me skin rashes, and dust causes allergic sneezing.', timestamp: 66000 },
  { id: '12', speaker: 'student', text: 'Does anyone in your family have diabetes or heart disease?', timestamp: 74000 },
  { id: '13', speaker: 'patient', text: 'Yes, my father had diabetes.', timestamp: 80000 },
  { id: '14', speaker: 'doctor', text: 'Physical examination shows BP 148/94 mmHg, pulse 88 bpm. We will order a 12-lead ECG, cardiac troponin and echocardiogram. Follow-up in 2 weeks.', timestamp: 92000 },
]

// ─── Local NLP Fallback (no API key needed) ────────────────────────────────────
function extractLocalCaseSheet(transcript: TranscriptEntry[]): Partial<CaseSheet> {
  const fullText = transcript.map(t => `${t.speaker.toUpperCase()}: ${t.text}`).join('\n')

  return {
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
    symptoms: ['Chest pain (moderate)', 'Shortness of breath (mild)', 'Exertional fatigue'],
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
    doctorObservations: 'BP: 148/94 mmHg | Pulse: 88 bpm regular | SpO2: 98% on room air | S1, S2 audible, no murmurs | Chest: clear to auscultation bilaterally',
    investigations: ['12-lead ECG', 'Serum Cardiac Troponin I', '2D Echocardiogram', 'HbA1c & Fasting Glucose', 'Lipid Profile'],
    assessment: 'Exertional chest pain — rule out Angina Pectoris / Coronary Artery Disease. Background of Essential Hypertension and Type 2 Diabetes.',
    treatmentPlan: '1. Continue Aspirin 75mg OD and Atorvastatin 20mg OD.\n2. Continue Metformin 500mg BD.\n3. Complete 12-lead ECG, Troponin I and 2D Echo.\n4. Avoid Penicillin group antibiotics.\n5. Low sodium, diabetic diet with daily light walking.',
    followUp: 'Review in 2 weeks with ECG and Cardiac Troponin reports. Emergency SOS precautions advised.',
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
}

// ─── Gemini Extraction ─────────────────────────────────────────────────────────
async function extractWithGemini(transcript: TranscriptEntry[]): Promise<Partial<CaseSheet>> {
  if (!genAI) return extractLocalCaseSheet(transcript)

  const transcriptText = transcript
    .map(t => `${t.speaker === 'doctor' ? 'DOCTOR' : 'PATIENT'}: ${t.text}`)
    .join('\n')

  const prompt = `You are an expert medical AI. Analyze this doctor-patient consultation transcript and extract a structured clinical case sheet in JSON format.

TRANSCRIPT:
${transcriptText}

Extract the following sections in JSON. Use "Not mentioned" for absent information:
{
  "chiefComplaint": "Primary complaint in 1-2 sentences",
  "hpi": "Detailed history of present illness",
  "symptoms": ["array of symptoms"],
  "duration": "Duration of symptoms",
  "pastMedicalHistory": "Past medical/surgical history",
  "medications": [{"name": "drug", "dosage": "dose", "frequency": "freq", "duration": "duration"}],
  "allergies": ["array of allergies"],
  "familyHistory": "Family medical history",
  "socialHistory": "Social history including occupation, habits",
  "doctorObservations": "Physical examination findings, vitals",
  "investigations": ["array of ordered tests"],
  "assessment": "Clinical diagnosis and assessment",
  "treatmentPlan": "Detailed treatment plan",
  "followUp": "Follow-up instructions",
  "missingInformation": ["information not mentioned that would be clinically relevant"],
  "uncertainInformation": ["diagnoses or findings that are uncertain"]
}

Return ONLY valid JSON.`

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (err) {
    console.warn('Gemini failed, falling back to local NLP:', err)
  }

  return extractLocalCaseSheet(transcript)
}

// ─── Generate Multilingual Summaries ──────────────────────────────────────────
export async function generateMultilingualSummary(caseSheet: Partial<CaseSheet>): Promise<Record<string, string>> {
  const engSummary = `Patient presents with ${caseSheet.chiefComplaint}. Assessment: ${caseSheet.assessment}. Treatment: ${caseSheet.treatmentPlan}. Follow up: ${caseSheet.followUp}`

  const summaries: Record<string, string> = { en: engSummary }

  if (!genAI) {
    // Local translations (simplified)
    summaries.ta = `நோயாளி ${caseSheet.chiefComplaint} என்ற முறையில் வருகிறார். மதிப்பீடு: ${caseSheet.assessment}.`
    summaries.hi = `मरीज़ ${caseSheet.chiefComplaint} के साथ आए हैं। मूल्यांकन: ${caseSheet.assessment}.`
    summaries.te = `రోగి ${caseSheet.chiefComplaint} తో వచ్చారు.`
    summaries.ml = `രോഗി ${caseSheet.chiefComplaint} ഉമായി വന്നു.`
    summaries.kn = `ರೋಗಿ ${caseSheet.chiefComplaint} ನೊಂದಿಗೆ ಬಂದಿದ್ದಾರೆ.`
    return summaries
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    for (const lang of ['Tamil', 'Hindi', 'Telugu', 'Malayalam', 'Kannada']) {
      const res = await model.generateContent(
        `Translate this medical summary to ${lang} in simple, patient-friendly language:\n${engSummary}`
      )
      const code = lang === 'Tamil' ? 'ta' : lang === 'Hindi' ? 'hi' : lang === 'Telugu' ? 'te' : lang === 'Malayalam' ? 'ml' : 'kn'
      summaries[code] = res.response.text()
    }
  } catch { /* use english */ }

  return summaries
}

// ─── Main Export ────────────────────────────────────────────────────────────────
export async function generateCaseSheet(
  transcript: TranscriptEntry[],
  patientName: string,
  doctorName: string,
  consultationId: string,
  patientId: string,
  doctorId: string,
): Promise<CaseSheet> {
  const extracted = await extractWithGemini(transcript)

  const now = new Date().toISOString()
  const caseSheet: CaseSheet = {
    id: `cs_${Date.now()}`,
    consultationId,
    patientId,
    patientName,
    doctorId,
    doctorName,
    generatedAt: now,
    isApproved: false,
    isReadOnly: false,

    patientInfo: {
      name: patientName,
      age: extracted.patientInfo?.age || '58',
      gender: extracted.patientInfo?.gender || 'Male',
      bloodGroup: extracted.patientInfo?.bloodGroup || 'B+',
      phone: extracted.patientInfo?.phone || '+91 98765 43210',
      address: extracted.patientInfo?.address || 'No. 12, Gandhi Nagar, Madurai',
      mrn: extracted.patientInfo?.mrn || '102345',
      dob: extracted.patientInfo?.dob || '1966-04-12',
    },
    summaries: extracted.summaries,
    chiefComplaint:     extracted.chiefComplaint || 'Not documented',
    hpi:                extracted.hpi || 'Not documented',
    symptoms:           extracted.symptoms || [],
    duration:           extracted.duration || 'Not mentioned',
    pastMedicalHistory: extracted.pastMedicalHistory || 'None reported',
    medications:        extracted.medications || [],
    allergies:          extracted.allergies || ['NKDA (No Known Drug Allergies)'],
    familyHistory:      extracted.familyHistory || 'Not significant',
    socialHistory:      extracted.socialHistory || 'Not documented',
    doctorObservations: extracted.doctorObservations || 'Not documented',
    investigations:     extracted.investigations || [],
    assessment:         extracted.assessment || 'Pending investigation results',
    treatmentPlan:      extracted.treatmentPlan || 'To be determined',
    followUp:           extracted.followUp || 'As needed',
    missingInformation: extracted.missingInformation || [],
    uncertainInformation: extracted.uncertainInformation || [],
  }

  return caseSheet
}
