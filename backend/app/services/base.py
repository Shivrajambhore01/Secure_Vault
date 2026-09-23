"""
Base Service — SecureVault Enterprise
All domain business services inherit from BaseService.
"""

from typing import Optional
from app.infrastructure.logging import get_logger


class BaseService:
    def __init__(self, service_name: Optional[str] = None):
        name = service_name or self.__class__.__name__
        self.logger = get_logger(f"securevault.service.{name}")
