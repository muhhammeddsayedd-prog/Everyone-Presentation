"""Fixed canonical Settings discovery. Suppress all private CLI diagnostics."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
TARGET = 'pyibofyctwnqpvktepse'

def main():
    if len(sys.argv)!=2 or sys.argv[1] not in ('discover','readback') or (ROOT/'supabase/.temp/project-ref').read_text().strip() != TARGET:
        raise ValueError('Fixed linked read-only action required')
    source = Path(__file__).with_name('discover.sql' if sys.argv[1]=='discover' else 'readback.sql')
    result = subprocess.run(['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(source),'--output-format','json','--workdir',str(ROOT)], cwd=ROOT,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=60)
    if result.returncode:
        raise ValueError('Read-only canonical inspection unavailable')
    payload=json.loads(result.stdout)['rows']
    if len(payload)!=1 or set(payload[0])!={'discovery'}:
        raise ValueError('Unexpected closed discovery result')
    state=payload[0]['discovery']
    versions=sorted(p.name[:14] for p in (ROOT/'supabase/migrations').glob('*.sql'))
    if state['database']!='postgres' or state['operator']!='postgres' or state['migration_versions']!=versions or len(versions)!=29:
        raise ValueError('Canonical history/role mismatch')
    now=datetime.datetime.now(datetime.timezone.utc)
    receipt={'observed_at':now.isoformat(),'target':TARGET,'scope':'fixed read-only existing Producer eligibility, grants and Settings metadata; no credentials or Auth rows','sql_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'result':state}
    output=ROOT/'tracking/evidence/m07/live-settings-oauth'/f'{now.strftime("%Y-%m-%dT%H-%M-%S-%fZ")}-canonical-settings-{sys.argv[1]}.json'
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'result':'passed','evidence':str(output.relative_to(ROOT)),'state':state}))

if __name__=='__main__':
    try:main()
    except Exception:
        print(json.dumps({'result':'unverified','raw_diagnostics_suppressed':True}))
        sys.exit(1)
