# Architecture

## Data Flow

1. Client sends an event to the backend ingestion endpoint using `X-API-Key`.
2. Backend validates the key and enqueues the event in RabbitMQ (`events` queue).
3. Worker consumes from RabbitMQ and persists events into Postgres.
4. After persisting, the worker evaluates active outbound webhooks for the
   project, signs the payload with HMAC-SHA256 using each webhook's per-row
   secret, and POSTs asynchronously. URLs are validated for http(s) scheme
   and rejected if they resolve to a private/loopback/link-local IP
   (SSRF guard).
5. Frontend reads events through authenticated backend endpoints (via Next.js BFF routes).

```mermaid
flowchart LR
  A[Client / SDK] -->|POST /api/events\nX-API-Key| B[Backend (FastAPI)]
  B -->|publish| Q[(RabbitMQ\nqueue: events)]
  Q -->|consume| W[Worker]
  W -->|insert| P[(Postgres)]
  W -->|signed POST\nX-DevObservatory-Signature| H[Webhook URLs]
  F[Frontend (Next.js)] -->|/api/* (BFF)| B
  F -->|read| B
  B -->|query| P
```

## Components

- Backend: authentication, org/project management, API key validation, event
  ingestion, event search, analytics, funnels, retention, outbound webhook
  configuration, metrics endpoints.
- Worker: durable ingestion processing (queue → database) plus outbound
  webhook fan-out (HMAC-signed POSTs to user-configured URLs).
- Frontend: UI + BFF routes that forward to backend and store auth tokens
  in httpOnly cookies. Includes a marketing landing page, funnels page,
  retention heatmap page, and webhook management UI.

## Services

- Postgres: primary database
- RabbitMQ: ingestion queue
- Redis: rate limiting / caching
- MinIO: S3-compatible object storage endpoint
