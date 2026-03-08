# Architecture

## Data Flow

1. Client sends an event to the backend ingestion endpoint using `X-API-Key`.
2. Backend validates the key and enqueues the event in RabbitMQ (`events` queue).
3. Worker consumes from RabbitMQ and persists events into Postgres.
4. Frontend reads events through authenticated backend endpoints (via Next.js BFF routes).

```mermaid
flowchart LR
  A[Client / SDK] -->|POST /api/events\nX-API-Key| B[Backend (FastAPI)]
  B -->|publish| Q[(RabbitMQ\nqueue: events)]
  Q -->|consume| W[Worker]
  W -->|insert| P[(Postgres)]
  F[Frontend (Next.js)] -->|/api/* (BFF)| B
  F -->|read| B
  B -->|query| P
```

## Components

- Backend: authentication, org/project management, API key validation, event ingestion, metrics endpoints.
- Worker: durable ingestion processing (queue → database).
- Frontend: UI + BFF routes that forward to backend and store auth tokens in httpOnly cookies.

## Services

- Postgres: primary database
- RabbitMQ: ingestion queue
- Redis: rate limiting / caching
- MinIO: S3-compatible object storage endpoint
