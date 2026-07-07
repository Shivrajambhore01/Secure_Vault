"""FastAPI entry point — port of backend/server.ts."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.database import verify_connection
from app.api.auth import router as auth_router
from app.api.assets import router as assets_router
from app.api.nominees import router as nominees_router
from app.lib.scheduler import start_inactivity_scheduler

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    # Startup
    await verify_connection()
    scheduler = start_inactivity_scheduler()
    yield
    # Shutdown
    scheduler.shutdown(wait=False)


app = FastAPI(
    title="SecureVault Backend API",
    version="2.0.0",
    lifespan=lifespan,
)

# ------------------------------------------------------------------
# CORS (matches Express config)
# ------------------------------------------------------------------
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://10.27.46.5:3000",   # Current network IP (from dev server)
    "http://172.27.90.5:3000",  # Previous network IP (fallback)
]
frontend_url_clean = settings.FRONTEND_URL.strip("\"'").rstrip('/')
if frontend_url_clean not in allowed_origins:
    allowed_origins.append(frontend_url_clean)
if settings.FRONTEND_URL not in allowed_origins:
    allowed_origins.append(settings.FRONTEND_URL)
print("ALLOWED CORS ORIGINS:", allowed_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# ------------------------------------------------------------------
# Static files (uploads)
# ------------------------------------------------------------------
uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# ------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(assets_router, prefix="/api/assets", tags=["Assets"])
app.include_router(nominees_router, prefix="/api/nominees", tags=["Nominees"])


@app.get("/")
async def root():
    return {"message": "SecureVault Backend API is running..."}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
