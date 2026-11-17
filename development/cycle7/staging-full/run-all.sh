#!/usr/bin/env bash
# Full staging evidence run from nothing: rebuild at production state, baseline on the previous release, migration
# rehearsal, previous-release compatibility, release journeys, scene proposals, recovery, screens.
# Requires: previous release web on :3161 (EPS-c7-old) and this checkout's web on :3000 (web.sh), Docker.
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd); ROOT=$(cd "$HERE/../../.." && pwd); cd "$ROOT"
S=.local/cycle7/stg
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*staging-full*gateway.mjs*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }"
rm -f $S/release-state.json $S/before-state.json $S/evidence/staging-journeys.json; rm -rf $S/artifacts
bash "$HERE/reset.sh" 2>&1 | grep -v NOTICE | tail -2
(node "$HERE/gateway.mjs" 55511 > $S/gateway.log 2>&1 &); sleep 2
docker exec eps-c7stg-db psql -U supabase_admin -h localhost -d postgres -Atc "select count(eps.refresh_candidate_projection(id)) from eps.candidates" >/dev/null 2>&1
for step in before.mjs rehearse-migrations.mjs compat-previous.mjs "release.mjs 2 3 4 5 6 7 8 9" scenes.mjs recovery.mjs browser.mjs; do
  echo "== $step"; timeout 2400 node $HERE/$step 2>&1 | grep -E '"journey"|"shots"' | cut -c1-600
done
