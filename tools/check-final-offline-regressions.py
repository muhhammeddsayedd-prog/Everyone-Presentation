"""Fixed operations/tool regression groups only; no live helper invocation.

Suites were reviewed for injected network/configuration seams. Full diagnostics
stay ignored; tracked output contains commands, counts, exits and source hashes.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import datetime, hashlib, json, re, subprocess, sys, uuid

ROOT=Path(__file__).resolve().parents[1]
PYTHON=ROOT/'.venv-skills/Scripts/python.exe'


def sha(data):return hashlib.sha256(data).hexdigest()


def files():
    selected=sorted((ROOT/'tests/operations').glob('*.test.mjs'))+sorted((ROOT/'tests/tools').glob('*.test.mjs'))
    python=sorted((ROOT/'tests/operations').glob('test_*.py'))
    if not selected or not python:raise ValueError('REQUIRED_OFFLINE_TEST_FILES_MISSING')
    return selected,python


def sources(test_files):
    paths=set(test_files)
    for directory in ('tools','packages','apps/worker/src','apps/web/lib','supabase/migrations','tests/operations'):
        for file in (ROOT/directory).rglob('*'):
            if file.is_file() and file.suffix in ('.mjs','.py','.ts','.sql') and '__pycache__' not in file.parts:
                paths.add(file)
    for file in ('package-lock.json','package.json','development/local-db/reviewed.json','contracts/openapi.yaml','contracts/mcp-tool-catalog.json'):
        paths.add(ROOT/file)
    return {file.relative_to(ROOT).as_posix():sha(file.read_bytes()) for file in sorted(paths)}


def run_group(group,private):
    command=group['arguments'];started=datetime.datetime.now(datetime.timezone.utc)
    result=subprocess.run(command,cwd=ROOT,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=240)
    combined=result.stdout+'\n'+result.stderr
    (private/(group['name']+'.stdout.txt')).write_text(result.stdout,encoding='utf8')
    (private/(group['name']+'.stderr.txt')).write_text(result.stderr,encoding='utf8')
    if group['kind']=='node':
        count=lambda name:int(re.search(r'(?m)^[#ℹ]?\s*'+name+r' (\d+)\s*$',combined)[1]) if re.search(r'(?m)^[#ℹ]?\s*'+name+r' (\d+)\s*$',combined) else None
        counts={name:count(name) for name in ('tests','pass','fail','cancelled','skipped','todo')}
        passed=result.returncode==0 and counts['tests'] is not None and counts['tests']>0 and counts['pass']==counts['tests']
    else:
        match=re.search(r'Ran (\d+) tests? in ',combined);total=int(match[1]) if match else None
        failures=re.search(r'FAILED \(([^)]*)\)',combined)
        counts={'tests':total,'pass':total if result.returncode==0 else None,'failure_summary':failures[1] if failures else None}
        passed=result.returncode==0 and total is not None and total>0 and re.search(r'(?m)^OK\s*$',combined) is not None
    return {'name':group['name'],'command':group['command'],'started_at':started.isoformat(),
      'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit_code':result.returncode,
      'result':'passed' if passed else 'failed','counts':counts,'stdout_sha256':sha(result.stdout.encode()),
      'stderr_sha256':sha(result.stderr.encode()),'raw_diagnostics':'ignored .local/final-offline-checks/<run-id>/ only'}


def main():
    if len(sys.argv)!=1 or Path(sys.executable).resolve()!=PYTHON.resolve():raise ValueError('PINNED_PROJECT_PYTHON_REQUIRED')
    node,python=files();before=sources(node+python)
    run_id=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+uuid.uuid4().hex[:8]
    private=ROOT/'.local/final-offline-checks'/run_id;private.mkdir(parents=True,exist_ok=False)
    groups=[{'name':'node-operations-and-tools','kind':'node','arguments':['node','tools/run-tests.mjs','tests/operations/*.test.mjs','tests/tools/*.test.mjs'],
      'command':'node tools/run-tests.mjs tests/operations/*.test.mjs tests/tools/*.test.mjs'},
      {'name':'python-operations','kind':'python','arguments':[str(PYTHON),'-X','utf8','-m','unittest','discover','-s','tests/operations','-p','test_*.py'],
      'command':'.\\.venv-skills\\Scripts\\python.exe -X utf8 -m unittest discover -s tests/operations -p test_*.py'}]
    with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda group:run_group(group,private),groups))
    after=sources(node+python);stable=before==after
    changed=sorted(key for key in set(before)|set(after) if before.get(key)!=after.get(key))
    report={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'result':'passed' if stable and all(row['result']=='passed' for row in results) else 'failed',
      'scope':'Current offline operations and tool regressions; imported pure validation/SQL-render/mock-SDK code plus injected local fixtures',
      'groups':results,'selected_node_files':[file.relative_to(ROOT).as_posix() for file in node],
      'selected_python_files':[file.relative_to(ROOT).as_posix() for file in python],
      'sources_stable':stable,'source_sha256':before,'changed_source_paths':changed,
      'live_or_external_test_files_omitted_from_selected_groups':[],
      'not_run':['live HTTP/Storage probes','cloud release/activation/reconciliation executables','DB/Docker/native media rehearsals',
        'actual provider/n8n workflows','browser/e2e suites','tests/tools/test_*.py (outside the requested Python operations group)'],
      'cloud_called':False,'provider_called':False,'docker_or_ffmpeg_called':False,'runtime_config_changed':False,
      'private_credentials_loaded':False,'hosting_deferred':True,
      'receipt_limit':'Source hashes seal current code/configuration contracts, not all historical metadata fixture files. Raw test output is retained privately.'}
    directory=ROOT/'tracking/evidence/m03/final-offline-checks';directory.mkdir(parents=True,exist_ok=True)
    file=directory/(run_id+'.json');file.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'result':report['result'],'receipt':file.relative_to(ROOT).as_posix(),'sources_stable':stable,
      'groups':[{'name':row['name'],'exit_code':row['exit_code'],'counts':row['counts']} for row in results],
      'cloud_or_provider_called':False,'configuration_changed':False}))
    return 0 if report['result']=='passed' else 1


if __name__=='__main__':
    try:sys.exit(main())
    except Exception:sys.stderr.write('Fixed offline regression capture stopped; raw diagnostics remain private.\n');sys.exit(1)
