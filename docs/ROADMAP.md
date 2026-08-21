# DevObservatory — Roadmap

This document tracks active and upcoming work on DevObservatory.

## Done

### Phase 1 — Security hardening (`2c5ddea`)
- Boot-time guard against weak/short `JWT_SECRET_KEY` and `API_KEY_HASH_SECRET`
  in non-local environments.
- `Session.refresh_family_id` + reuse detection on `/auth/refresh` revokes the
  whole family if a previously rotated refresh token is replayed.
- Rate limiting on `/auth/register`, `/auth/login`, `/auth/refresh` via SlowAPI.
- `Invite.expires_at` (7d) and `Invite.revoked_at`; accept rejects expired or
  revoked invites.
- `python-jose` replaced with `PyJWT[crypto]==2.13.0`; `decode_token` now requires
  `exp/iat/sub/sid/typ` claims.
- `require_project_role` extracted into `app/deps.py`; dead `_ = role in (...)`
  line in `routes/events.py` removed; `list_events` now actually verifies the
  viewer role.
- `SecurityHeadersMiddleware` on FastAPI + `headers()` in `next.config.ts`
  (HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy).
- `scripts/smoke.sh` was passing literal `***` as auth headers; fixed to use
  `$ACCESS` and `$API_KEY`.
- New tests in `backend/tests/test_security.py` (8 tests).

## In progress

### Phase 2 — Modern stack + new features

The shape of a portfolio-grade observability tool. Shipped as a series of
focused commits, each tested and demoable on its own.

| Commit | Scope |
|---|---|
| `infra: add ROADMAP` | This file. |
| `frontend: TanStack Query + shadcn/ui primitives + Recharts` | Data fetching, dialogs, dropdowns, toasts, charts. No feature change. |
| `backend: SSE event stream + Postgres LISTEN/NOTIFY bridge` | Real-time event feed via Server-Sent Events. |
| `frontend: live events dashboard` | Replace polling with SSE; add time-series chart and top-events bar chart. |
| `backend+frontend: analytics search` | Cursor-paginated event search by name, user_id, time range. |
| `frontend: funnels` | UI to define a funnel (ordered event list); SQL computes step-by-step conversion. |
| `frontend: demo mode` | One-click seed of a fake org + project + 30 days of synthetic events for portfolio demos. |
| `frontend: share links` | Tokenized read-only URLs for a project's dashboard. |
| `frontend: SDK snippet generator` | Per-language (curl / Node / Python / Go) copyable ingest snippet pre-filled with the user's API key. |
| `chore: docs, screenshots, README polish` | Update screenshots and README. |

### Why these choices

- **TanStack Query v5** dedupes the `useEffect → fetch` chains every page
  already has, and adds request cancellation, retries, and cache invalidation
  for free.
- **shadcn/ui** (Radix + Tailwind v4) gives us accessible primitives without
  shipping a component library — the project already uses Radix.
- **Recharts** for charts; **Sonner** for toasts. Both are tiny, dependency-free,
  and composable.
- **Postgres LISTEN/NOTIFY** for SSE rather than Redis pub/sub so the SSE path
  works in any environment with Postgres.
- **No SDK downloads** — the snippet generator outputs raw HTTP requests, not a
  published npm package.

## Won't do

- SSO/SAML, multi-tenant isolation, self-hosted Helm charts. Out of scope for
  a portfolio piece.