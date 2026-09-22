"""
app.models package
Aggregates all Pydantic schemas.
- app.models.schemas  →  core CaseSheet / Consultation / Patient schemas (used by app/routers/)
- app.models.*        →  extended 17-section models (used by app/api/ + app/services/)
"""
# Re-export legacy extended models so `from app.models import X` (used by app/api/*.py) works
from ..models_legacy import (  # noqa: F401
    UserRole,
    UserProfile,
    PatientBase,
    PatientCreate,
    TranscriptTurn,
    TranscriptSession,
    MedicationItem,
    SymptomItem,
    Vitals,
    CaseSheet17Sections,
    MultilingualSummary,
    DoctorApproval,
    CaseSheetRecord,
    GoogleMeetData,
    ConsultationCreate,
    Consultation as ConsultationLegacy,
)

# Re-export from schemas.py
from .schemas import (  # noqa: F401
    User,
    Patient,
    TranscriptEntry,
    MedicationRow,
    PatientInfoSection,
    CaseSheet,
    GenerateCaseSheetRequest,
    Consultation,
    CaseSheetApproval,
)
