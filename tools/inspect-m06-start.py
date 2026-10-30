"""Fixed M06 read-only metadata discovery; no raw CLI diagnostics."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import sys
import uuid
from release_foundation import call

ROOT = Path(__file__).resolve().parents[1]
SQL = ROOT / 'tools/sql/m06-start-discovery.sql'

def main():
    if sys.argv[1:]: raise ValueError('M06_START_ARGUMENTS_INVALID')
    seal = hashlib.sha256(SQL.read_bytes()).hexdigest()
    result = call(['db', 'query', '--linked', '--project-ref', 'pyibofyctwnqpvktepse', '--file', str(SQL), '--output-format', 'json'])
    if result.returncode or len(result.stdout.encode()) > 256 * 1024: raise ValueError('M06_START_UNCONFIRMED')
    rows = json.loads(result.stdout)['rows']
    if len(rows) != 1 or set(rows[0]) != {'m06_start'}: raise ValueError('M06_START_SHAPE_INVALID')
    state = rows[0]['m06_start']
    if state['query_role'] != 'postgres' or state['database'] != 'postgres' or state['existing_requester_count'] != 1: raise ValueError('M06_START_TARGET_INVALID')
    if hashlib.sha256(SQL.read_bytes()).hexdigest() != seal: raise ValueError('M06_START_SOURCE_CHANGED')
    directory = ROOT / 'tracking/evidence/m06/start-discovery'; directory.mkdir(parents=True, exist_ok=True)
    file = directory / (datetime.now(timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8] + '.json')
    report = {'result': 'captured', 'read_only': True, 'target': 'pyibofyctwnqpvktepse', 'sql_sha256': seal, 'state': state, 'hosting_deferred': True}
    with file.open('x', encoding='utf8') as handle: json.dump(report, handle, indent=2); handle.write('\n')
    print(json.dumps({'result': 'captured', 'receipt': file.relative_to(ROOT).as_posix(), 'history_count': len(state['history']),
        'link_manager': state['link_manager_rows'], 'series': state['dummy_series']}))

if __name__ == '__main__':
    try: main()
    except Exception: sys.stderr.write('M06 read-only start inspection was not confirmed; private diagnostics suppressed.\n'); sys.exit(1)
