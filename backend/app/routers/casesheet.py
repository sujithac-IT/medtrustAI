from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime
from app.models.schemas import (
    CaseSheet,
    GenerateCaseSheetRequest,
    CaseSheetApproval,
    MedicationRow,
    PatientInfoSection
)
from app.services.gemini_service import extract_with_gemini, generate_multilingual_summaries

router = APIRouter(prefix="/casesheet", tags=["CaseSheet"])

# Seed with initial case sheets
_CASESHEETS_DB: List[CaseSheet] = [
    CaseSheet(
        id="cs1",
        consultationId="c1",
        patientId="p1",
        patientName="Arjun Krishnamurthy",
        doctorId="demo-doctor-001",
        doctorName="Dr. Rajesh Kumar",
        generatedAt="2024-09-20T10:35:00Z",
        approvedAt="2024-09-20T10:42:00Z",
        approvedBy="Dr. Rajesh Kumar",
        isApproved=True,
        isReadOnly=True,
        patientInfo=PatientInfoSection(
            name="Arjun Krishnamurthy",
            age="39",
            gender="male",
            bloodGroup="B+",
            phone="+91 98765 43210",
            address="14, Gandhi Nagar, Adyar, Chennai"
        ),
        chiefComplaint="Severe central chest pain radiating to left shoulder for 3 days",
        hpi="Patient presents with 3-day history of sharp chest pain worsening on deep inspiration and exertion. Associated with nocturnal diaphoresis and mild exertional dyspnea. Denies nausea, palpitations, or syncope.",
        symptoms=["Sharp chest pain", "Left shoulder pain", "Shortness of breath on exertion", "Nocturnal diaphoresis"],
        duration="3 days",
        pastMedicalHistory="Essential hypertension (2 years). No previous MI or revascularization.",
        medications=[
            MedicationRow(name="Amlodipine", dosage="5mg", frequency="Once daily (morning)", duration="Ongoing"),
            MedicationRow(name="Aspirin", dosage="75mg", frequency="Once daily (post-food)", duration="14 days"),
            MedicationRow(name="Atorvastatin", dosage="20mg", frequency="Once daily (bedtime)", duration="30 days"),
        ],
        allergies=["Penicillin (skin rash, hives)"],
        familyHistory="Father: Acute Myocardial Infarction at age 58",
        socialHistory="Ex-smoker (cessation 5 years ago). Occasional alcohol consumption. Sedentary IT professional.",
        doctorObservations="BP: 148/94 mmHg | Pulse: 88 bpm regular | SpO2: 98% on RA | S1, S2 audible, no murmurs | Chest: Mild bibasal inspiratory crackles",
        investigations=["12-lead ECG (urgent)", "High-sensitivity Troponin I", "2D Echocardiogram", "Chest X-Ray PA view", "Complete Blood Count (CBC)"],
        assessment="Suspected Acute Coronary Syndrome (ACS) - Rule out NSTEMI / Unstable Angina. Poorly controlled hypertension.",
        treatmentPlan="1. Immediate 12-lead ECG and serial cardiac troponin monitoring.\n2. Dual antiplatelet protocol initiated.\n3. Continue Amlodipine 5mg OD; add Atorvastatin 20mg OD.\n4. Avoid penicillin group drugs.\n5. Strict bed rest with telemetry monitoring.",
        followUp="Review with ECG and Troponin reports within 48-72 hours. Strict BP diary. Emergency protocol provided.",
        missingInformation=["Exact onset time of primary pain episode", "Baseline lipid profile and HbA1c"],
        uncertainInformation=["Musculoskeletal contribution vs ischemic cardiac etiology"],
        summaries={
            "en": "Patient Arjun Krishnamurthy evaluated for Acute Coronary Syndrome. ECG, Troponin, Echo ordered. Aspirin and Statin initiated.",
            "ta": "நோயாளி அர்ஜுன் கிருஷ்ணமூர்த்தி மார்பு வலி காரணமாக பரிசோதிக்கப்பட்டார். ஆஸ்பிரின் மற்றும் அடோர்வாஸ்டாடின் பரிந்துரைக்கப்பட்டது.",
            "hi": "रोगी अर्जुन कृष्णमूर्ति का सीने में दर्द और सांस फूलने का मूल्यांकन किया गया।"
        }
    ),
    CaseSheet(
        id="cs2",
        consultationId="c2",
        patientId="p2",
        patientName="Priya Sundaram",
        doctorId="demo-doctor-001",
        doctorName="Dr. Rajesh Kumar",
        generatedAt="2024-09-20T12:05:00Z",
        approvedAt="2024-09-20T12:12:00Z",
        approvedBy="Dr. Rajesh Kumar",
        isApproved=True,
        isReadOnly=True,
        patientInfo=PatientInfoSection(
            name="Priya Sundaram",
            age="32",
            gender="female",
            bloodGroup="O+",
            phone="+91 87654 32109",
            address="22/B, Anna Nagar West, Chennai"
        ),
        chiefComplaint="Routine diabetes quarterly review and progressive fatigue",
        hpi="Known patient with Type 2 Diabetes Mellitus (diagnosed 3 years ago). Reports persistent lethargy and mild pedal tingling.",
        symptoms=["Fatigue and lethargy", "Polyuria", "Bilateral mild pedal tingling"],
        duration="4 weeks",
        pastMedicalHistory="Type 2 Diabetes Mellitus.",
        medications=[
            MedicationRow(name="Metformin Hydrochloride", dosage="500mg", frequency="Twice daily with meals", duration="Ongoing"),
            MedicationRow(name="Vitamin B-Complex with Methylcobalamin", dosage="1 tablet", frequency="Once daily", duration="30 days"),
        ],
        allergies=["NKDA (No Known Drug Allergies)"],
        familyHistory="Maternal grandmother and mother have Type 2 Diabetes.",
        socialHistory="Non-smoker, non-drinker. High work-related screen time.",
        doctorObservations="BP: 122/80 mmHg | Pulse: 76 bpm regular | BMI: 27.2 kg/m²",
        investigations=["Fasting & Postprandial Blood Glucose", "HbA1c", "Urine Microalbumin/Creatinine Ratio", "Lipid Profile"],
        assessment="Type 2 Diabetes Mellitus with suboptimal glycemic control. Early mild peripheral neuropathy.",
        treatmentPlan="1. Up-titrate Metformin after labs.\n2. Methylcobalamin supplementation.\n3. Low glycemic index nutrition.\n4. Daily brisk walking.",
        followUp="Review in 2 weeks with HbA1c and urine microalbumin.",
        missingInformation=["Last documented home glucometer log"],
        uncertainInformation=["Degree of nephropathy awaiting microalbumin ratio"],
    )
]

