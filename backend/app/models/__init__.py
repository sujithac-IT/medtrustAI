"""
app.models package
Aggregates all Pydantic schemas.
- app.models.schemas  →  core CaseSheet / Consultation / Patient schemas (used by app/routers/)
- app.models.*        →  extended 17-section models (used by app/api/ + app/services/)
"""
# Re-export everything from schemas.py so `from app.models.schemas import X` works
from .schemas import (  # noqa: F401
    User,
    Patient,
    PatientCreate,
    TranscriptEntry,
    MedicationRow,
    PatientInfoSection,
    CaseSheet,
    GenerateCaseSheetRequest,
    Consultation,
    CaseSheetApproval,
)

# Re-export legacy extended models so `from app.models import X` (used by app/api/*.py) also works
from ..models_legacy import (  # noqa: F401
    UserRole,
    UserProfile,
    PatientBase,
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
