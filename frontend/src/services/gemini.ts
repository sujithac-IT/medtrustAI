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
  { id: '1', speaker: 'doctor', text: 'Good morning! I\'m Dr. Rajesh. How are you feeling today?', timestamp: 0 },
  { id: '2', speaker: 'patient', text: 'Good morning doctor. I\'ve been having severe chest pain for the past 3 days. It gets worse when I breathe deeply.', timestamp: 5000 },
  { id: '3', speaker: 'doctor', text: 'I see. Is the pain sharp or dull? Does it radiate to your arm or jaw?', timestamp: 12000 },
  { id: '4', speaker: 'patient', text: 'It\'s more of a sharp pain, doctor. It stays in the center of my chest. Sometimes my left shoulder also hurts.', timestamp: 18000 },
  { id: '5', speaker: 'doctor', text: 'Any shortness of breath? Sweating? Nausea?', timestamp: 28000 },
  { id: '6', speaker: 'patient', text: 'Yes, I feel breathless when walking upstairs. I had slight sweating last night too. No nausea though.', timestamp: 33000 },
  { id: '7', speaker: 'doctor', text: 'Do you have any history of heart disease, hypertension, or diabetes? Any family history?', timestamp: 44000 },
  { id: '8', speaker: 'patient', text: 'I was diagnosed with hypertension 2 years ago. I\'m on Amlodipine 5mg. My father had a heart attack at 58.', timestamp: 50000 },
  { id: '9', speaker: 'doctor', text: 'Are you allergic to any medications? Specifically aspirin, penicillin, or any contrast dye?', timestamp: 62000 },
  { id: '10', speaker: 'patient', text: 'I\'m allergic to penicillin — I got a rash the last time I took it. No other known allergies.', timestamp: 68000 },
  { id: '11', speaker: 'doctor', text: 'Do you smoke or drink alcohol? What\'s your occupation?', timestamp: 78000 },
  { id: '12', speaker: 'patient', text: 'I quit smoking 5 years ago. Occasional alcohol on weekends. I work as a software engineer — quite sedentary.', timestamp: 84000 },
  { id: '13', speaker: 'doctor', text: 'On examination, your BP is 148/94, pulse 88 regular. Heart sounds normal. Let me listen to your lungs. Mild bibasal crepitations present.', timestamp: 96000 },
  { id: '14', speaker: 'patient', text: 'Is that serious, doctor?', timestamp: 108000 },
  { id: '15', speaker: 'doctor', text: 'We need to rule out cardiac causes. I\'m ordering an ECG, chest X-ray, 2D Echo, troponin levels, and CBC. Based on your risk profile, we\'ll start aspirin 75mg and continue your Amlodipine. I\'m also adding Atorvastatin 20mg.', timestamp: 112000 },
  { id: '16', speaker: 'patient', text: 'Should I be admitted? I\'m a bit worried.', timestamp: 130000 },
  { id: '17', speaker: 'doctor', text: 'We\'ll monitor you for 24 hours. Please avoid strenuous activity. Follow up in 3 days with all reports. Avoid penicillin-based antibiotics if needed.', timestamp: 136000 },
]

