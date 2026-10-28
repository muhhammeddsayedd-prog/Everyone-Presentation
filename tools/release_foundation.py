"""Apply only the locally proven initial canonical migration set to the owner-selected project.

No seed, Vault sync, role export, credential output, arbitrary SQL or target option.
Raw CLI diagnostics stay in ignored local storage because connection errors may be private.
"""
from pathlib import Path
import datetime
import hashlib
import json
import re
import subprocess
import sys
import tomllib

ROOT = Path(__file__).resolve().parents[1]
TARGET = 'pyibofyctwnqpvktepse'
FILES = [
    '20261028010943_m01_canonical_foundation.sql',
    '20261028013324_m01_identity_role_inheritance.sql',
    '20261028013655_m01_workspace_scope_alias.sql',
]

def call(arguments):
    return subprocess.run(['npx.cmd','--yes','supabase@2.122.0',*arguments,'--workdir',str(ROOT)],
        cwd=ROOT,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=90)

def main():
    action = sys.argv[1] if len(sys.argv) == 2 else ''
    if action not in ('dry-run','apply'):
        raise ValueError('Use dry-run or apply for this exact initial release.')
    if (ROOT/'supabase/.temp/project-ref').read_text().strip() != TARGET:
        raise ValueError('Linked cloud target differs from the owner-approved project.')
    config = tomllib.loads((ROOT/'supabase/config.toml').read_text())
    if config['db']['migrations']['enabled'] is not True or config['db']['seed']['enabled'] is not False:
        raise ValueError('Require enabled reviewed migrations and disabled seeds.')
    manifest = json.loads((ROOT/'development/local-db/reviewed.json').read_text())
    hashes = {}
    actual_files = sorted(p.name for p in (ROOT/'supabase/migrations').glob('*.sql'))
    if actual_files != FILES:
        raise ValueError('Migration set changed; prepare a new reviewed release.')
    for name in FILES:
        relative = 'supabase/migrations/'+name
        digest = hashlib.sha256((ROOT/relative).read_bytes()).hexdigest()
        if not any(item['path'] == relative and item['sha256'] == digest for item in manifest['migrations']):
            raise ValueError('Migration bytes do not match reviewed local proof.')
        hashes[name] = digest
    if json.loads((ROOT/'tracking/evidence/m01/DB_CONCURRENCY.json').read_text())['result'] != 'PASS':
        raise ValueError('Real local concurrency proof is required.')
    evidence = ROOT/'tracking/evidence/cloud-foundation'
    private = ROOT/'.local/cloud-release'
    evidence.mkdir(parents=True,exist_ok=True); private.mkdir(parents=True,exist_ok=True)
    if action == 'apply':
        previous = json.loads((evidence/'dry-run.json').read_text())
        if previous['exit_code'] != 0 or previous['hashes'] != hashes or previous['pending_migrations'] != FILES:
            raise ValueError('Exact successful dry-run proof is required before application.')
    before = call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT/'tools/sql/central-release-preflight.sql'),'--output-format','json'])
    if before.returncode:
        raise ValueError('Cloud read-only preflight failed; no application attempted.')
    payload = json.loads(before.stdout)
    state = payload['rows'][0]['preflight']
    if state['eps_schema_present'] or state['business_collisions'] or state['role_collisions']:
        raise ValueError('Unexpected existing application objects; preserve state and reconcile history.')
    command = ['db','push','--linked','--project-ref',TARGET,'--skip-vault','--yes','--output-format','json']
    if action == 'dry-run': command.append('--dry-run')
    result = call(command)
    (private/(action+'-raw.txt')).write_text(result.stdout+'\n'+result.stderr,encoding='utf-8')
    pending = sorted(set(re.findall(r'\d{14}_[A-Za-z0-9_]+\.sql',result.stdout+'\n'+result.stderr)))
    receipt = {'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':TARGET,
        'action':action,'command':'npx.cmd --yes supabase@2.122.0 '+' '.join(command),
        'exit_code':result.returncode,'hashes':hashes,'pending_migrations':pending,
        'preflight':state,'vault_sync':False,'seeds':False,'raw_diagnostics':'ignored .local/cloud-release/ only',
        'application_verified_by_readback':False}
    (evidence/(action+'.json')).write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(receipt,indent=2))
    return result.returncode

if __name__ == '__main__':
    try: sys.exit(main())
    except (ValueError,KeyError,FileNotFoundError,subprocess.TimeoutExpired) as error:
        print(json.dumps({'status':'BLOCKED','reason':str(error) if isinstance(error,ValueError) else type(error).__name__,'raw_errors_suppressed':True}))
        sys.exit(1)
