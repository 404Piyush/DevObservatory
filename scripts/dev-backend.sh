#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../backend"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
python -m pip install -U pip >/dev/null
python -m pip install -r requirements.txt >/dev/null

export POSTGRES_DSN="${POSTGRES_DSN:-postgresql+psycopg://devobservatory:devobservatory@localhost:5432/devobservatory}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379/0}"
export RABBITMQ_URL="${RABBITMQ_URL:-amqp://devobservatory:devobservatory@localhost:5672/}"
export JWT_SECRET_KEY="${JWT_SECRET_KEY:-change-me}"
export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-[\"http://localhost:3000\"]}"
export S3_ENDPOINT_URL="${S3_ENDPOINT_URL:-http://localhost:9000}"
export S3_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-devobservatory}"
export S3_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-devobservatory}"
export S3_BUCKET="${S3_BUCKET:-devobservatory}"

export PYTHONPATH="$(pwd)"

alembic -c alembic.ini upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
