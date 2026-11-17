#!/usr/bin/env bash
# Isolated cycle-7 staging stack on this machine: real Supabase Postgres, Auth (GoTrue), Storage API and PostgREST
# on a private Docker network. Secrets come from .local/cycle7/stg/secrets.json (git-ignored) and are passed through
# env files, never on the command line. Every resource is named eps-c7stg-*; nothing else is touched.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../../.." && (pwd -W 2>/dev/null || pwd))
S="$ROOT/.local/cycle7/stg"; rm -rf "$S/storage"; mkdir -p "$S/env" "$S/storage"
NET=eps-c7stg-net
DB_IMAGE=public.ecr.aws/supabase/postgres:17.11.0.011
AUTH_IMAGE=public.ecr.aws/supabase/gotrue:v2.198.0
STORAGE_IMAGE=public.ecr.aws/supabase/storage-api:v1.96.0
REST_IMAGE=public.ecr.aws/supabase/postgrest:v14.13
node "$ROOT/development/cycle7/staging-full/keys.mjs" env "$S"   # writes env files + keys.json
docker network inspect $NET >/dev/null 2>&1 || docker network create --label eps.owner=cycle7-staging $NET >/dev/null
docker rm -f eps-c7stg-db eps-c7stg-auth eps-c7stg-storage eps-c7stg-rest >/dev/null 2>&1 || true
docker run -d --name eps-c7stg-db --network $NET --label eps.owner=cycle7-staging -p 127.0.0.1:55510:5432 \
  --env-file "$S/env/db.env" $DB_IMAGE postgres -c config_file=/etc/postgresql/postgresql.conf -c log_min_messages=fatal >/dev/null
for i in $(seq 1 90); do docker exec eps-c7stg-db pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 1; done
sleep 3
# The image does not derive service-role passwords from POSTGRES_PASSWORD; set them over the container socket.
node -e "const p=require(process.argv[1]).pg;for(const r of ['supabase_auth_admin','supabase_storage_admin','authenticator'])console.log(\`alter role \${r} with login password '\${p}';\`)" "$S/secrets.json"   | docker exec -i eps-c7stg-db psql -U supabase_admin -h localhost -d postgres -q -v ON_ERROR_STOP=1
docker run -d --name eps-c7stg-auth --network $NET --label eps.owner=cycle7-staging -p 127.0.0.1:55512:9999 --env-file "$S/env/auth.env" $AUTH_IMAGE >/dev/null
docker run -d --name eps-c7stg-storage --network $NET --label eps.owner=cycle7-staging -p 127.0.0.1:55514:5000 -v "$S/storage:/var/lib/storage" \
  --env-file "$S/env/storage.env" $STORAGE_IMAGE >/dev/null
for i in $(seq 1 90); do
  docker logs eps-c7stg-storage 2>&1 | grep -q 'Started Successfully' && docker logs eps-c7stg-auth 2>&1 | grep -q 'db worker started' && break; sleep 2; done
echo "auth=$(docker inspect -f '{{.State.Status}}' eps-c7stg-auth) storage=$(docker inspect -f '{{.State.Status}}' eps-c7stg-storage)"
# PostgREST is started by rest.sh after the schema exists (it caches the schema at start; restart it after migrations).
