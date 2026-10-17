# MedTrust AI API (FastAPI + WebSocket signalling). Build context: ./backend
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PORT=8080 DATABASE_PATH=/data/medtrust.db WORKERS=1 \
    FORWARDED_ALLOW_IPS=*
WORKDIR /srv/backend
COPY requirements.txt requirements-scale.txt ./
RUN pip install --no-cache-dir -r requirements-scale.txt
COPY app/ ./app
RUN useradd --system --uid 10001 --home /srv medtrust && mkdir -p /data && chown medtrust /data
USER medtrust
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,os; urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/api/health', timeout=4)"
# FORWARDED_ALLOW_IPS=* is safe only because the container is reachable solely through nginx,
# which overwrites X-Forwarded-For with the real client address (see frontend/nginx.conf).
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers ${WORKERS} --proxy-headers --forwarded-allow-ips=\"${FORWARDED_ALLOW_IPS}\" --ws-max-size 65536 --no-server-header"]
