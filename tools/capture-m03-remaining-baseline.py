"""Read-only fixed canonical17 discovery; raw diagnostics remain ignored."""
import datetime
import hashlib
import json
import uuid
from release_foundation import ROOT, TARGET, call

SQL = 'tools/sql/candidate-pipeline-readback.sql'

def main():
    if (ROOT/'supabase/.temp/project-ref').read_text().strip() != TARGET:
        raise ValueError('Canonical target differs.')
    before = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'supabase/migrations').glob('*.sql')}
    if len(before) != 17 or before.get('20261029100500_m03_candidate_pipeline.sql') != '4af04b4a3fb050e39aa23958c3f82e304cc7d7a1f450a5d93f7f50bc001bd836':
        raise ValueError('Require exact immutable canonical17 baseline.')
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+uuid.uuid4().hex[:8]
    private = ROOT/'.local/m03-remaining-discovery'; private.mkdir(parents=True, exist_ok=True)
    result = call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT/SQL),'--output-format','json'])
    (private/(stamp+'.stdout')).write_text(result.stdout, encoding='utf8')
    (private/(stamp+'.stderr')).write_text(result.stderr, encoding='utf8')
    receipt = {'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':TARGET,'result':'failed',
      'read_only':True,'cloud_mutated':False,'sql_sha256':hashlib.sha256((ROOT/SQL).read_bytes()).hexdigest(), 'migration_seals':before}
    if result.returncode == 0:
        rows = json.loads(result.stdout)['rows']
        if len(rows) != 1 or set(rows[0]) != {'candidate_pipeline_release'}: raise ValueError('Discovery projection differs.')
        state = rows[0]['candidate_pipeline_release']
        if state['query_role'] != state['database'] or state['query_role'] != 'postgres' or not state['unrestricted_visibility']:
            raise ValueError('Discovery visibility unconfirmed.')
        if state['versions'] != sorted(name[:14] for name in before): raise ValueError('Canonical history differs.')
        # This fixed existing observer emits catalog definitions, hashes/counts and
        # nonsecret configuration; never source text, credentials or Auth payloads.
        public = ROOT/'tracking/evidence/m03/remaining-discovery'; public.mkdir(parents=True, exist_ok=True)
        file = public/(stamp+'.json')
        receipt.update(result='passed',state=state)
        file.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8')
        print(json.dumps({'result':'passed','evidence':file.relative_to(ROOT).as_posix(),'versions':len(state['versions']),
          'candidate_profiles':state['counts'].get('eps.candidates'),'candidate_media':state['counts'].get('eps.candidate_media'),
          'runtime_operations':len(state['runtime']['execute']),'cloud_mutated':False}))
    else:
        print(json.dumps({'result':'failed','cloud_mutated':False,'raw_diagnostics':'ignored local files'}))
        return 1
    return 0

if __name__ == '__main__':
    try: raise SystemExit(main())
    except Exception as error:
        print(json.dumps({'result':'blocked','code':type(error).__name__,'cloud_mutated':False,'private_values_suppressed':True}))
        raise SystemExit(1)
