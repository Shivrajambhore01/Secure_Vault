"""
Centralized Global Exception Handler — SecureVault Enterprise
Catches all domain, HTTP, validation, and system exceptions and formats them
into the unified API error envelope.
"""

import traceback
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.domain.exceptions import AppException
from app.infrastructure.logging import get_logger
from app.infrastructure.response import error_response

logger = get_logger("securevault.exceptions")


def register_exception_handlers(app: FastAPI):
    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        logger.warning(
            "AppException [%s]: %s (status=%d, path=%s)",
            exc.code,
            exc.message,
            exc.status_code,
            request.url.path,
        )
        return error_response(
            code=exc.code,
            message=exc.message,
            status_code=exc.status_code,
            details=exc.details,
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        # Translate FastAPI/Starlette HTTPException
        code_map = {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            405: "METHOD_NOT_ALLOWED",
            409: "CONFLICT",
            422: "UNPROCESSABLE_ENTITY",
            429: "TOO_MANY_REQUESTS",
            500: "INTERNAL_SERVER_ERROR",
        }
        code = code_map.get(exc.status_code, "HTTP_ERROR")
        detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        return error_response(code=code, message=detail, status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        errors = []
        for err in exc.errors():
            loc = " -> ".join(str(l) for l in err.get("loc", []))
            errors.append({"field": loc, "message": err.get("msg", "Invalid value")})
        logger.info("Validation failure on %s: %s", request.url.path, errors)
        return error_response(
            code="VALIDATION_ERROR",
            message="Request input validation failed",
            status_code=422,
            details=errors,
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        err_trace = traceback.format_exc()
        logger.error("Unhandled exception on %s: %s\n%s", request.url.path, exc, err_trace)
        return error_response(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected server error occurred. Please contact support.",
            status_code=500,
        )
