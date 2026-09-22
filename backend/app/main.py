import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

# Initialize DB on startup
from app.database import init_db
init_db()

# Import API routes
from app.api import auth, casesheets, consultations, patients
from app.routers import casesheet as legacy_casesheet

app = FastAPI(
    title="MedTrust AI Clinical Intelligence API",
    description="Backend service for MedTrust AI Teleconsultation & Clinical Case Sheet Generation",
    version="2.0.0",
)

# CORS configuration allowing local dev and Cloud Run origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Database-backed API routers
app.include_router(auth.router)
app.include_router(casesheets.router)
app.include_router(consultations.router)
app.include_router(patients.router)

# Mount legacy/fast routers
app.include_router(legacy_casesheet.router, prefix="/api")

# Google Meet Spaces API v2 compatibility endpoint
@app.get("/spaces/{space_id:path}/transcripts")
def get_space_transcripts(space_id: str):
    return consultations.get_google_meet_transcripts_endpoint(space_id)

@app.get("/")
def root():
    return {
        "service": "MedTrust AI Backend",
        "version": "2.0.0",
        "status": "online",
        "docs": "/docs",
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": os.getenv("PORT", "8000")}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
