#!/usr/bin/env bash
# Start a web checkout's Next server against the staging gateway.  Usage: web.sh <checkout> <port> <logfile>
# Development server (the hosted-deployment admission refuses any non-canonical SUPABASE_URL in a production build).
set -euo pipefail
CHECKOUT=$1; PORT=$2; LOG=$3
HERE=$(cd "$(dirname "$0")" && (pwd -W 2>/dev/null || pwd)); S="$HERE/../../../.local/cycle7/stg"
GW=$(node -p "require('$S/secrets.json').review_gateway"); RP=$(node -p "require('$S/secrets.json').review_replay")
cd "$CHECKOUT/apps/web"
EPS_REVIEW_GATEWAY_KEY=$GW EPS_REVIEW_REPLAY_KEY=$RP CENTRAL_CANDIDATE_UPLOADS_ENABLED=true CENTRAL_CANDIDATE_MAXIMUM_UPLOAD_BYTES=268435456 \
CENTRAL_ADAPTER_MODE=supabase APP_ENV=development APP_BASE_URL=http://127.0.0.1:$PORT SUPABASE_URL=http://127.0.0.1:55511 \
SUPABASE_PUBLISHABLE_KEY=sb_publishable_c7staginglocal01 NEXT_TELEMETRY_DISABLED=1 \
  node ../../node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port $PORT > "$LOG" 2>&1
