"""
Base Worker — SecureVault Enterprise
Abstract class for background processors, queue consumers, and cron workers.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict
from app.infrastructure.logging import get_logger


class BaseWorker(ABC):
    def __init__(self, name: str):
        self.name = name
        self.logger = get_logger(f"securevault.worker.{name}")

    @abstractmethod
    async def process_job(self, payload: Dict[str, Any]) -> Any:
        """Execute the job payload."""
        pass
