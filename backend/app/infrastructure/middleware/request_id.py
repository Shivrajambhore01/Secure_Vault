"""
Request ID Middleware — SecureVault Enterprise
Extracts or creates X-Request-ID and injects it into contextvars and response headers.
"""

import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.infrastructure.logging import set_request_id


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        incoming_req_id = request.headers.get("X-Request-ID")
        req_id = incoming_req_id if incoming_req_id else f"req_{uuid.uuid4().hex[:12]}"
        set_request_id(req_id)

        # Store in request state for downstream handlers
        request.state.request_id = req_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = req_id
        return response
