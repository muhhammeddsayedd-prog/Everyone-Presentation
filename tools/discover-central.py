"""Run the fixed M00 metadata SELECT against the user's intentionally linked project.

Never accepts arbitrary SQL or database URLs; captures CLI errors without forwarding
them because configuration failures may contain credentials. Writes only metadata.
"""
from pathlib import Path
import datetime
import json
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
ref_file = ROOT / 'supabase/.temp/project-ref'
ref = ref_file.read_text(encoding='utf-8').strip()
if not re.fullmatch(r'[a-z]{20}', ref):
    raise SystemExit('Unexpected linked project reference. No query executed.')
query = ROOT / 'tools/sql/discover-central.sql'
result = subprocess.run(['npx.cmd', '--yes', 'supabase@2.122.0', 'db', 'query', '--linked',
    '--file', str(query), '--output-format', 'json', '--workdir', str(ROOT)],
    cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=45)
out = ROOT / 'tracking/discovery/central-metadata.json'
if result.returncode:
    print(json.dumps({'status': 'FAIL', 'project_ref': ref, 'exit_code': result.returncode,
        'code': 'CENTRAL_READ_ONLY_QUERY_UNAVAILABLE', 'raw_errors_suppressed': True}))
    sys.exit(1)
try:
    payload = json.loads(result.stdout)
except ValueError:
    print(json.dumps({'status': 'FAIL', 'project_ref': ref, 'code': 'UNEXPECTED_CLI_OUTPUT', 'raw_output_suppressed': True}))
    sys.exit(1)
receipt = {'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'project_ref': ref,
    'command': 'npx.cmd --yes supabase@2.122.0 db query --linked --file tools/sql/discover-central.sql --output-format json',
    'scope': 'read-only metadata, no table row data or function bodies', 'exit_code': 0, 'result': payload}
out.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'status':'PASS', 'project_ref':ref, 'evidence':str(out.relative_to(ROOT)), 'payload_type':type(payload).__name__}))
