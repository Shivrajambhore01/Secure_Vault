"""
Audit & Observability Middleware — SecureVault Enterprise
Measures request latencies, logs HTTP interactions with Request ID, and records audit telemetry.
"""

import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.infrastructure.logging import get_logger

logger = get_logger("securevault.audit")


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        method = request.method

        response = await call_next(request)

        duration_ms = round((time.time() - start_time) * 1000, 2)
        status_code = response.status_code

        # Add execution time header
        response.headers["X-Response-Time"] = f"{duration_ms}ms"

        # Log request at appropriate level
        log_msg = f"{method} {path} - {status_code} ({duration_ms}ms) [IP: {client_ip}]"
        if status_code >= 500:
            logger.error(log_msg)
        elif status_code >= 400:
            logger.warning(log_msg)
        else:
            logger.info(log_msg)

        return response
