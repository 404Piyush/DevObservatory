#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../frontend"

export NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-http://localhost:8000/api}"
export API_BASE_URL="${API_BASE_URL:-http://localhost:8000/api}"

npm run dev -- --port 3000
