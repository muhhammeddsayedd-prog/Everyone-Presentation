"""Read-only canonical metadata proof for the labelled English/Arabic sample."""
import datetime
import hashlib
import json
import sys
from release_foundation import ROOT,TARGET,call

def main():
    assert len(sys.argv)==1
    file=ROOT/'tools/sql/live-specs-readback.sql'
    result=call(['db','query','--linked','--project-ref',TARGET,'--file',str(file),'--output-format','json'])
    assert result.returncode==0
    observed=json.loads(result.stdout)['rows'][0]['live_specs']
    expected=[('Father',1,1),('Manager',1,1),('Waiter',3,3)]
    checks={'single_job':observed['sample_job_count']==1,
      'succeeded':observed['job']['status']=='succeeded',
      'one_attempt_per_stage':observed['job']['stage_attempts']=={'prepare_document':1,'extract_specs':1,'apply_specs':1},
      'original_utf8_retained':observed['source']['original_hash_verified'] and observed['source']['bytes']==1114 and observed['source']['arabic_preserved'],
      'real_provider_metadata':observed['provider']['provider']=='openai' and observed['provider']['requested_model']=='gpt-6.1-sol' and observed['provider']['response_reference_present'] is True,
      'exact_roles_and_slots':[(r['name'],r['headcount'],r['active_slots']) for r in observed['draft']['roles']]==expected
        and observed['draft']['role_count']==3 and observed['draft']['slot_count']==5,
      'all_origins_match':observed['draft']['origin_job_matches'] and all(r['origin_job_matches'] for r in observed['draft']['roles']),
      'missing_manager_values_not_invented':observed['draft']['roles'][1]['gender_unprovided'] and observed['draft']['roles'][1]['availability_unprovided'],
      'three_dispatched_stages':len(observed['outbox'])==3 and all(o['status']=='delivered' for o in observed['outbox'])}
    report={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':TARGET,'scope':'Actual canonical persisted synthetic app sample metadata readback; separate from UI and component tests',
      'result':'passed' if all(checks.values()) else 'failed','checks':checks,'sql_sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'observed':observed,
      'raw_source_provider_payloads_or_credentials_recorded':False}
    directory=ROOT/'tracking/evidence/m02/live-specs-app'; directory.mkdir(parents=True,exist_ok=True)
    path=directory/(report['observed_at'].replace(':','-')+'-database.json'); path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'result':report['result'],'checks':checks,'receipt':path.relative_to(ROOT).as_posix(),'job_id':observed['job']['id'],'provider_usage':observed['provider']['usage']}))
    return 0 if report['result']=='passed' else 1
if __name__=='__main__':
    try: sys.exit(main())
    except Exception: print('{"result":"unconfirmed","code":"LIVE_METADATA_READBACK_UNCONFIRMED","raw_diagnostics_suppressed":true}'); sys.exit(1)
