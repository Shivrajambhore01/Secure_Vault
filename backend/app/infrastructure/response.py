"""
Standard API Response Envelope — SecureVault Enterprise
Guarantees consistent JSON responses across all v1 endpoints.

Success format:
{
    "success": True,
    "data": { ... },
    "request_id": "req_...",
    "meta": { ... }  # optional
}

Error format:
{
    "success": False,
    "error": {
        "code": "ERROR_CODE",
        "message": "Human-readable message",
        "details": [ ... ]  # optional
    },
    "request_id": "req_..."
}
"""

from typing import Any, Dict, List, Optional
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from app.infrastructure.logging import get_request_id


class ErrorDetail(BaseModel):
    field: Optional[str] = None
    message: str


class ErrorPayload(BaseModel):
    code: str
    message: str
    details: Optional[List[Any]] = None


class APIResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[ErrorPayload] = None
    request_id: str
    meta: Optional[Dict[str, Any]] = None


def success_response(
    data: Any = None,
    meta: Optional[Dict[str, Any]] = None,
    status_code: int = 200,
    headers: Optional[Dict[str, str]] = None,
) -> JSONResponse:
    """Build a standard successful JSONResponse."""
    req_id = get_request_id()
    content = {
        "success": True,
        "data": data if data is not None else {},
        "request_id": req_id,
    }
    if meta is not None:
        content["meta"] = meta

    resp_headers = headers or {}
    resp_headers["X-Request-ID"] = req_id

    return JSONResponse(status_code=status_code, content=content, headers=resp_headers)


def error_response(
    code: str,
    message: str,
    status_code: int = 400,
    details: Optional[List[Any]] = None,
    headers: Optional[Dict[str, str]] = None,
) -> JSONResponse:
    """Build a standard error JSONResponse."""
    req_id = get_request_id()
    error_obj: Dict[str, Any] = {
        "code": code,
        "message": message,
    }
    if details:
        error_obj["details"] = details

    content = {
        "success": False,
        "error": error_obj,
        "request_id": req_id,
    }

    resp_headers = headers or {}
    resp_headers["X-Request-ID"] = req_id

    return JSONResponse(status_code=status_code, content=content, headers=resp_headers)
