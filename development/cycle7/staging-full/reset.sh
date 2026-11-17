#!/usr/bin/env bash
# Rebuild the whole staging stack from nothing at production state (history 50), seeded. Every resource is eps-c7stg-*.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd); ROOT=$(cd "$HERE/../../.." && pwd)
PY=d:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe
cd "$ROOT"
MSYS_NO_PATHCONV=1 bash "$HERE/up.sh"
"$PY" -X utf8 "$HERE/build.py" base
"$PY" -X utf8 "$HERE/build.py" config
MSYS_NO_PATHCONV=1 bash "$HERE/rest.sh"
node "$HERE/seed.mjs"
rm -f .local/cycle7/stg/evidence/staging-journeys.json .local/cycle7/stg/before-state.json
