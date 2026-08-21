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

### Phase 2 — Modern stack + new features

| Commit | Scope |
|---|---|
| `infra: add ROADMAP` | This file. |
| `frontend: TanStack Query + shadcn/ui primitives + Recharts` | Data fetching, dialogs, dropdowns, toasts, charts. No feature change. |
| `feat: SSE event stream + per-project analytics dashboard` | Postgres NOTIFY trigger → SSE; per-minute time-series + top-events charts; live event feed with reconnect. |
| `feat: funnels + demo seed + share links` | Conversion funnels, one-click demo seed (~3,000 events over 30 days), tokenized public share links. |
| `feat: SDK snippet generator` | cURL / Node / Python / Go ingest snippets pre-filled with the user's API key. |

## Won't do

- SSO/SAML, multi-tenant isolation, self-hosted Helm charts. Out of scope for
  a portfolio piece.