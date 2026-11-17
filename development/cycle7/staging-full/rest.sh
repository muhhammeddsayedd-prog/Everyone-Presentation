#!/usr/bin/env bash
# (Re)start PostgREST for the staging stack; run after every schema change so its schema cache is fresh.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../../.." && (pwd -W 2>/dev/null || pwd)); S="$ROOT/.local/cycle7/stg"
docker rm -f eps-c7stg-rest >/dev/null 2>&1 || true
docker run -d --name eps-c7stg-rest --network eps-c7stg-net --label eps.owner=cycle7-staging -p 127.0.0.1:55513:3000 \
  --env-file "$S/env/rest.env" public.ecr.aws/supabase/postgrest:v14.13 >/dev/null
for i in $(seq 1 30); do curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:55513/ 2>/dev/null | grep -q -E '200|401' && break; sleep 1; done
echo "rest=$(docker inspect -f '{{.State.Status}}' eps-c7stg-rest)"
