"""
MedTrust AI - Vercel Serverless Entrypoint
This file re-exports the FastAPI app so Vercel's Python runtime can serve it.
Vercel looks for an `app` or `handler` export from api/index.py.
"""
# Ensure the parent directory (backend/) is on sys.path so `app.main` resolves.
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.main import app  # noqa: F401  – Vercel picks this up automatically
