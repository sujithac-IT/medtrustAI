from fastapi import APIRouter, HTTPException
from typing import List
from datetime import datetime
from app.models.schemas import Consultation, TranscriptEntry

router = APIRouter(prefix="/consultations", tags=["Consultations"])

_CONSULTATIONS_DB: List[Consultation] = [
    Consultation(
        id="c1",
        patientId="p1",
        patientName="Arjun Krishnamurthy",
        doctorId="demo-doctor-001",
        doctorName="Dr. Rajesh Kumar",
        status="completed",
        startedAt="2024-09-20T10:00:00Z",
        endedAt="2024-09-20T10:35:00Z",
        duration=35,
        transcript=[],
        caseSheetId="cs1",
        createdAt="2024-09-20T10:00:00Z",
        reason="Chest pain evaluation",
    ),
    Consultation(
        id="c2",
        patientId="p2",
        patientName="Priya Sundaram",
        doctorId="demo-doctor-001",
        doctorName="Dr. Rajesh Kumar",
        status="completed",
        startedAt="2024-09-20T11:30:00Z",
        endedAt="2024-09-20T12:00:00Z",
        duration=30,
        transcript=[],
        caseSheetId="cs2",
        createdAt="2024-09-20T11:30:00Z",
        reason="Diabetes follow-up",
    ),
    Consultation(
        id="c3",
        patientId="p3",
        patientName="Ravi Shankar",
        doctorId="demo-doctor-001",
        doctorName="Dr. Rajesh Kumar",
        status="scheduled",
        transcript=[],
        createdAt="2024-09-21T09:00:00Z",
        reason="COPD management",
    ),
]

@router.get("", response_model=List[Consultation])
def get_consultations():
    """List all scheduled and completed consultations."""
    return _CONSULTATIONS_DB

@router.get("/{consultation_id}", response_model=Consultation)
def get_consultation(consultation_id: str):
    """Retrieve consultation by ID."""
    for c in _CONSULTATIONS_DB:
        if c.id == consultation_id:
            return c
    raise HTTPException(status_code=404, detail="Consultation not found")

@router.post("/{consultation_id}/transcript")
def append_transcript(consultation_id: str, entries: List[TranscriptEntry]):
    """Append live speech-to-text transcript chunks to an active consultation."""
    for c in _CONSULTATIONS_DB:
        if c.id == consultation_id:
            c.transcript.extend(entries)
            return {"status": "ok", "count": len(c.transcript)}
    raise HTTPException(status_code=404, detail="Consultation not found")
