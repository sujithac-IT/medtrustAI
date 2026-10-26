"""MedTrust AI - FastAPI application entrypoint (API + realtime + built SPA)."""
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .db import init_db
from .realtime import hub
from .routers import auth, casesheets, consultations, meta, patients

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
# httpx logs full request URLs at INFO; keep third-party request logs out of the application log.
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("medtrust")
settings = get_settings()

CSP = ("default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; "
       "img-src 'self' data: blob:; media-src 'self' blob: mediastream:; "
       "script-src 'self' https://www.gstatic.com https://apis.google.com; "
       "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; "
       "connect-src 'self' ws: wss: https://*.googleapis.com https://www.gstatic.com; "
       "frame-src https://*.firebaseapp.com https://accounts.google.com")
SECURITY_HEADERS = [
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"referrer-policy", b"no-referrer"),
    (b"cross-origin-opener-policy", b"same-origin-allow-popups"),
    (b"permissions-policy", b"camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=()"),
]


class SecurityLayer:
    """Pure ASGI middleware (no buffering, WebSockets pass through untouched).

    - adds hardening headers and a CSP to every HTTP response; HSTS when served over HTTPS
    - marks API responses `no-store` (they carry patient data)
    - rejects request bodies above MAX_BODY_BYTES, by header and while streaming
    - tags each request with an id for log correlation
    """

    def __init__(self, app, max_body: int) -> None:
        self.app, self.max_body = app, max_body

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path: str = scope["path"]
        headers = dict(scope["headers"])
        length = headers.get(b"content-length")
        if length and length.isdigit() and int(length) > self.max_body:
            return await JSONResponse(status_code=413, content={"detail": "Request body too large"})(scope, receive, send)
        https = scope.get("scheme") == "https" or headers.get(b"x-forwarded-proto") == b"https"
        rid = uuid.uuid4().hex[:12].encode()
        seen = 0

        async def limited_receive():
            nonlocal seen
            msg = await receive()
            if msg["type"] == "http.request":
                seen += len(msg.get("body", b""))
                if seen > self.max_body:
                    raise ValueError("Request body too large")
            return msg

        async def send_with_headers(msg):
            if msg["type"] == "http.response.start":
                h = list(msg.get("headers", []))
                h += SECURITY_HEADERS + [(b"x-request-id", rid)]
                if not path.startswith(("/docs", "/redoc", "/openapi.json")):
                    h.append((b"content-security-policy", CSP.encode()))
                if path.startswith("/api/"):
                    h.append((b"cache-control", b"no-store"))
                elif path.startswith("/assets/"):
                    h.append((b"cache-control", b"public, max-age=31536000, immutable"))
                if https:
                    h.append((b"strict-transport-security", b"max-age=31536000; includeSubDomains"))
                msg = {**msg, "headers": h}
            await send(msg)

        try:
            await self.app(scope, limited_receive, send_with_headers)
        except ValueError as e:
            if str(e) != "Request body too large":
                raise
            await JSONResponse(status_code=413, content={"detail": "Request body too large"})(scope, receive, send)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    await hub.start()
    if settings.demo_mode:
        log.warning("DEMO_MODE is on: one-click demo accounts are enabled. Set DEMO_MODE=false in production.")
    log.info("MedTrust AI ready (realtime=%s)", type(hub).__name__)
    yield
    await hub.stop()


app = FastAPI(title="MedTrust AI API", version="4.0.0", lifespan=lifespan,
              description="Teleconsultation, live transcription and AI case sheets. See docs/API_CONTRACT.md",
              docs_url="/docs" if settings.expose_docs else None, redoc_url=None,
              openapi_url="/openapi.json" if settings.expose_docs else None)
app.add_middleware(GZipMiddleware, minimum_size=1024)
_cors_origins = ["*"] if "*" in settings.cors_origins else settings.cors_origins
app.add_middleware(CORSMiddleware, allow_origins=_cors_origins, allow_credentials=False,
                   allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type"])
app.add_middleware(SecurityLayer, max_body=settings.max_body_bytes)

for r in (meta.router, auth.router, patients.router, consultations.router, casesheets.router):
    app.include_router(r)


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


dist = settings.frontend_dist
if (dist / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        f = (dist / path).resolve()
        if path and f.is_file() and dist.resolve() in f.parents:
            return FileResponse(f)
        return FileResponse(dist / "index.html", headers={"cache-control": "no-cache"})
