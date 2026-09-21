import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.routers import patients, consultations, casesheet

app = FastAPI(
    title="MedTrust AI Clinical Intelligence API",
    description="Backend service for MedTrust AI Teleconsultation & Clinical Case Sheet Generation",
    version="1.0.0",
)

# CORS configuration allowing local dev and Cloud Run origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(patients.router, prefix="/api")
app.include_router(consultations.router, prefix="/api")
app.include_router(casesheet.router, prefix="/api")

@app.get("/")
def root():
    return {
        "service": "MedTrust AI Backend",
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs",
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": os.getenv("PORT", "8000")}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
