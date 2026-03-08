#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8000/api}"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required"
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required"
  exit 1
fi

EMAIL="user_$(date +%s)@example.com"
PASS="password123"
ORG_NAME="Acme_$(date +%s)"
PROJECT_NAME="telemetry_$(date +%s)"

curl -fsS "$API_BASE/../healthz" >/dev/null

curl -fsS -X POST "$API_BASE/auth/register" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"Test User\"}" \
  >/dev/null

TOKENS="$(curl -fsS -X POST "$API_BASE/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")"

ACCESS="$(printf '%s' "$TOKENS" | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')"

ORG="$(curl -fsS -X POST "$API_BASE/orgs" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ACCESS" \
  -d "{\"name\":\"$ORG_NAME\"}")"
ORG_ID="$(printf '%s' "$ORG" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')"

PROJECT="$(curl -fsS -X POST "$API_BASE/orgs/$ORG_ID/projects" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ACCESS" \
  -d "{\"name\":\"$PROJECT_NAME\"}")"
PROJECT_ID="$(printf '%s' "$PROJECT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')"

KEY="$(curl -fsS -X POST "$API_BASE/projects/$PROJECT_ID/api-keys" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ACCESS" \
  -d '{"name":"ingestion"}')"
API_KEY="$(printf '%s' "$KEY" | python3 -c 'import sys,json; print(json.load(sys.stdin)["api_key"])')"

curl -fsS -X POST "$API_BASE/events" \
  -H 'content-type: application/json' \
  -H "X-API-Key: $API_KEY" \
  -d '{"event_name":"user_signup","user_id":"123","timestamp":"2026-03-07T00:00:00Z","properties":{"plan":"pro"}}' \
  >/dev/null

sleep 2

EVENTS="$(curl -fsS -H "authorization: Bearer $ACCESS" "$API_BASE/projects/$PROJECT_ID/events")"

printf '%s' "$EVENTS" | python3 -c 'import sys,json; data=json.load(sys.stdin); print(json.dumps({"event_count": len(data), "latest_event": (data[0]["event_name"] if data else None)}, indent=2))'
