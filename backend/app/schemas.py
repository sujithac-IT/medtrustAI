"""Pydantic request models (responses are plain dicts documented in docs/API_CONTRACT.md)."""
import re
from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

PHONE_RE = re.compile(r"^\+?[0-9][0-9 \-]{7,16}$")
Role = Literal["doctor", "student", "patient"]


class LoginIn(BaseModel):
    email: str
    password: str


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=2, max_length=120)
    role: Role = "patient"
    invite_code: str | None = None
    registration_number: str | None = None
    specialization: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    phone: str | None = None


class FirebaseIn(BaseModel):
    id_token: str
    role: Role = "patient"


class DemoLoginIn(BaseModel):
    role: Role


class PatientIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    date_of_birth: date
    gender: Literal["Male", "Female", "Other"]
    phone: str
    email: EmailStr | None = None
    blood_group: Literal["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"] | None = None
    address: str | None = Field(default=None, max_length=300)
    emergency_contact_name: str | None = Field(default=None, max_length=120)
    emergency_contact_phone: str | None = None
    allergies: list[str] = Field(default_factory=list, max_length=50)
    conditions: list[str] = Field(default_factory=list, max_length=50)

    @field_validator("date_of_birth")
    @classmethod
    def dob_valid(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("Date of birth cannot be in the future")
        if v.year < 1900:
            raise ValueError("Date of birth is not plausible")
        return v

    @field_validator("phone", "emergency_contact_phone")
    @classmethod
    def phone_valid(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        if not PHONE_RE.match(v.strip()):
            raise ValueError("Phone must be 8-17 digits, optionally starting with +")
        return v.strip()

    @field_validator("allergies", "conditions")
    @classmethod
    def clean_tags(cls, v: list[str]) -> list[str]:
        out: list[str] = []
        for t in v:
            t = t.strip()
            if t and t.lower() not in {x.lower() for x in out}:
                out.append(t[:100])
        return out


class PatientPatch(BaseModel):
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    blood_group: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    allergies: list[str] | None = None
    conditions: list[str] | None = None


class ConsultationIn(BaseModel):
    patient_id: str
    doctor_id: str | None = None
    student_id: str | None = None
    reason: str | None = Field(default=None, max_length=300)
    scheduled_at: str | None = None
    create_google_meet: bool = True


class ConsultationPatch(BaseModel):
    scheduled_at: str | None = None
    reason: str | None = Field(default=None, max_length=300)
    student_id: str | None = None
    doctor_id: str | None = None
    status: Literal["scheduled", "cancelled"] | None = None
    cancel_reason: str | None = Field(default=None, max_length=300)


class TranscriptIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    client_id: str | None = None
    language: str = "en-IN"
    speaker_role: Role | None = None
    offset_ms: int | None = None


class DemoTranscriptIn(BaseModel):
    scenario: str = "cardiology"
    replace: bool = False


class SegmentPatch(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=4000)
    speaker_role: Role | None = None


class ProfilePatch(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = None
    specialization: str | None = Field(default=None, max_length=120)
    designation: str | None = Field(default=None, max_length=120)

    @field_validator("phone")
    @classmethod
    def phone_ok(cls, v: str | None) -> str | None:
        if v and not PHONE_RE.match(v.strip()):
            raise ValueError("Phone must be 8-17 digits, optionally starting with +")
        return v.strip() if v else v


class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class StaffIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=120)
    role: Literal["doctor", "student"]
    password: str = Field(min_length=8, max_length=128)
    registration_number: str | None = Field(default=None, max_length=40)
    specialization: str | None = Field(default=None, max_length=120)
    designation: str | None = Field(default=None, max_length=120)


class StaffPatch(BaseModel):
    disabled: bool | None = None
    designation: str | None = Field(default=None, max_length=120)
    specialization: str | None = Field(default=None, max_length=120)


class CaseSheetPatch(BaseModel):
    version: int
    sections: dict[str, Any]


class ApproveIn(BaseModel):
    version: int
    confirm_reviewed: bool

    @field_validator("confirm_reviewed")
    @classmethod
    def must_confirm(cls, v: bool) -> bool:
        if not v:
            raise ValueError("You must confirm that you reviewed the case sheet")
        return v