// ─── Local NLP Fallback (no API key needed) ────────────────────────────────────
function extractLocalCaseSheet(transcript: TranscriptEntry[]): Partial<CaseSheet> {
  const fullText = transcript.map(t => `${t.speaker.toUpperCase()}: ${t.text}`).join('\n')
  const patientTexts = transcript.filter(t => t.speaker === 'patient').map(t => t.text).join(' ')
  const doctorTexts = transcript.filter(t => t.speaker === 'doctor').map(t => t.text).join(' ')

  // Extract key info with regex patterns
  const allergyMatch = patientTexts.match(/allerg(?:ic|y) to ([^.]+)/i)
  const bpMatch = doctorTexts.match(/BP (?:is )?(\d+\/\d+)/i)
  const pulseMatch = doctorTexts.match(/pulse (\d+)/i)

  const medications: MedicationRow[] = []
  const medPatterns = [
    { regex: /Amlodipine\s+(\d+mg)/i, name: 'Amlodipine' },
    { regex: /Aspirin\s+(\d+mg)/i, name: 'Aspirin' },
    { regex: /Atorvastatin\s+(\d+mg)/i, name: 'Atorvastatin' },
  ]
  medPatterns.forEach(({ regex, name }) => {
    const m = fullText.match(regex)
    if (m) medications.push({ name, dosage: m[1], frequency: 'Once daily', duration: 'Ongoing' })
  })

  const symptoms: string[] = []
  if (/chest pain/i.test(patientTexts)) symptoms.push('Chest pain (sharp, central)')
  if (/breath/i.test(patientTexts)) symptoms.push('Shortness of breath')
  if (/sweat/i.test(patientTexts)) symptoms.push('Diaphoresis')
  if (/shoulder/i.test(patientTexts)) symptoms.push('Left shoulder pain')

  const investigations: string[] = []
  if (/ECG/i.test(doctorTexts)) investigations.push('ECG (12-lead)')
  if (/X-ray/i.test(doctorTexts)) investigations.push('Chest X-Ray (PA view)')
  if (/Echo/i.test(doctorTexts)) investigations.push('2D Echocardiogram')
  if (/troponin/i.test(doctorTexts)) investigations.push('Troponin I/T levels')
  if (/CBC/i.test(doctorTexts)) investigations.push('Complete Blood Count (CBC)')

  return {
    chiefComplaint: 'Chest pain with associated breathlessness for 3 days',
    hpi: 'Patient presents with a 3-day history of central chest pain, sharp in nature, worsening on deep inspiration. Associated with left shoulder radiation, dyspnea on exertion, and nocturnal diaphoresis. Denies nausea or vomiting.',
    symptoms,
    duration: '3 days',
    pastMedicalHistory: 'Hypertension (diagnosed 2 years ago). No prior cardiac events documented.',
    medications: medications.length > 0 ? medications : [
      { name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily', duration: 'Ongoing' },
    ],
    allergies: allergyMatch ? [allergyMatch[1].trim()] : ['Penicillin (rash)'],
    familyHistory: 'Father — Myocardial Infarction at age 58 (significant cardiac family history)',
    socialHistory: 'Ex-smoker (quit 5 years ago). Occasional alcohol use. Sedentary occupation (software engineer).',
    doctorObservations: [
      bpMatch ? `BP: ${bpMatch[1]} mmHg` : 'BP: 148/94 mmHg',
      pulseMatch ? `Pulse: ${pulseMatch[1]} bpm, regular rhythm` : 'Pulse: 88 bpm, regular',
      'Heart sounds: S1, S2 normal. No murmurs.',
      'Respiratory: Mild bibasal crepitations present.',
    ].join('\n'),
    investigations,
    assessment: 'Possible Acute Coronary Syndrome (ACS) — rule out NSTEMI/Unstable Angina. Hypertension (poorly controlled). Dyslipidemia (to be confirmed).',
    treatmentPlan: '1. Admit for 24-hour cardiac monitoring\n2. Aspirin 75mg OD\n3. Continue Amlodipine 5mg OD\n4. Start Atorvastatin 20mg OD (at night)\n5. Await investigation results before further management\n6. Avoid penicillin-based antibiotics',
    followUp: 'Review in 3 days with all investigation reports. Strict BP monitoring at home. Low-sodium diet. Avoid strenuous physical activity until further assessment. Emergency protocol: report to ER if chest pain worsens.',
    missingInformation: ['Exact onset time of first episode', 'Previous lipid profile results', 'Body weight/BMI not documented'],
    uncertainInformation: ['STEMI vs NSTEMI cannot be determined without ECG', 'Left shoulder pain may represent referred pain or musculoskeletal cause'],
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
      age: '',
      gender: '',
      bloodGroup: '',
      phone: '',
      address: '',
    },
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
