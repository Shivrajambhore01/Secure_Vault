"""
Multi-Tenancy Context & Data Partitioning Engine — Phase 18.
Provides thread-safe, async-safe tenant isolation using ContextVars,
header extraction, and repository query filter injection.
"""

from contextvars import ContextVar
from contextlib import contextmanager
from typing import Optional, Dict, Any
from fastapi import Request

# Asynchronous request-scoped context variable for current tenant ID
_current_tenant_id: ContextVar[Optional[str]] = ContextVar("current_tenant_id", default=None)


def get_current_tenant_id() -> Optional[str]:
    """Retrieve the tenant ID associated with the current async task context."""
    return _current_tenant_id.get()


def set_current_tenant_id(tenant_id: Optional[str]) -> None:
    """Set the tenant ID for the current async task context."""
    _current_tenant_id.set(tenant_id)


@contextmanager
def tenant_scope(tenant_id: Optional[str]):
    """
    Context manager allowing temporary switching or setting of tenant context.
    Automatically resets back to previous tenant upon exiting.
    """
    token = _current_tenant_id.set(tenant_id)
    try:
        yield tenant_id
    finally:
        _current_tenant_id.reset(token)


def extract_tenant_from_request(request: Request) -> Optional[str]:
    """
    Extract tenant ID from request headers or auth state, and populate context.
    Priority:
    1. 'X-Tenant-ID' HTTP header.
    2. 'tenant_id' in request.state (from verified JWT token).
    """
    tenant_id = request.headers.get("X-Tenant-ID")
    if not tenant_id and hasattr(request.state, "tenant_id"):
        tenant_id = getattr(request.state, "tenant_id", None)

    if tenant_id:
        set_current_tenant_id(tenant_id)
        
    return tenant_id


def build_tenant_filter(query: Optional[Dict[str, Any]] = None, tenant_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Injects tenant isolation constraints into MongoDB queries.
    If tenant_id is provided or active in context, enforces query scoping.
    """
    active_tenant = tenant_id if tenant_id is not None else get_current_tenant_id()
    filter_dict = dict(query) if query else {}
    
    if active_tenant and active_tenant != "global":
        filter_dict["tenant_id"] = active_tenant
        
    return filter_dict
