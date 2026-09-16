"""
Domain & Application Exceptions — SecureVault Enterprise
Clean hierarchy of exceptions mapped to standard HTTP codes and error codes.
"""

from typing import Any, List, Optional


class AppException(Exception):
    """Base application exception."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_SERVER_ERROR",
        status_code: int = 500,
        details: Optional[List[Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or []


class NotFoundError(AppException):
    """Entity not found."""

    def __init__(self, resource: str, identifier: str = ""):
        msg = f"{resource} not found" + (f": {identifier}" if identifier else "")
        super().__init__(message=msg, code=f"{resource.upper()}_NOT_FOUND", status_code=404)


class UnauthorizedError(AppException):
    """Authentication required or invalid credentials."""

    def __init__(self, message: str = "Invalid or expired authentication credentials", code: str = "UNAUTHORIZED"):
        super().__init__(message=message, code=code, status_code=401)


class ForbiddenError(AppException):
    """Insufficient permissions or access denied."""

    def __init__(self, message: str = "Access denied for this resource", code: str = "FORBIDDEN"):
        super().__init__(message=message, code=code, status_code=403)


class ConflictError(AppException):
    """Resource already exists or state conflict."""

    def __init__(self, message: str, code: str = "CONFLICT"):
        super().__init__(message=message, code=code, status_code=409)


class ValidationError(AppException):
    """Input validation failure."""

    def __init__(self, message: str, details: Optional[List[Any]] = None, code: str = "VALIDATION_ERROR"):
        super().__init__(message=message, code=code, status_code=422, details=details)


class RateLimitError(AppException):
    """Too many requests."""

    def __init__(self, message: str = "Rate limit exceeded. Please slow down.", code: str = "RATE_LIMIT_EXCEEDED"):
        super().__init__(message=message, code=code, status_code=429)


class SecurityAlertError(AppException):
    """Critical security violation."""

    def __init__(self, message: str, code: str = "SECURITY_VIOLATION"):
        super().__init__(message=message, code=code, status_code=403)
