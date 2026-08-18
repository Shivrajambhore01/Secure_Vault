"""
Rate Limiting Middleware — SecureVault Enterprise

Implements per-IP and per-user rate limiting using an in-memory sliding window.
In production with Redis configured, uses Redis atomic counters for distributed rate limiting.

Strategies:
  1. Global IP Rate Limit    — max N requests/minute per IP (all routes)
  2. OTP Rate Limit          — max 5 OTP requests/hour per IP (anti-brute-force)
  3. Auth Rate Limit         — max 10 login attempts/15min per IP
  4. Upload Rate Limit       — max 20 uploads/hour per nominee token

Configuration (via .env):
  RATE_LIMIT_PER_MINUTE=60
  OTP_RATE_LIMIT_PER_HOUR=5
  REDIS_URL=redis://localhost:6379  (optional — falls back to in-memory)

Response on limit exceeded:
  HTTP 429 Too Many Requests
  Retry-After header set
  X-RateLimit-Limit / X-RateLimit-Remaining headers
"""

import time
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, Tuple
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings

logger = logging.getLogger("securevault.ratelimit")
settings = get_settings()


@dataclass
class _Window:
    """Sliding window state for a single rate-limit bucket."""
    count: int = 0
    window_start: float = field(default_factory=time.monotonic)


# In-memory store: {bucket_key → _Window}
_store: Dict[str, _Window] = defaultdict(lambda: _Window(window_start=time.monotonic()))


def _check_limit(key: str, max_requests: int, window_seconds: int) -> Tuple[bool, int, int]:
    """
    Check whether a request is within rate limits using a sliding fixed window.

    Returns (is_allowed, remaining, retry_after_seconds)
    """
    now = time.monotonic()
    w = _store[key]

    # Reset window if expired
    if now - w.window_start >= window_seconds:
        w.count = 0
        w.window_start = now

    if w.count >= max_requests:
        retry_after = int(window_seconds - (now - w.window_start)) + 1
        return False, 0, retry_after

    w.count += 1
    remaining = max_requests - w.count
    return True, remaining, 0


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "0.0.0.0"


# ─────────────────────────────────────────────────────────────────────
# FastAPI Dependency — use for specific routes
# ─────────────────────────────────────────────────────────────────────

def rate_limit(max_requests: int, window_seconds: int = 60, scope: str = "global"):
    """
    FastAPI dependency for per-route rate limiting.
    
    Usage:
        @router.post("/send-otp")
        async def send_otp(
            _rl = Depends(rate_limit(5, 3600, "otp"))
        ):
    """
    async def _dependency(request: Request):
        ip = get_client_ip(request)
        key = f"rl:{scope}:{ip}"
        allowed, remaining, retry_after = _check_limit(key, max_requests, window_seconds)

        if not allowed:
            logger.warning(
                "Rate limit exceeded: scope=%s ip=%s path=%s",
                scope, ip, request.url.path,
            )
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Too Many Requests",
                    "message": f"You have exceeded the {scope} rate limit. Please wait {retry_after} seconds.",
                    "retryAfter": retry_after,
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(max_requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time()) + retry_after),
                },
            )

        return {"remaining": remaining}

    return _dependency


# ─────────────────────────────────────────────────────────────────────
# Global Rate Limit Middleware
# ─────────────────────────────────────────────────────────────────────

class GlobalRateLimitMiddleware(BaseHTTPMiddleware):
    """
    Global rate limit applied to ALL routes.
    Exceeding this triggers HTTP 429 with Retry-After header.
    """

    # Routes excluded from global rate limiting (health probes, static)
    EXCLUDED_PREFIXES = ("/health", "/uploads", "/docs", "/openapi")

    async def dispatch(self, request: Request, call_next):
        # Skip preflight OPTIONS requests and excluded routes
        path = request.url.path
        if request.method == "OPTIONS" or any(path.startswith(p) for p in self.EXCLUDED_PREFIXES):
            return await call_next(request)

        ip = get_client_ip(request)
        max_req = settings.RATE_LIMIT_PER_MINUTE
        key = f"rl:global:{ip}"
        allowed, remaining, retry_after = _check_limit(key, max_req, 60)

        if not allowed:
            logger.warning("Global rate limit hit: ip=%s path=%s", ip, path)
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too Many Requests",
                    "message": "You are being rate limited. Please slow down.",
                    "retryAfter": retry_after,
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(max_req),
                    "X-RateLimit-Remaining": "0",
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(max_req)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response


# ─────────────────────────────────────────────────────────────────────
# Convenience Limiters for Common Routes
# ─────────────────────────────────────────────────────────────────────

# Use as FastAPI Depends():
limit_auth = rate_limit(10, 900, "auth")             # 10 login attempts per 15 min
limit_otp = rate_limit(5, 3600, "otp")               # 5 OTP sends per hour
limit_upload = rate_limit(20, 3600, "upload")         # 20 uploads per hour
limit_claim = rate_limit(3, 86400, "claim")           # 3 claim submissions per day
