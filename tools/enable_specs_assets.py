"""One fixed role/flag transition. Importing performs no IO or cloud action.

No credentials, verifier bytes, source, identities or arbitrary SQL are accepted.
An interrupted/unknown dispatch is never automatically retried or rolled back
by a second mutation. A separate inspect action can observe current metadata.
"""
import datetime
import hashlib
import json
import os
import re
import sys
import uuid
from release_foundation import ROOT, TARGET, call
from provision_logo_verifier import WindowsPrivateFiles

SQL = 'tools/sql/enable-specs-assets.sql'
INSPECT = 'tools/sql/inspect-specs-assets-runtime.sql'
OPERATIONS = 'tools/sql/inspect-specs-operations.sql'
SOURCE_SHA256 = {'tools/sql/enable-specs-assets.sql': '750f6eb7270862fa7eddd758eec735531dfa631bf919c508f0055d18811bcda5', 'tools/sql/inspect-specs-assets-runtime.sql': '293c670bae7ab2ab29230affd51f28dc90f4b4dbed0e86219789ff1f557c4511', 'tools/sql/inspect-specs-operations.sql': 'b39f434c647b64724fcec7eefe0ae708e080b1d513b1be90e8a8e549465769ea'}
CLOUD_PROOF = 'tracking/evidence/cloud-specs-assets/2026-10-29T00-58-48-399742Z-cf9b507d-readback.json'
CLOUD_SHA256 = 'e239f91b8806a48e2a22f7072094251c0681fd138f7e7aa9b63ac96e4cebec5b'
KEY_PROOF = 'tracking/evidence/m02/specs-verifier/2026-10-29T00-59-55.618318Z-a5f8b2d2-92d2-47bb-a97c-d6248cf4c3ce-provision.json'
KEY_SHA256 = '1f3d7ceb5407d65e05c2bea4cfd6b681c34f86150192160c0934d990dd906942'
KEY_CLAIM = 'a5f8b2d2-92d2-47bb-a97c-d6248cf4c3ce'
KEY_ID = 'eps-specs-dev-20261029-v1'
PHASE_FILE = ROOT / '.local/specs-assets-verifier/phase.json'
SECRET_FILE = ROOT / '.local/specs-assets-verifier/verifier.json'
JOURNAL = ROOT / '.local/specs-assets-activation/activation.json'
EVIDENCE = ROOT / 'tracking/evidence/m02/specs-assets-activation'
VERSIONS = ['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702',
            '20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941']
SETTINGS = sorted(['log_statement=none','log_parameter_max_length=0','log_parameter_max_length_on_error=0','log_min_error_statement=panic',
                   'log_min_duration_statement=-1','auto_explain.log_min_duration=-1','auto_explain.log_parameter_max_length=0',
                   'auto_explain.log_nested_statements=false','pg_stat_statements.track=none'])
BASE_FUNCTIONS = ['eps.claim_job_outbox(integer)','eps.finish_job_outbox(uuid, text, boolean)','eps.claim_job_stage(jsonb)',
                  'eps.get_specs_stage_input(uuid, uuid, text)','eps.record_job_event(jsonb)','eps.recover_job_stages(integer)']
FILE_FUNCTIONS = ['eps.get_job_asset_access(jsonb)','eps.reserve_job_output(jsonb)','eps.complete_job_output(jsonb)','eps.store_specs_preparation(jsonb)']


class ActivationBlocked(Exception):
    pass


def require(value):
    if not value:
        raise ActivationBlocked('SPECS_ASSET_ACTIVATION_UNCONFIRMED')


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def parse(data, limit=2 * 1024 * 1024):
    require(isinstance(data, bytes) and 0 < len(data) <= limit)
    def pairs(entries):
        value = {}
        for key, entry in entries:
            require(key not in value)
            value[key] = entry
        return value
    try:
        return json.loads(data.decode('utf-8'), object_pairs_hook=pairs)
    except Exception:
        raise ActivationBlocked('SPECS_ASSET_ACTIVATION_UNCONFIRMED') from None


