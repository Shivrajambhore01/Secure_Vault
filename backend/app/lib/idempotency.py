"""
Idempotency Middleware — SecureVault Enterprise

Prevents duplicate state transitions caused by:
  - Network retries
  - Double-click form submissions
  - Mobile app reconnection replays

Usage:
  Client sends header: Idempotency-Key: <uuid4>
  
  First request:  processes normally, caches response for 24h
  Duplicate request (same key): returns cached response immediately (no re-processing)

Storage: MongoDB `idempotency_keys` collection (TTL-indexed on expiresAt)

Applies only to POST/PUT/DELETE requests.
GET requests are inherently idempotent and not tracked.
"""

import json
import hashlib
import logging
from datetime import datetime, timedelta, timezone

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.core.database import db

logger = logging.getLogger("securevault.idempotency")
idempotency_col = db["idempotency_keys"]

# Routes where idempotency is enforced
IDEMPOTENCY_PATHS = [
    "/api/verification/claim",
    "/api/verification/email/verify",
    "/api/verification/mobile/verify",
    "/api/verification/complete",
    "/api/admin/verification/requests",
]

TTL_HOURS = 24


class IdempotencyMiddleware(BaseHTTPMiddleware):
    """
    Intercepts POST/PUT/DELETE requests with an Idempotency-Key header.
    Returns cached response if the same key was processed before.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method not in ("POST", "PUT", "DELETE", "PATCH"):
            return await call_next(request)

        idempotency_key = request.headers.get("Idempotency-Key")
        if not idempotency_key:
            return await call_next(request)

        path = request.url.path
        # Only enforce on specific paths
        if not any(path.startswith(p) for p in IDEMPOTENCY_PATHS):
            return await call_next(request)

        # Create a composite key using Idempotency-Key + path (to prevent key reuse across endpoints)
        cache_key = hashlib.sha256(f"{idempotency_key}:{path}".encode()).hexdigest()

        # Check for existing cached response
        existing = await idempotency_col.find_one({"cacheKey": cache_key})
        if existing:
            logger.info(
                "Idempotent replay: key=%s path=%s status=%d",
                idempotency_key, path, existing["statusCode"],
            )
            return JSONResponse(
                status_code=existing["statusCode"],
                content=existing["body"],
                headers={"X-Idempotent-Replayed": "true"},
            )

        # Process the original request
        response = await call_next(request)

        # Cache the response (only for 2xx and 4xx responses — not 5xx)
        if response.status_code < 500:
            try:
                # Read the response body bytes
                body_bytes = b""
                async for chunk in response.body_iterator:
                    body_bytes += chunk

                body_text = body_bytes.decode("utf-8", errors="ignore")
                try:
                    body_json = json.loads(body_text)
                except Exception:
                    body_json = {"raw": body_text}

                expiry = datetime.now(timezone.utc) + timedelta(hours=TTL_HOURS)
                await idempotency_col.insert_one({
                    "cacheKey": cache_key,
                    "idempotencyKey": idempotency_key,
                    "path": path,
                    "statusCode": response.status_code,
                    "body": body_json,
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "expiresAt": expiry,  # MongoDB TTL index on this field
                })

                return JSONResponse(
                    status_code=response.status_code,
                    content=body_json,
                    headers=dict(response.headers),
                )
            except Exception as exc:
                logger.error("Idempotency cache write failed: %s", exc)

        return response
