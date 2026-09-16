"""
Structured Logging & Request ID Context Management — SecureVault Enterprise
Uses Python contextvars to track request IDs across async operations and threads.
"""

import contextvars
import logging
import sys
import uuid
from typing import Optional

# Context variable to hold the request ID per async task
_request_id_ctx_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default="req_system"
)


def get_request_id() -> str:
    """Retrieve the current request ID from context."""
    return _request_id_ctx_var.get()


def set_request_id(request_id: Optional[str] = None) -> str:
    """Generate or set the request ID for the current context."""
    val = request_id or f"req_{uuid.uuid4().hex[:12]}"
    _request_id_ctx_var.set(val)
    return val


class RequestIdFilter(logging.Filter):
    """Logging filter that injects request_id into every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()
        return True


def setup_structured_logging(level: int = logging.INFO):
    """Configures structured console logging with timestamps and request IDs."""
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Avoid duplicate handlers
    if not any(isinstance(h, logging.StreamHandler) for h in root_logger.handlers):
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] [%(name)s] [%(request_id)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        handler.addFilter(RequestIdFilter())
        root_logger.addHandler(handler)
    else:
        for handler in root_logger.handlers:
            handler.addFilter(RequestIdFilter())


def get_logger(name: str) -> logging.Logger:
    """Factory to get named logger with Request ID injection."""
    logger = logging.getLogger(name)
    if not any(isinstance(f, RequestIdFilter) for f in logger.filters):
        logger.addFilter(RequestIdFilter())
    return logger
