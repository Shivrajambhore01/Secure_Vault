"""
Pagination, Filtering & Sorting Utilities — SecureVault Enterprise
Provides standard query parameter parsing and paginated response models.
"""

from typing import Any, Dict, Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field
from fastapi import Query

T = TypeVar("T")


class PaginationParams:
    """FastAPI dependency for extracting standard pagination, sorting and search queries."""

    def __init__(
        self,
        page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
        page_size: int = Query(default=20, ge=1, le=100, description="Items per page (max 100)"),
        sort_by: Optional[str] = Query(default=None, description="Field to sort by"),
        sort_order: str = Query(default="desc", pattern="^(asc|desc)$", description="Sort order: asc or desc"),
        search: Optional[str] = Query(default=None, description="Search term for text search"),
    ):
        self.page = int(page.default if hasattr(page, "default") else page)
        self.page_size = int(page_size.default if hasattr(page_size, "default") else page_size)
        self.sort_by = sort_by.default if hasattr(sort_by, "default") else sort_by
        self.sort_order = str(sort_order.default if hasattr(sort_order, "default") else sort_order)
        self.search = search.default if hasattr(search, "default") else search

    @property
    def skip(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size

    def to_mongo_sort(self, default_field: str = "createdAt") -> List[tuple]:
        field = self.sort_by or default_field
        direction = 1 if self.sort_order == "asc" else -1
        return [(field, direction)]


class PageMeta(BaseModel):
    page: int
    page_size: int
    total_items: int
    total_pages: int
    has_next: bool
    has_prev: bool


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    meta: PageMeta

    @classmethod
    def create(cls, items: List[T], total_items: int, params: PaginationParams):
        total_pages = max(1, (total_items + params.page_size - 1) // params.page_size) if total_items > 0 else 1
        meta = PageMeta(
            page=params.page,
            page_size=params.page_size,
            total_items=total_items,
            total_pages=total_pages,
            has_next=params.page < total_pages,
            has_prev=params.page > 1,
        )
        return cls(items=items, meta=meta)
