from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Literal
from datetime import datetime

UserRole = Literal["doctor", "patient"]

class User(BaseModel):
    uid: str
    email: str
    displayName: str
    role: UserRole
    photoURL: Optional[str] = None
    specialization: Optional[str] = None
    licenseNumber: Optional[str] = None
    department: Optional[str] = None

class Patient(BaseModel):
    id: str
    name: str
    dob: str
    age: int
    gender: Literal["male", "female", "other"]
    phone: str
    email: Optional[str] = None
    bloodGroup: Optional[str] = None
    address: Optional[str] = None
    allergies: List[str] = Field(default_factory=list)
    conditions: List[str] = Field(default_factory=list)
    emergencyContact: Optional[str] = None
    createdAt: str
    updatedAt: str

class PatientCreate(BaseModel):
    name: str
    dob: str
    gender: Literal["male", "female", "other"]
    phone: str
    email: Optional[str] = None
    bloodGroup: Optional[str] = None
    address: Optional[str] = None
    allergies: List[str] = Field(default_factory=list)
    conditions: List[str] = Field(default_factory=list)
    emergencyContact: Optional[str] = None

class TranscriptEntry(BaseModel):
    id: str
    speaker: Literal["doctor", "patient", "unknown"]
    text: str
    timestamp: float
    language: Optional[str] = "en-IN"

class MedicationRow(BaseModel):
    name: str
    dosage: str
    frequency: str
    duration: str

class PatientInfoSection(BaseModel):
    name: str
    age: str
    gender: str
    bloodGroup: str
    phone: str
    address: str

class CaseSheet(BaseModel):
    id: str
    consultationId: str
    patientId: str
    patientName: str
    doctorId: str
    doctorName: str
    generatedAt: str
    approvedAt: Optional[str] = None
    approvedBy: Optional[str] = None
    isApproved: bool = False
    isReadOnly: bool = False

    # 17 Clinical Sections
    patientInfo: PatientInfoSection
    chiefComplaint: str
    hpi: str
    symptoms: List[str] = Field(default_factory=list)
    duration: str
    pastMedicalHistory: str
    medications: List[MedicationRow] = Field(default_factory=list)
    allergies: List[str] = Field(default_factory=list)
    familyHistory: str
    socialHistory: str
    doctorObservations: str
    investigations: List[str] = Field(default_factory=list)
    assessment: str
    treatmentPlan: str
    followUp: str
    missingInformation: List[str] = Field(default_factory=list)
    uncertainInformation: List[str] = Field(default_factory=list)

    # Multilingual summaries (en, ta, hi, te, ml, kn)
    summaries: Optional[Dict[str, str]] = None

class GenerateCaseSheetRequest(BaseModel):
    transcript: List[TranscriptEntry]
    patientName: str
    doctorName: str
    consultationId: str
    patientId: str
    doctorId: str
    generateTranslations: bool = False

class Consultation(BaseModel):
    id: str
    patientId: str
    patientName: str
    doctorId: str
    doctorName: str
    meetLink: Optional[str] = None
    status: Literal["scheduled", "active", "completed", "cancelled"]
    startedAt: Optional[str] = None
    endedAt: Optional[str] = None
    duration: Optional[int] = None
    transcript: List[TranscriptEntry] = Field(default_factory=list)
    caseSheetId: Optional[str] = None
    createdAt: str
    specialty: Optional[str] = None
    reason: Optional[str] = None

class CaseSheetApproval(BaseModel):
    approvedBy: str
    reviewedAllSections: bool = True
    accurateAndComplete: bool = True
    treatmentPlanConfirmed: bool = True
