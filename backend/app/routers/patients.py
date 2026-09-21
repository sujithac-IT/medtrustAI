from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime
from app.models.schemas import Patient, PatientCreate

router = APIRouter(prefix="/patients", tags=["Patients"])

# In-memory store seeded with initial demo patients
_PATIENTS_DB: List[Patient] = [
    Patient(
        id="p1",
        name="Arjun Krishnamurthy",
        dob="1985-06-15",
        age=39,
        gender="male",
        phone="+91 98765 43210",
        bloodGroup="B+",
        allergies=["Penicillin"],
        conditions=["Hypertension"],
        createdAt="2024-01-10T10:00:00Z",
        updatedAt="2024-09-20T10:00:00Z",
    ),
    Patient(
        id="p2",
        name="Priya Sundaram",
        dob="1992-03-22",
        age=32,
        gender="female",
        phone="+91 87654 32109",
        bloodGroup="O+",
        allergies=[],
        conditions=["Type 2 Diabetes"],
        createdAt="2024-02-15T11:00:00Z",
        updatedAt="2024-09-18T12:00:00Z",
    ),
    Patient(
        id="p3",
        name="Ravi Shankar",
        dob="1970-11-08",
        age=54,
        gender="male",
        phone="+91 76543 21098",
        bloodGroup="A+",
        allergies=["Sulfa"],
        conditions=["COPD", "Hypertension"],
        createdAt="2024-03-01T09:00:00Z",
        updatedAt="2024-09-15T15:00:00Z",
    ),
    Patient(
        id="p4",
        name="Meena Devi",
        dob="1998-07-30",
        age=26,
        gender="female",
        phone="+91 65432 10987",
        bloodGroup="AB-",
        allergies=[],
        conditions=[],
        createdAt="2024-04-20T14:00:00Z",
        updatedAt="2024-09-10T16:00:00Z",
    ),
]

def calculate_age(dob: str) -> int:
    try:
        birth = datetime.strptime(dob, "%Y-%m-%d")
        today = datetime.utcnow()
        return today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
    except Exception:
        return 0

@router.get("", response_model=List[Patient])
def get_patients(search: Optional[str] = Query(None)):
    """List all patients with optional search query filtering by name, phone, or conditions."""
    if not search:
        return _PATIENTS_DB
    q = search.lower()
    return [
        p for p in _PATIENTS_DB
        if q in p.name.lower() or q in p.phone or any(q in c.lower() for c in p.conditions)
    ]

@router.get("/{patient_id}", response_model=Patient)
def get_patient(patient_id: str):
    """Get single patient details by ID."""
    for p in _PATIENTS_DB:
        if p.id == patient_id:
            return p
    raise HTTPException(status_code=404, detail="Patient not found")

@router.post("", response_model=Patient, status_code=201)
def create_patient(payload: PatientCreate):
    """Register a new patient into the hospital directory."""
    now = datetime.utcnow().isoformat() + "Z"
    new_id = f"p_{int(datetime.utcnow().timestamp())}"
    age = calculate_age(payload.dob)
    patient = Patient(
        id=new_id,
        name=payload.name,
        dob=payload.dob,
        age=age,
        gender=payload.gender,
        phone=payload.phone,
        email=payload.email,
        bloodGroup=payload.bloodGroup,
        address=payload.address,
        allergies=payload.allergies,
        conditions=payload.conditions,
        emergencyContact=payload.emergencyContact,
        createdAt=now,
        updatedAt=now,
    )
    _PATIENTS_DB.append(patient)
    return patient