@router.get("", response_model=List[CaseSheet])
def get_case_sheets():
    """List all case sheets."""
    return _CASESHEETS_DB

@router.get("/{casesheet_id}", response_model=CaseSheet)
def get_case_sheet(casesheet_id: str):
    """Retrieve case sheet by ID."""
    for s in _CASESHEETS_DB:
        if s.id == casesheet_id:
            return s
    raise HTTPException(status_code=404, detail="Case sheet not found")

@router.get("/patient/{patient_id}", response_model=List[CaseSheet])
def get_patient_case_sheets(patient_id: str):
    """Retrieve all case sheets for a given patient (longitudinal history)."""
    return [s for s in _CASESHEETS_DB if s.patientId == patient_id]

@router.post("/generate", response_model=CaseSheet)
async def generate_case_sheet_endpoint(payload: GenerateCaseSheetRequest):
    """Generate 17-section structured case sheet from transcript using Gemini AI with local NLP fallback."""
    extracted = await extract_with_gemini(payload.transcript)
    summaries = generate_multilingual_summaries(extracted, payload.patientName)

    now = datetime.utcnow().isoformat() + "Z"
    new_id = f"cs_{int(datetime.utcnow().timestamp())}"

    case_sheet = CaseSheet(
        id=new_id,
        consultationId=payload.consultationId,
        patientId=payload.patientId,
        patientName=payload.patientName,
        doctorId=payload.doctorId,
        doctorName=payload.doctorName,
        generatedAt=now,
        isApproved=False,
        isReadOnly=False,
        patientInfo=PatientInfoSection(
            name=payload.patientName,
            age="",
            gender="",
            bloodGroup="",
            phone="",
            address=""
        ),
        chiefComplaint=extracted.get("chiefComplaint", "Not documented"),
        hpi=extracted.get("hpi", "Not documented"),
        symptoms=extracted.get("symptoms", []),
        duration=extracted.get("duration", "Not mentioned"),
        pastMedicalHistory=extracted.get("pastMedicalHistory", "None reported"),
        medications=[MedicationRow(**m) for m in extracted.get("medications", [])],
        allergies=extracted.get("allergies", ["NKDA"]),
        familyHistory=extracted.get("familyHistory", "Not significant"),
        socialHistory=extracted.get("socialHistory", "Not documented"),
        doctorObservations=extracted.get("doctorObservations", "Not documented"),
        investigations=extracted.get("investigations", []),
        assessment=extracted.get("assessment", "Pending investigations"),
        treatmentPlan=extracted.get("treatmentPlan", "To be determined"),
        followUp=extracted.get("followUp", "As needed"),
        missingInformation=extracted.get("missingInformation", []),
        uncertainInformation=extracted.get("uncertainInformation", []),
        summaries=summaries
    )

    _CASESHEETS_DB.append(case_sheet)
    return case_sheet

@router.put("/{casesheet_id}", response_model=CaseSheet)
def update_case_sheet(casesheet_id: str, updated: CaseSheet):
    """Update an unapproved case sheet."""
    for i, s in enumerate(_CASESHEETS_DB):
        if s.id == casesheet_id:
            if s.isReadOnly:
                raise HTTPException(status_code=400, detail="Approved case sheets cannot be edited.")
            _CASESHEETS_DB[i] = updated
            return updated
    raise HTTPException(status_code=404, detail="Case sheet not found")

@router.post("/{casesheet_id}/approve", response_model=CaseSheet)
def approve_case_sheet(casesheet_id: str, approval: CaseSheetApproval):
    """Doctor sign-off and approval for clinical case sheet."""
    for i, s in enumerate(_CASESHEETS_DB):
        if s.id == casesheet_id:
            s.isApproved = True
            s.isReadOnly = True
            s.approvedBy = approval.approvedBy
            s.approvedAt = datetime.utcnow().isoformat() + "Z"
            _CASESHEETS_DB[i] = s
            return s
    raise HTTPException(status_code=404, detail="Case sheet not found")
