import asyncio
import json
import uuid
from datetime import UTC, datetime

import aio_pika
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import BigInteger, Column, DateTime, MetaData, String, Table, create_engine
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import insert


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True, extra="ignore")

    postgres_dsn: str = "postgresql+psycopg://devobservatory:devobservatory@localhost:5432/devobservatory"
    rabbitmq_url: str = "amqp://devobservatory:devobservatory@localhost:5672/"


settings = Settings()


class IngestedEvent(BaseModel):
    project_id: uuid.UUID
    event_name: str = Field(min_length=1, max_length=200)
    user_id: str | None = Field(default=None, max_length=200)
    timestamp: datetime
    properties: dict = Field(default_factory=dict)


metadata = MetaData()
events_table = Table(
    "events",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    Column("project_id", UUID(as_uuid=True), nullable=False),
    Column("event_name", String(200), nullable=False),
    Column("user_id", String(200), nullable=True),
    Column("timestamp", DateTime(timezone=True), nullable=False),
    Column("properties", JSONB, nullable=False),
    Column("received_at", DateTime(timezone=True), nullable=False),
)


engine = create_engine(settings.postgres_dsn, pool_pre_ping=True)


async def handle_message(message: aio_pika.IncomingMessage) -> None:
    async with message.process(requeue=True):
        payload = json.loads(message.body.decode("utf-8"))
        event = IngestedEvent.model_validate(payload)
        with engine.begin() as conn:
            conn.execute(
                insert(events_table).values(
                    project_id=event.project_id,
                    event_name=event.event_name,
                    user_id=event.user_id,
                    timestamp=event.timestamp,
                    properties=event.properties,
                    received_at=datetime.now(UTC),
                )
            )


async def main() -> None:
    connection: aio_pika.RobustConnection | None = None
    for attempt in range(60):
        try:
            connection = await aio_pika.connect_robust(settings.rabbitmq_url)
            break
        except Exception:
            await asyncio.sleep(min(0.5 * (attempt + 1), 10.0))
    if not connection:
        raise RuntimeError("Failed to connect to RabbitMQ")
    async with connection:
        channel = await connection.channel()
        await channel.set_qos(prefetch_count=100)
        queue = await channel.declare_queue("events", durable=True)
        await queue.consume(handle_message)
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
