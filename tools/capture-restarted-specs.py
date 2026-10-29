"""Fixed read-only completed restart-job proof; no worker-health assertion."""
import datetime
import hashlib
import json
import sys
import uuid
from release_foundation import ROOT, TARGET, call

SQL = 'tools/sql/restarted-specs-readback.sql'
SQL_SHA256 = '5c23b3a866b7a3a96e95365032bbf1c4aa5e376b4ace940ccb5f76a7f9bab5c0'
JOB = '1e1104aa-2e0f-4f6f-8bd3-7e04ac09e7ed'
STAGES = ['prepare_document','extract_specs','apply_specs']


def main():
    assert len(sys.argv) == 1 and SQL_SHA256
    source = (ROOT / SQL).read_bytes(); assert hashlib.sha256(source).hexdigest() == SQL_SHA256
    assert (ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET
    stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    report = {'observed_at': stamp, 'target': TARGET, 'read_only': True, 'result': 'unconfirmed', 'sql_sha256': SQL_SHA256,
              'scope': 'Actual app request queued before worker relaunch, then completed. Not a database restart, in-flight expiry or current idle-worker health proof.',
              'worker_health_asserted': False, 'provider_called_by_inspector': False, 'cloud_mutated': False,
              'raw_source_provider_payloads_or_credentials_recorded': False}
    try:
        response = call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT / SQL),'--output-format','json'])
        assert response.returncode == 0 and len(response.stdout.encode()) <= 1024 * 1024
        rows = json.loads(response.stdout)['rows']; assert len(rows) == 1 and set(rows[0]) == {'restarted_specs'}
        value = rows[0]['restarted_specs']; job=value['job']; original=value['source']; provider=value['provider']; usage=provider['usage']; draft=value['draft']; previous=value['cancelled_predecessor']; outbox=value['outbox']
        checks = {'exact_completed_job': value['query_role']=='postgres' and value['database']=='postgres' and value['target_count']==1
             and job['job_id']==JOB and job['status']=='succeeded' and job['stage']=='apply_specs',
          'three_real_stages': job['stage_attempts']=={stage:1 for stage in STAGES} and job['attempt']==3
             and sorted(row['stage'] for row in job['completed_stages'])==sorted(STAGES),
          'all_three_dispatches_delivered': len(outbox)==3 and {row['stage'] for row in outbox}==set(STAGES)
             and all(row['status']=='delivered' and row['input_hash_matches'] and row['attempt_count']==1 for row in outbox)
             and isinstance(job['last_n8n_execution_id'],str) and bool(job['last_n8n_execution_id']),
          'exact_retained_source': original['original_hash_verified'] and original['original_input_retained'] and original['no_manufactured_asset']
             and original['arabic_preserved'] and (original['matches_original_plus_label'] or original['matches_lf_normalized_original_plus_label']),
          'real_provider_metadata': provider['provider']=='openai' and provider['sdk_version']=='7.45.1' and provider['response_reference_present']
             and provider['frozen_model_matches'] and provider['input_hash_matches'] and all(type(usage[key]) is int and usage[key]>=0 for key in ('input_tokens','output_tokens','total_tokens')) and usage['total_tokens']>0,
          'new_origin_three_roles_five_slots': draft['current_job_is_target'] and draft['extraction_origin_is_target'] and draft['untouched_current_machine_facts']
             and draft['active_origins'] and draft['active_roles']==3 and draft['active_slots']==5,
          'old_three_roles_five_slots_archived_and_retained': draft['archived_roles']==3 and draft['archived_slots']==5
             and draft['original_roles_retained'] and draft['original_slots_retained'],
          'cancelled_predecessor_never_executed': previous['status']=='cancelled' and previous['attempt']==0 and previous['stage_attempts']=={}
             and previous['n8n_execution_id'] is None and previous['payloads']==0 and previous['outbox_attempts']==0 and previous['outbox_deliveries']==0}
        report.update(result='passed' if all(checks.values()) else 'failed', checks=checks, observed=value)
    except Exception:
        report['code']='RESTARTED_SPECS_METADATA_UNCONFIRMED'
    directory=ROOT/'tracking/evidence/m02/live-specs-restart';directory.mkdir(parents=True,exist_ok=True)
    file=directory/(stamp.replace(':','-').replace('.','-')+'-'+uuid.uuid4().hex[:8]+'-metadata.json')
    with file.open('x',encoding='utf-8') as handle:json.dump(report,handle,indent=2);handle.write('\n')
    print(json.dumps({'result':report['result'],'checks':report.get('checks',{}),'receipt':file.relative_to(ROOT).as_posix()}))
    return 0 if report['result']=='passed' else 1


if __name__=='__main__':
    try:sys.exit(main())
    except Exception:print('{"result":"unconfirmed","code":"RESTARTED_SPECS_METADATA_UNCONFIRMED"}');sys.exit(1)
