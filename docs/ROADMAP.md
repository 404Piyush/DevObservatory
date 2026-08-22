# DevObservatory — Roadmap

This document tracks active and completed work on DevObservatory.

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

### Phase 3 — User experience polish

| Commit | Scope |
|---|---|
| `feat: event search + filters + cursor pagination` | New `GET /projects/{id}/events/search` route with stable `(received_at, id)` cursor; frontend filter panel + "Load more" pagination; SSE live events filtered by the same criteria client-side. |
| `feat: collapsible JSON viewer` | Recursive tree with color-coded primitives, hover-revealed copy-path and copy-value buttons, configurable initial expand depth. |
| `feat: empty states with onboarding CTAs` | Reusable `<EmptyState>` component used on Dashboard (no orgs) and Events (no events match / pick a project). |
| `feat: mobile responsiveness` | Hamburger DropdownMenu on `<md`, chart heights tuned (`h-56 sm:h-64`). |
| `feat: marketing landing page at /` | Hero, six-card feature grid, "How it works" diagram, tech stack + run-locally snippets. Reachable whether signed in or not. |
| `feat: dark-mode chart colors` | New CSS variables in `globals.css` (`--chart-1`, `--chart-grid`, `--chart-axis`); all hardcoded chart colors replaced with `var(...)`. |

### Phase 4 — Engineering polish + new features

| Commit | Scope |
|---|---|
| `ci: GitHub Actions workflow` | Postgres service container, ruff + pytest + alembic dry-run on backend, typecheck + `next build` on frontend, concurrency-cancel. |
| `chore: pre-commit hooks` | ruff + ruff-format, prettier with tailwindcss plugin, file sanity checks; prettier config in frontend. |
| `feat: outbound webhooks` | New `Webhook` model + migration, HMAC-SHA256 signed POSTs from the worker (fire-and-forget); backend routes + BFF + React Query hooks + Projects page UI with secret-once dialog. |
| `feat: event release/environment + stack-trace pretty-printing` | `release` + `environment` fields on events (with migration + indexes); pure-Python stack-frame parser supporting Sentry/Python/JS conventions; frontend `<StackTrace>` component with in-app highlighting. |

### Phase 5 — Product features

| Commit | Scope |
|---|---|
| `feat: CSV / NDJSON export for events` | New `GET /projects/{id}/events/export?format=csv|json` route; same filters as `/search`; BFF proxy; frontend "Download" dropdown with applied filters. |
| `feat: funnel snapshots + 14-day trend` | New `FunnelSnapshot` model + migration; `POST /snapshot` upserts today's funnel; `GET /trend?days=14` returns per-day per-step counts; frontend line chart on the Funnels page. |
| `feat: retention cohort heatmap` | Pure-Python `compute_retention` + `GET /projects/{id}/retention?event_name=...&days=14` route; new Retention page in the nav with event picker and table-style heatmap. |

### Phase 6 — Security audit + cleanup (`2122af6`)

Audit of the codebase after Phases 1–5. Three real findings were fixed:

- **HIGH**: `WebhookCreate.url` was unvalidated `str`, allowing SSRF to private
  IPs (10/8, 192.168/16, 169.254/16 incl. AWS metadata, 127/8), `file://`,
  and `javascript:` schemes. Fix: Pydantic field validator enforces http(s)
  scheme + non-empty hostname; `_ip_is_public()` resolver check rejects any
  host that resolves to a private/loopback/link-local address.
- **MEDIUM**: `GET /retention/...` loaded ALL events for the project into
  Python. Fix: hard cap of 200,000 events with a 400 response if exceeded.
- **LOW**: CSV export didn't escape formula-leader characters (=, +, -, @).
  Excel would auto-execute `=HYPERLINK(...)` on open. Fix: `_csv_escape()`
  prefixes any cell starting with a leader character with a single quote.

Verified the original Phase 1 audit items (C-1, H-1..H-4, M-1, L-5, L-6) were
all still in place.

Two audit items flagged as potential bugs were verified as **false positives**
(the tool's display layer was redacting correct content as `***`):
- `scripts/smoke.sh` was already correct (uses `$ACCESS` / `$API_KEY`).
- BFF route auth headers were already `access ? "Bearer " + access : ""`.

### Phase 7 — Frontend polish (`a056d0d`)

- **Real bug fixed**: `useState` was called after an early return in
  `stack-trace.tsx`, violating React's rules-of-hooks. Moved the hook above
  the early return so it runs on every render.
- `use-event-stream.ts` uses a `lastProjectIdRef` guard so the state reset
  fires only on real transitions, not every effect run.
- Events page moves the pagination reset into `applyFilters`/`clearFilters`
  where the state changes are triggered by the user.
- New shared `useAutoSelect` hook used by Events, Funnels, and Retention
  pages for first-org / first-project auto-select with proper ref-guarding,
  so a user-picked value isn't clobbered on every refetch.
- `funnel_result` route now uses the `_compute_funnel_rows` helper instead
  of inlining the same intersection/conversion logic.
- Removed three unused imports/variables; file-level eslint-disable added for
  intentional apostrophes/quotes in user-facing JSX text.

## Won't do

- SSO/SAML, multi-tenant isolation, self-hosted Helm charts. Out of scope for
  a portfolio piece.
- A full SQL rewrite of the retention query (the Python-side aggregation is
  documented as capped at 200k events; a production rewrite would push the
  aggregation into Postgres).
