"""One fixed read-only proof after the operator observed Cancelled in the app."""
import datetime
import hashlib
import json
import sys
import uuid
from release_foundation import ROOT, TARGET, call

SQL = 'tools/sql/cancelled-specs-readback.sql'
SQL_SHA256 = '55f20c19fd682484dbd4e652d45799c62b5fbbece3ad22466ce78bba778f8982'
ORIGINAL = '3ba110dd-711c-4c7f-aa89-0f4578310543'
JOB = '64788c14-ffab-44a5-94e1-5b7e512979c1'


def main():
    assert len(sys.argv) == 1 and SQL_SHA256
    source = (ROOT / SQL).read_bytes(); assert hashlib.sha256(source).hexdigest() == SQL_SHA256
    assert (ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET
    stamp = datetime.datetime.now(datetime.timezone.utc).isoformat(); identifier = uuid.uuid4().hex[:8]
    report = {'observed_at': stamp, 'target': TARGET, 'result': 'unconfirmed', 'read_only': True, 'sql_sha256': SQL_SHA256,
              'scope': 'App-confirmed queued cancellation metadata; no source payloads or external provider ledger query.',
              'cloud_mutated': False, 'provider_called': False, 'raw_source_provider_payloads_or_credentials_recorded': False}
    try:
        value = call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT / SQL),'--output-format','json'])
        assert value.returncode == 0 and len(value.stdout.encode()) < 1024 * 1024
        rows = json.loads(value.stdout)['rows']; assert len(rows) == 1 and set(rows[0]) == {'cancelled_specs'}
        state = rows[0]['cancelled_specs']; job = state['job']; old = state['original']; draft = state['draft']; outbox = state['outbox']
        checks = {'exact_target': state['query_role'] == 'postgres' and state['database'] == 'postgres' and state['target_count'] == 1 and job['id'] == JOB,
          'cancelled_before_any_stage': job['status'] == 'cancelled' and job['cancel_requested'] and job['attempt'] == 0 and job['stage_attempts'] == {}
            and job['n8n_execution_id'] is None and job['completed_stage_count'] == 0 and job['result_is_null'],
          'no_stage_or_provider_payload': state['stage_event_count'] == 0 and state['provider_or_preparation_payload_count'] == 0 and state['private_file_preparation_count'] == 0,
          'no_outbox_sent': len(outbox) == 1 and outbox[0]['stage'] == 'prepare_document' and outbox[0]['status'] in ('pending','dead')
            and outbox[0]['attempt_count'] == 0 and not outbox[0]['delivered'] and not outbox[0]['leased'],
          'original_source_retained': old['job_id'] == ORIGINAL and old['status'] == 'succeeded' and old['immutable_rows'] == 1 and old['original_hash_verified'],
          'original_three_roles_five_slots_untouched': draft['active_role_count'] == 3 and draft['active_slot_count'] == 5
            and draft['archived_role_count'] == 0 and draft['archived_slot_count'] == 0 and draft['extraction_origin_job_id'] == ORIGINAL
            and draft['original_extraction_matches'] and draft['untouched_machine_facts']
            and len(draft['role_origins']) == 3 and all(row['source_job_id'] == ORIGINAL and row['row_version'] == 1
              and row['source_role_matches'] and row['slot_versions_unchanged'] for row in draft['role_origins'])}
        report.update(result='passed' if all(checks.values()) else 'failed', checks=checks, observed=state)
    except Exception:
        report['code'] = 'CANCELLED_SPECS_METADATA_UNCONFIRMED'
    directory = ROOT / 'tracking/evidence/m02/live-specs-cancellation'; directory.mkdir(parents=True, exist_ok=True)
    file = directory / (stamp.replace(':','-').replace('.','-') + '-' + identifier + '-metadata.json')
    with file.open('x', encoding='utf-8') as output: json.dump(report, output, indent=2); output.write('\n')
    print(json.dumps({'result': report['result'], 'checks': report.get('checks',{}), 'receipt': file.relative_to(ROOT).as_posix()}))
    return 0 if report['result'] == 'passed' else 1


if __name__ == '__main__':
    try: sys.exit(main())
    except Exception:
        print('{"result":"unconfirmed","code":"CANCELLED_SPECS_METADATA_UNCONFIRMED"}'); sys.exit(1)