def source_checks():
    require((ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET)
    require(set(SOURCE_SHA256) == {SQL, INSPECT, OPERATIONS})
    for name, expected in SOURCE_SHA256.items():
        require(re.fullmatch(r'[a-f0-9]{64}', expected) and sha((ROOT / name).read_bytes()) == expected)


def prerequisites(security):
    source_checks()
    cloud_bytes = (ROOT / CLOUD_PROOF).read_bytes()
    require(sha(cloud_bytes) == CLOUD_SHA256)
    cloud = parse(cloud_bytes)
    require(cloud.get('target') == TARGET and cloud.get('result') == 'passed' and cloud.get('action') == 'readback'
            and cloud.get('application_verified_by_readback') is True and cloud.get('application_status') == 'verified_applied'
            and cloud['readback']['versions'] == VERSIONS)
    config = cloud['readback']['assets']['config']
    require(config == {'id': 1, 'uploads_enabled': False, 'capabilities_enabled': False, 'file_pipeline_enabled': False})
    key_bytes = (ROOT / KEY_PROOF).read_bytes()
    require(sha(key_bytes) == KEY_SHA256)
    key = parse(key_bytes)
    require(key.get('target') == TARGET and key.get('key_id') == KEY_ID and key.get('action') == 'provision'
            and key.get('result') == 'passed' and key.get('private_file_acl_verified') is True
            and key.get('database_flags_disabled') is True and key.get('secret_recorded') is False)
    security.verify(PHASE_FILE)
    with PHASE_FILE.open('rb') as handle:
        phase_bytes = handle.read(8193)
    phase = parse(phase_bytes, 8192)
    require(set(phase) == {'version','target','key_id','phase','claim_id','secret_file','created_at','completed_at','contains_secret'}
            and phase['version'] == 1 and phase['target'] == TARGET and phase['key_id'] == KEY_ID and phase['phase'] == 'completed'
            and phase['claim_id'] == KEY_CLAIM and phase['secret_file'] == '.local/specs-assets-verifier/verifier.json'
            and phase['contains_secret'] is False and phase['created_at'] == key['observed_at'])
    require(json.dumps(phase, ensure_ascii=False, indent=2).encode('utf-8') + b'\n' == phase_bytes)
    require(datetime.datetime.fromisoformat(phase['completed_at'].replace('Z', '+00:00')) >= datetime.datetime.fromisoformat(phase['created_at'].replace('Z', '+00:00')))
    security.verify(SECRET_FILE)  # ACL metadata only. Never read the key bytes.
    require(not JOURNAL.exists())


def query(file, field):
    require(file in SOURCE_SHA256 and sha((ROOT / file).read_bytes()) == SOURCE_SHA256[file])
    result = call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT / file),'--output-format','json'])
    require(result.returncode == 0)
    value = parse(result.stdout.encode('utf-8'))
    require(isinstance(value, dict) and isinstance(value.get('rows'), list) and len(value['rows']) == 1
            and isinstance(value['rows'][0], dict) and set(value['rows'][0]) == {field})
    return value['rows'][0][field]


