# Build and run MedTrust AI Backend for Google Cloud Run
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY app/ ./app

# Expose port (Cloud Run sets PORT env var)
EXPOSE 8080

# Run FastAPI app with uvicorn
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
