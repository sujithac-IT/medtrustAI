web: cd backend && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1 --proxy-headers --forwarded-allow-ips="*" --ws-max-size 65536 --no-server-header
