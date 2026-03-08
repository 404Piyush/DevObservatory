import json
from datetime import datetime
from typing import Any

import aio_pika

from app.core.config import settings


def _json_default(obj: Any) -> Any:
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Unsupported type: {type(obj)}")


class RabbitPublisher:
    def __init__(self) -> None:
        self._connection: aio_pika.RobustConnection | None = None
        self._channel: aio_pika.RobustChannel | None = None

    async def connect(self) -> None:
        try:
            self._connection = await aio_pika.connect_robust(settings.rabbitmq_url)
            self._channel = await self._connection.channel(publisher_confirms=False)
            await self._channel.declare_queue("events", durable=True)
        except Exception:
            self._connection = None
            self._channel = None

    async def close(self) -> None:
        if self._connection:
            await self._connection.close()

    def ready(self) -> bool:
        return self._channel is not None

    async def publish_event(self, payload: dict[str, Any]) -> None:
        if not self._channel:
            raise RuntimeError("RabbitMQ channel not initialized")
        message = aio_pika.Message(
            body=json.dumps(payload, default=_json_default).encode("utf-8"),
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        )
        await self._channel.default_exchange.publish(message, routing_key="events")
