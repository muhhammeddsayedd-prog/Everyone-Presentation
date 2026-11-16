#!/usr/bin/env bash
# Bring up the cycle-7 integrated local stack (disposable; never cloud):
#   1. fresh live-state replica + all cycle-7 migrations + SQL tests  (replica.py apply)
#   2. integrated seed + hosted-equivalent auth helpers
#   3. PostgREST in front of it on 127.0.0.1:55480 (private docker network eps-c7-net)
# The gateway (gateway.mjs, :55481) and the Next app (:3110) are started separately; see README.md.
# Usage: EPS_INT_SECRET_FILE=<json with {"jwt":...}> development/cycle7/integrated/up.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
C="${EPS_INT_CONTAINER:-eps-cycle7-full}"
SECRET_FILE="${EPS_INT_SECRET_FILE:?set EPS_INT_SECRET_FILE}"
cd "$ROOT"
EPS_REPLICA_CONTAINER="$C" python -X utf8 development/cycle7/staging/replica.py apply | tail -c 400; echo
docker exec -i "$C" psql -U supabase_admin -h localhost -d postgres -v ON_ERROR_STOP=1 -q < development/cycle7/integrated/auth-stub.sql
docker exec -i "$C" psql -U supabase_admin -h localhost -d postgres -v ON_ERROR_STOP=1 -q < development/cycle7/integrated/seed.sql 2>&1 | grep -v NOTICE || true
PW="$(openssl rand -hex 16)"
docker exec -i "$C" psql -U supabase_admin -h localhost -d postgres -q -c "alter role authenticator password '$PW';"
docker network create eps-c7-net >/dev/null 2>&1 || true
docker network connect eps-c7-net "$C" 2>/dev/null || true
JWT="$(python -c "import json;print(json.load(open('$SECRET_FILE'))['jwt'])")"
docker rm -f eps-c7-postgrest >/dev/null 2>&1 || true
docker run -d --name eps-c7-postgrest --network eps-c7-net -p 127.0.0.1:55480:3000 \
  -e PGRST_DB_URI="postgres://authenticator:$PW@$C:5432/postgres" -e PGRST_DB_SCHEMAS=public \
  -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$JWT" public.ecr.aws/supabase/postgrest:v14.13 >/dev/null
sleep 5
docker logs eps-c7-postgrest 2>&1 | grep -o "loaded.*RPCs" | tail -1