def validate_state(state, enabled):
    require(isinstance(state, dict) and state['query_role'] == 'postgres' and state['database'] == 'postgres' and state['versions'] == VERSIONS)
    require(state['configuration_rows'] == 1 and state['configuration'] == {'id': 1,'uploads_enabled': enabled,'capabilities_enabled': enabled,'file_pipeline_enabled': enabled})
    require(state['verifier'] == {'count': 1, 'expected_active': True})
    runtime = state['runtime']
    require(isinstance(runtime, dict) and runtime['name'] == 'eps_specs_runtime' and runtime['login'] is True and runtime['connection_limit'] == 4
            and all(runtime[name] is False for name in ('inherit','superuser','bypass_rls','create_db','create_role','replication','auth_schema_usage','schema_create','table_authority','owned_objects')))
    expiry = datetime.datetime.fromisoformat(runtime['valid_until'].replace('Z', '+00:00'))
    require(expiry > datetime.datetime.now(datetime.timezone.utc))
    groups = {'eps_jobs_dispatcher','eps_jobs_executor'} | ({'eps_specs_assets_executor'} if enabled else set())
    require(len(runtime['parents']) == len(groups) and {row['name'] for row in runtime['parents']} == groups
            and all(row == {'name': row['name'],'grantor': 'postgres','admin': False,'inherit': True,'set': False} for row in runtime['parents']))
    require(runtime['incoming'] in ([], [{'name': 'postgres','grantor': 'supabase_admin','admin': True,'inherit': False,'set': False}]))
    require(runtime['settings'] == [{'database': '0','values': SETTINGS,'unknown_setting':False}]
            and sorted(runtime['execute']) == sorted(BASE_FUNCTIONS + (FILE_FUNCTIONS if enabled else [])))
    return True


def write_journal(security, handle, value):
    security.verify_open(handle)
    handle.seek(0); handle.write((json.dumps(value, indent=2) + '\n').encode('utf-8')); handle.truncate(); handle.flush(); os.fsync(handle.fileno())
    security.verify_open(handle)


def save(report):
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    file = EVIDENCE / (report['observed_at'].replace(':','-') + '-' + str(uuid.uuid4()) + '-' + report['action'] + '.json')
    with file.open('x', encoding='utf-8') as handle:
        json.dump(report, handle, indent=2); handle.write('\n')
    print(json.dumps(report))


def main():
    require(len(sys.argv) == 2 and sys.argv[1] in ('inspect','operations','enable'))
    action = sys.argv[1]; source_checks()
    report = {'observed_at': now(),'target': TARGET,'action': action,'result': 'unconfirmed','automatic_retry': False,
              'credentials_created': False,'secret_recorded': False,'worker_started': False,'business_facts_written': False}
    if action in ('inspect','operations'):
        value = query(INSPECT if action == 'inspect' else OPERATIONS, 'state' if action == 'inspect' else 'operations')
        report.update(result='passed', read_only=True, data=value); save(report); return 0
    security = WindowsPrivateFiles(); prerequisites(security)
    before = query(INSPECT, 'state'); validate_state(before, False)
    JOURNAL.parent.mkdir(parents=True, exist_ok=True)
    phase = {'version': 1,'phase': 'prepared','claim_id': str(uuid.uuid4()),'target': TARGET,'role': 'eps_specs_runtime','key_id': KEY_ID,
             'created_at': report['observed_at'],'completed_at': None,'contains_secret': False,'automatic_retry': False}
    with security.create(JOURNAL) as handle:
        write_journal(security, handle, phase)
        phase['phase'] = 'dispatching'; write_journal(security, handle, phase)
        try:
            value = query(SQL, 'enabled')
            require(value == {'role':'eps_specs_runtime','added_group':'eps_specs_assets_executor','inherit':True,'set':False,'admin':False,
                    'configuration':{'id':1,'uploads_enabled':True,'capabilities_enabled':True,'file_pipeline_enabled':True},
                    'key_id':KEY_ID,'credentials_created':False,'business_facts_written':False})
            after = query(INSPECT, 'state'); validate_state(after, True)
            phase.update(phase='completed', completed_at=now()); write_journal(security, handle, phase)
            report.update(result='passed', application_status='verified_enabled', read_only=False, configuration=after['configuration'],
                          runtime_groups=3, runtime_execute_operations=10, role_defaults=9, active_verifier_confirmed=True)
        except Exception:
            phase['phase'] = 'unconfirmed'; write_journal(security, handle, phase)
            report.update(code='SPECS_ASSET_ACTIVATION_UNCONFIRMED', application_status='unconfirmed', read_only=False)
    save(report); return 0 if report['result'] == 'passed' else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        print('{"result":"blocked","code":"SPECS_ASSET_ACTIVATION_UNCONFIRMED","automatic_retry":false}')
        sys.exit(1)
