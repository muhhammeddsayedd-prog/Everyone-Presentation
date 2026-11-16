# Cycle 7 integrated local check

Runs the **real web app and its HTTP handlers** (the same handlers MCP uses) against a disposable replica of the
canonical database with every cycle-7 migration, through PostgREST — no mocked API responses. It never touches a
shared or cloud project.

What is real: Next.js app in `CENTRAL_ADAPTER_MODE=supabase`, central services, SQL functions/RLS/grants, job kernel
(`record_job_event`), idempotency, pagination. What is simulated:
- **Auth** — `gateway.mjs` verifies locally signed HS256 tokens at `/auth/v1/user` (hosted GoTrue in production).
- **Storage** — metadata only: the harness registers an "uploaded" object; `object/info` and signed-upload URLs are
  answered by the gateway. No bytes are stored, so media playback/rendering is out of scope here.
- **Worker** — `c7sim.*` (seed.sql) drives each candidate stage through `eps.record_job_event` with controlled
  provider results (silent video → manual profile), exactly the callback path the hosted worker uses.
- **Auth helpers** — `auth-stub.sql` aligns the replica image's legacy `auth.uid()` with hosted Supabase.

## Run
```bash
S=<private dir>; echo "{\"jwt\":\"$(openssl rand -hex 32)\"}" > $S/int-secret.json
EPS_INT_SECRET_FILE=$S/int-secret.json bash development/cycle7/integrated/up.sh
EPS_INT_JWT_SECRET=<jwt> node development/cycle7/integrated/gateway.mjs 55481 &
cd apps/web && EPS_REVIEW_GATEWAY_KEY=$(openssl rand -hex 32) EPS_REVIEW_REPLAY_KEY=$(openssl rand -hex 32) \
  CENTRAL_CANDIDATE_UPLOADS_ENABLED=true CENTRAL_CANDIDATE_MAXIMUM_UPLOAD_BYTES=268435456 CENTRAL_ADAPTER_MODE=supabase \
  APP_ENV=development APP_BASE_URL=http://127.0.0.1:3110 SUPABASE_URL=http://127.0.0.1:55481 \
  SUPABASE_PUBLISHABLE_KEY=sb_publishable_localintegrated01 node ../../node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3110 &
cd ../.. && EPS_INT_JWT_SECRET=<jwt> node development/cycle7/integrated/journeys.mjs \
  upload reload retry tape add order setup scenes audience picture repair search
```
Results: `.local/cycle7/integrated/journeys.json`. Journeys `setup`→`picture` share state and run in that order on a
fresh stack (`audience` changes Settings once).
