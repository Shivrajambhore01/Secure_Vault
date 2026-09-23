"""
Asynchronous Event Bus — SecureVault Enterprise
Pub/Sub event dispatcher for decoupling synchronous HTTP routes from background processing.
"""

import asyncio
from typing import Callable, Coroutine, Dict, List
from app.events.domain_events import DomainEvent
from app.infrastructure.logging import get_logger

logger = get_logger("securevault.events")

EventHandler = Callable[[DomainEvent], Coroutine[Any, Any, None]]


class EventBus:
    def __init__(self):
        self._subscribers: Dict[str, List[EventHandler]] = {}

    def subscribe(self, event_name: str, handler: EventHandler) -> None:
        if event_name not in self._subscribers:
            self._subscribers[event_name] = []
        self._subscribers[event_name].append(handler)
        logger.info("Subscribed handler '%s' to event '%s'", handler.__name__, event_name)

    async def publish(self, event: DomainEvent) -> None:
        logger.info("Publishing event: %s", event.event_name)
        handlers = self._subscribers.get(event.event_name, [])
        if not handlers:
            return

        # Fire handlers concurrently in background without blocking caller
        for handler in handlers:
            asyncio.create_task(self._safe_execute(handler, event))

    async def _safe_execute(self, handler: EventHandler, event: DomainEvent) -> None:
        try:
            await handler(event)
        except Exception as e:
            logger.error("Error in event handler %s for %s: %s", handler.__name__, event.event_name, e)


# Global singleton event bus
event_bus = EventBus()
