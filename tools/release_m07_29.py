"""Fixed28->29 release boundary. Importing is inert; root owns any execution.

No target/SQL/credential/seed/reset/force/retry argument. A protected exclusive
claim precedes one push. Unknown outcomes use independent readback only.
"""
import copy
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tomllib
import uuid
from release_foundation import ROOT, TARGET, call as cli_call

CONFIG = 'development/m07/db/release29-reviewed.json'
CONFIG_SHA = '4d348d7a9efa85649df27bc478aa40283fa49b92b1b628a1bc261ca5a5098254'
PROFILE_REVIEW = 'development/m07/db/release29-original-profile-review.json'
PROFILE_REVIEW_SHA = '4486d6b5f5ca363511d68790e58f3fcdce9433e1a388b298810a2d3db0b66779'
PRIVATE = ROOT / '.local/cloud-m07-29'
EVIDENCE = ROOT / 'tracking/evidence/cloud-m07-29'
CLAIM = PRIVATE / 'apply.claim.json'
QUIESCENCE = PRIVATE / 'quiesced.json'
HASH = re.compile(r'[a-f0-9]{64}')
MIGRATION_PATTERN = re.compile(r'\d{14}_m07_settings_delegated_session\.sql')
OLD_OPERATIONS = {
 'eps.claim_job_outbox(integer)', 'eps.finish_job_outbox(uuid,text,boolean)',
 'eps.claim_job_stage(jsonb)', 'eps.claim_job_stage_replay(jsonb,text,text,text)',
 'eps.get_specs_stage_input(uuid,uuid,text)', 'eps.record_job_event(jsonb)',
 'eps.recover_job_stages(integer)', 'eps.get_job_asset_access(jsonb)',
 'eps.reserve_job_output(jsonb)', 'eps.complete_job_output(jsonb)',
 'eps.store_specs_preparation(jsonb)', 'eps.mint_review_media_grant(jsonb)',
}
CHANGED_KEYS = {
 'functions|eps.has_capability(text)|source_sha256',
 'functions|public.eps_create_presentation_series(jsonb,text)|source_sha256',
 'functions|public.eps_get_capabilities()|source_sha256', 'schemas|eps|acl', 'schemas|public|acl',
 'tables|eps.audit_events|acl', 'tables|eps.idempotency_records|acl',
 *{'columns|auth.sessions.' + name + '|acl' for name in ('id','user_id','oauth_client_id','not_after','scopes')},
 *{'columns|eps.' + name + '|acl' for name in (
   'candidate_asset_config.id','candidate_asset_config.transcription_model','candidate_asset_config.extraction_model',
   'presentation_templates.key','presentation_templates.version','presentation_templates.registered',
   'review_processing_config.id','review_processing_config.model','specs_pipeline_config.id','specs_pipeline_config.model_version')},
 *{'functions|eps.' + name + '|acl' for name in (
   'check_input(jsonb,text[])','expected_version(jsonb,text)','fail(text,text,integer,bigint)',
   'finish_mutation(text,text,jsonb,jsonb,uuid)','has_capability(text)','idempotency_begin(text,text,jsonb)','require_capability(text)')},
}

class Blocked(Exception):
    def __init__(self): super().__init__('M07_FIXED29_RELEASE_UNCONFIRMED')

def require(value):
    if not value: raise Blocked()

def sha(value): return hashlib.sha256(value).hexdigest()
def canonical(value): return sha(json.dumps(value,sort_keys=True,separators=(',',':')).encode())
def stamp(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def read_json(file): return json.loads((ROOT / file).read_bytes())

def sealed(file,digest):
    require(type(file) is str and type(digest) is str and HASH.fullmatch(digest))
    require(not Path(file).is_absolute() and '..' not in Path(file).parts)
    path = ROOT / file
    require(path.resolve() == path and not path.is_symlink() and sha(path.read_bytes()) == digest)

def sealed_item(item):
    require(type(item) is dict and set(item) == {'path','sha256'})
    sealed(item['path'],item['sha256']); return read_json(item['path'])

def sealed_sources(value):
    require(type(value) is dict and len(value) > 0)
    for file,digest in value.items(): sealed(file,digest)

def validate_profile_delta(frozen,current):
    """Accept exactly the observed pre-existing PUBLIC USAGE pair, in raw order."""
    validate_delta(frozen); validate_delta(current)
    expected = copy.deepcopy(frozen)
    for side in ('before','after'):
        acl = frozen['changed']['schemas|public|acl'][side]
        prefix = '{pg_database_owner=UC/pg_database_owner,'
        require(acl.startswith(prefix) and not acl.startswith(prefix + '=U/pg_database_owner,'))
        expected['changed']['schemas|public|acl'][side] = prefix + '=U/pg_database_owner,' + acl[len(prefix):]
    require(current == expected)

def load_original_profile(plan,review_item):
    require(review_item == {'path':PROFILE_REVIEW,'sha256':PROFILE_REVIEW_SHA})
    review = sealed_item(review_item); sealed_sources(review['source_seals'])
    require(review['schema_version'] == '1.0')
    require(review['original_plan'] == {'path':'development/m07/db/release29-plan.json','sha256':sha((ROOT/'development/m07/db/release29-plan.json').read_bytes())})
    require(sealed_item(review['original_plan']) == plan)
    profile = sealed_item(review['original_profile']); sealed_sources(profile['source_seals'])
    require(profile['schema_version'] == '1.0' and profile['plan'] == review['original_plan']['path'] and profile['plan_sha256'] == review['original_plan']['sha256'])
    for field,hash_field in (('migration_path','migration_sha256'),('readback_query','readback_sha256')):
        require(profile[field] == plan[field] and profile[hash_field] == plan[hash_field])
        sealed(profile[field],profile[hash_field])
    require(review['migration_path'] == plan['migration_path'] and review['migration_sha256'] == plan['migration_sha256'])
    require(profile['original_clone_proof'] == plan['proof'] and profile['original_clone_proof_sha256'] == plan['proof_sha256'])
    sealed(profile['original_clone_proof'],profile['original_clone_proof_sha256'])
    sealed(profile['catalog_delta'],profile['catalog_delta_sha256']); delta = read_json(profile['catalog_delta'])
    sealed(plan['catalog_delta'],plan['catalog_delta_sha256']); validate_profile_delta(read_json(plan['catalog_delta']),delta)
    rehearsal = sealed_item(profile['rehearsal']); sealed_sources(rehearsal['source_seals'])
    require(rehearsal['result'] == 'passed' and rehearsal['cloud_called'] is False and rehearsal['provider_called'] is False)
    for flag in ('exact_frozen_clone_reconstructed','full_original_baseline_profile_matched','candidate_rollback_verified','original_public_usage_exactly_preserved','owned_clone_removed','original28_and_empty_auth_subset_unchanged','original_role_oids_and_attributes_unchanged','shared_lock_released','all_sources_unchanged'):
        require(rehearsal[flag] is True)
    require(rehearsal['original_database_writes'] is False and rehearsal['promotion_retry'] is False and rehearsal['owned_system_identifier'] == '7701520506262638626')
    require(rehearsal['migration'] == plan['migration_path'] and rehearsal['migration_sha256'] == plan['migration_sha256'])
    before = sealed_item(rehearsal['full_before_catalogue']); after = sealed_item(rehearsal['full_after_catalogue'])
    require(len(before) == 16103 and len(after) == 16430)
    require(profile['before'] == rehearsal['before'] and profile['expected_after'] == rehearsal['expected_after'])
    require(profile['before']['old_data'] == profile['expected_after']['old_data'] and len(profile['before']['old_data']['versions']) == 28)
    require(profile['before']['catalog_protected_sha256'] == profile['expected_after']['catalog_protected_sha256'])
    require({key:value for key,value in after.items() if key not in before} == delta['created'])
    require({key:{'before':value,'after':after[key]} for key,value in before.items() if key in after and after[key] != value} == delta['changed'])
    require({key:value for key,value in before.items() if key not in after} == delta['deleted'] == {})
    require(profile['before']['catalog_delta_values'] == {key:value['before'] for key,value in delta['changed'].items()})
    require(profile['expected_after']['catalog_delta_values'] == {**delta['created'],**{key:value['after'] for key,value in delta['changed'].items()}})
    sealed(profile['reconciliation'],profile['reconciliation_sha256']); reconciliation = read_json(profile['reconciliation'])
    sealed_sources(reconciliation['source_seals'])
    require(reconciliation['result'] == 'passed' and reconciliation['original_database_writes'] is False)
    for field in ('actual_catalogue','clone_catalogue'):
        item = reconciliation[field]; sealed(item['file'],item['sha256']); require(item['fields'] == 16103)
    actual = read_json(reconciliation['actual_catalogue']['file']); clone = read_json(reconciliation['clone_catalogue']['file'])
    require(before == actual and set(actual) == set(clone))
    differences = {item['key']:{'actual':item['actual'],'clone':item['clone']} for item in reconciliation['differences']}
    require(len(differences) == 6 and differences == {key:{'actual':value,'clone':clone[key]} for key,value in actual.items() if value != clone[key]})
    checks = sealed_item(review['checks'])
    require(checks['result'] == 'passed' and checks['cloud_called'] is False and checks['provider_called'] is False)
    require(checks['tests']['passed'] == 6 and checks['tests']['failed'] == 0 and checks['tests']['exit_code'] == checks['syntax']['exit_code'] == 0)
    return profile

def validate_local_promotion(promotion,profile,plan):
    require(promotion['result'] == 'passed' and promotion['action'] == 'promote')
    for flag in ('cloud_called','provider_called','credentials_loaded','automatic_retry','lock_retained'):
        require(promotion[flag] is False)
    for flag in ('dispatch_attempted','exact_proven_catalog_delta','old_business_auth_and_config_preserved','sources_stable'):
        require(promotion[flag] is True)
    require(promotion['comparison_profile'] == {'path':'development/m07/db/release29-original-profile.json','sha256':'681fe120fea3ee70e35bd2c4ab4734e2b95e89e40ceef5a678f857adfa673cc2'})
    require(promotion['plan_sha256'] == profile['plan_sha256'] and promotion['system_identifier'] == '7701520506262638626')
    rehearsal = read_json(profile['rehearsal']['path'])
    require(promotion['existing_role_oids'] == rehearsal['existing_role_oids']['roles'])
    review = read_json(PROFILE_REVIEW)
    required_sources = {file:review['source_seals'][file] for file in ('tools/promote-m07-local29-current.mjs','tools/m07-original-profile29-comparison.mjs','development/m07/db/release29-original-profile.json','development/m07/db/release29-original-profile-delta.json')}
    require(all(promotion['source_seals'].get(file) == digest for file,digest in required_sources.items()))
    sealed_sources(promotion['source_seals'])
    expected = copy.deepcopy(profile['expected_after']); expected['old_data']['versions'].append(plan['version'])
    require(promotion['before'] == profile['before'] and promotion['after'] == expected)
    applied = copy.deepcopy(promotion['promotion']); receipt = applied.pop('receipt')
    require(type(receipt) is str and re.fullmatch(r'development/local-db/receipts/[A-Za-z0-9_.-]+-replay\.json',receipt))
    require(read_json(receipt) == applied and applied['file'] == plan['migration_path'] and applied['sha256'] == plan['migration_sha256'] and applied['result'] == 'applied')

def validate_process_scope(environment):
    forbidden = {'SUPABASE_PROJECT_ID','SUPABASE_API_URL','SUPABASE_WORKDIR','SUPABASE_DB_URL',
      'PGHOST','PGHOSTADDR','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGSERVICE','PGSERVICEFILE',
      'PGOPTIONS','PGSSLMODE','PGSSLROOTCERT','PGSSLCERT','PGSSLKEY','PGSSLNEGOTIATION'}
    require(not any(environment.get(name) for name in forbidden))

def validate_delta(delta):
    require(type(delta) is dict and set(delta) == {'schema_version','created','changed','deleted','new_state'})
    require(delta['schema_version'] == '1.0' and delta['deleted'] == {} and set(delta['changed']) == CHANGED_KEYS)
    created = delta['created']
    require(type(created) is dict and len(created) > 100)
    for table in ('eps.app_settings','eps.mcp_oauth_resources'):
        require(created['tables|' + table + '|owner'] == 'postgres')
        require(created['tables|' + table + '|rls'] is True and created['tables|' + table + '|force_rls'] is True)
    for role in ('eps_settings_owner','eps_mcp_session_owner'):
        for flag in ('login','super','bypassrls','create_role','create_db','replication'):
            require(created['roles|' + role + '|' + flag] is False)
    base = 'policies|auth.sessions.eps_mcp_own_session|'
    require(created[base+'roles'] == ['eps_mcp_session_owner'] and created[base+'cmd'] == 'SELECT')
    require('user_id' in created[base+'qual'] and 'mcp_claim_uuid' in created[base+'qual'])
    require(not any('auth.oauth_' in key or 'auth.sessions' in key and not key.startswith(base)
      for key in created))
    for key,value in created.items():
        if key.startswith('functions|') and key.endswith('|acl'):
            require(type(value) is str and re.search(r'(?:\{|,)=',value) is None)
            require(not any(name in value for name in ('anon=','service_role=')))
    require(delta['new_state']['app_settings'] == {'count':1,'settings':[{'template_version':'1.1.0','default_timezone':'Africa/Cairo','default_review_expiry_days':30,'row_version':1,'identity_present':True}]})
    require(delta['new_state']['mcp_oauth_resources'] == {'count':0,'enabled_count':0})
    return set(created) | CHANGED_KEYS

def validate_before_state(state,delta,versions):
    require(state['query_role'] == 'postgres' and state['database'] == 'postgres' and state['unrestricted_visibility'] is True)
    require(len(versions) == 29 and state['old_data']['versions'] == versions[:-1])
    require(state['new_state']['app_settings'] is None and state['new_state']['mcp_oauth_resources'] is None)
    require(state['catalog_delta_values'] == {key:value['before'] for key,value in delta['changed'].items()})
    require(set(value.replace(' ','') for value in state['runtime']['execute']) == OLD_OPERATIONS)
    require(state['protected_m02'] == {'exists':True,'manual_note_retained':True})

def compare_states(before,after,delta,version):
    expected = copy.deepcopy(before['old_data']); expected['versions'].append(version)
    require(after['old_data'] == expected)
    require(after['catalog_protected_sha256'] == before['catalog_protected_sha256'])
    require(after['catalog_count'] == before['catalog_count'] + len(delta['created']))
    require(before['catalog_delta_values'] == {key:value['before'] for key,value in delta['changed'].items()})
    require(after['catalog_delta_values'] == {**delta['created'],**{key:value['after'] for key,value in delta['changed'].items()}})
    require(after['new_state']['prior'] == before['new_state']['prior'])
    require(after['new_state']['app_settings'] == delta['new_state']['app_settings'])
    require(after['new_state']['mcp_oauth_resources'] == {'count':0,'enabled_count':0})
    require(before['runtime'] == after['runtime'] and before['protected_m02'] == after['protected_m02'])
    require(before['active_jobs'] == after['active_jobs'] == 0 and before['leased_outbox'] == after['leased_outbox'] == 0)
    return {'old_business_ready_versions_media_metadata_and_auth_counts_preserved':True,
      'exact_reviewed_catalogue_delta_only':True,'settings_defaults_created_once_and_oauth_allowlist_empty':True,
      'old_configuration_key_metadata_and_runtime12_preserved':True,'no_oauth_client_hook_user_identity_or_historical_snapshot_mutation':True}

def current_release_inputs():
    validate_process_scope(os.environ); sealed(CONFIG,CONFIG_SHA); config = read_json(CONFIG)
    return validate_release_config(config)

def validate_release_config(config):
    """File-only validation is shared with the source-only freezer; no CLI call."""
    require(set(config) == {'schema_version','plan','reviewed_manifest','promotion','local_auth_prerequisite','original_profile_review','source_seals'})
    require(config['schema_version'] == '1.0' and type(config['source_seals']) is dict)
    for item in (config['plan'],config['reviewed_manifest'],config['promotion'],config['local_auth_prerequisite']):
        require(set(item) == {'path','sha256'}); sealed(item['path'],item['sha256'])
    for file,digest in config['source_seals'].items(): sealed(file,digest)
    plan = read_json(config['plan']['path']); migration = Path(plan['migration_path']).name
    require(MIGRATION_PATTERN.fullmatch(migration) and plan['migration_path'] == 'supabase/migrations/' + migration)
    require(plan['version'] == migration[:14]); sealed(plan['migration_path'],plan['migration_sha256'])
    for file,digest in plan['source_seals'].items(): sealed(file,digest)
    for field,hash_field in (('proof','proof_sha256'),('baseline','baseline_sha256'),('catalog_delta','catalog_delta_sha256'),('readback_query','readback_sha256')):
        sealed(plan[field],plan[hash_field])
    require(config['reviewed_manifest']['path'] == 'development/local-db/reviewed.json')
    manifest = read_json(config['reviewed_manifest']['path']); baseline = read_json(plan['baseline'])
    require(len(manifest['migrations']) == 29 and len(baseline['migrations']) == 28 and manifest['migrations'][:-1] == baseline['migrations'])
    require(manifest['migrations'][-1]['path'] == plan['migration_path'] and manifest['migrations'][-1]['sha256'] == plan['migration_sha256'])
    names = sorted(path.name for path in (ROOT/'supabase/migrations').glob('*.sql'))
    require(names == [Path(row['path']).name for row in manifest['migrations']])
    for row in manifest['migrations']: require(row['reviewed_by'] and row['reviewed_at']); sealed(row['path'],row['sha256'])
    proof = read_json(plan['proof']); promotion = read_json(config['promotion']['path']); auth = read_json(config['local_auth_prerequisite']['path'])
    for item in (proof,promotion,auth): require(item['result'] == 'passed' and item['cloud_called'] is False and item['provider_called'] is False)
    for flag in ('exact_composed_candidate_rehearsed','compact_readback_exact','pure_candidate_rollback_verified','old_business_auth_and_config_preserved','sources_unchanged','saved_default_capabilities_and_ready_preservation_passed','real_role_own_session_and_direct_delegation_proofs_passed','concurrent_same_revision_single_winner','concurrent_idempotent_replay_once','revocation_during_observed_advisory_wait_denied_cached_response'):
        require(proof[flag] is True)
    profile = load_original_profile(plan,config['original_profile_review'])
    validate_local_promotion(promotion,profile,plan)
    require(promotion['promotion']['receipt'] in config['source_seals'])
    require(auth['action'] == 'auth-prerequisite' and auth['established28_data_catalog_keys_and_roles_preserved'] and auth['empty_synthetic_auth_subset']['count'] == 0 and auth['lock_retained'] is False)
    require((ROOT/'supabase/.temp/project-ref').read_text().strip() == TARGET)
    settings = tomllib.loads((ROOT/'supabase/config.toml').read_text()); require(settings['db']['migrations']['enabled'] is True and settings['db']['seed']['enabled'] is False)
    admission = 'development/m07/db/release29-admission.sql'; require(admission in config['source_seals'])
    delta = read_json(profile['catalog_delta']); validate_delta(delta)
    return {'migration':migration,'migration_sha256':plan['migration_sha256'],'version':plan['version'],
      'versions':[name[:14] for name in names],'readback':plan['readback_query'],'readback_sha256':plan['readback_sha256'],
      'admission':admission,'admission_sha256':config['source_seals'][admission],
      'delta':profile['catalog_delta'],'delta_sha256':profile['catalog_delta_sha256'],
      'original_profile_review':config['original_profile_review'],'local_promotion':config['promotion'],
      'config_sha256':CONFIG_SHA,'source_seals':config['source_seals'],'helper_sha256':sha(Path(__file__).read_bytes())}

def private_write(file,data):
    from provision_logo_verifier import WindowsPrivateFiles
    PRIVATE.mkdir(parents=True,exist_ok=True); security = WindowsPrivateFiles()
    with security.create(file) as handle:
        handle.write(data); handle.flush(); os.fsync(handle.fileno()); security.verify_open(handle)

def call(arguments):
    label = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%f')+'-'+uuid.uuid4().hex[:8]
    try: result = cli_call(arguments)
    except subprocess.TimeoutExpired as error:
        for stream in ('stdout','stderr'):
            value = getattr(error,stream,None) or b''; private_write(PRIVATE/(label+'.'+stream),value.encode() if type(value) is str else value)
        raise Blocked() from None
    for stream in ('stdout','stderr'): private_write(PRIVATE/(label+'.'+stream),getattr(result,stream).encode())
    require(len(result.stdout.encode()) <= 3*1024*1024 and len(result.stderr.encode()) <= 1024*1024)
    return result

def _query(file,digest):
    sealed(file,digest); result = call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT/file),'--output-format','json'])
    require(result.returncode == 0); values = json.loads(result.stdout)['rows']; require(len(values) == 1 and len(values[0]) == 1)
    state = next(iter(values[0].values())); require(type(state) is dict); return state

def inspect_state(inputs):
    state = _query(inputs['readback'],inputs['readback_sha256']); admission = _query(inputs['admission'],inputs['admission_sha256'])
    require(state['query_role'] == admission['query_role'] == 'postgres' and state['database'] == admission['database'] == 'postgres')
    require(state['unrestricted_visibility'] is True and admission['unrestricted_visibility'] is True)
    require(state['old_data']['versions'] in (inputs['versions'][:-1],inputs['versions']))
    require(admission['protected_m02'] == {'exists':True,'manual_note_retained':True})
    runtime = admission['runtime']; require(runtime['name'] == 'eps_specs_runtime' and runtime['login'] is True and runtime['inherit'] is False and runtime['superuser'] is False and runtime['bypass_rls'] is False and runtime['create_db'] is False and runtime['create_role'] is False and runtime['replication'] is False)
    require(set(value.replace(' ','') for value in runtime['execute']) == OLD_OPERATIONS)
    return {**state,'runtime':runtime,'protected_m02':admission['protected_m02'],'active_jobs':admission['active_jobs'],'leased_outbox':admission['leased_outbox']}

def validate_quiescence(inputs,state):
    require(state['active_jobs'] == 0 and state['leased_outbox'] == 0)
    evidence = json.loads(QUIESCENCE.read_bytes()); age = (datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(evidence['observed_at'])).total_seconds()
    require(evidence['target'] == TARGET and evidence['migration_sha256'] == inputs['migration_sha256'] and 0 <= age <= 900)
    require(evidence['owned_processes_verified'] is True and evidence['web_stopped'] is True and evidence['worker_stopped'] is True)
    file = evidence['ownership_evidence']
    require(type(file) is str and file.startswith('.local/') and '..' not in Path(file).parts)
    path = ROOT / file; require(path.is_file() and not path.is_symlink() and path.resolve() == path)
    verify_owned_processes_absent(evidence['owned_pids'])

def verify_owned_processes_absent(pids):
    """Read only: never stop a process or inspect command lines/environment."""
    require(os.name == 'nt' and type(pids) is list and 1 <= len(pids) <= 32)
    require(all(type(pid) is int and 1 <= pid <= 2**31-1 for pid in pids) and len(set(pids)) == len(pids))
    script = "$ErrorActionPreference='Stop';$ids=ConvertFrom-Json $env:EPS_M07_OWNED_PIDS;foreach($id in $ids){if(Get-Process -Id ([int]$id) -ErrorAction SilentlyContinue){throw 'M07_OWNED_PROCESS_STILL_PRESENT'}};Write-Output 'M07_OWNED_PROCESSES_ABSENT'"
    environment = dict(os.environ); environment['EPS_M07_OWNED_PIDS'] = json.dumps(pids)
    result = subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-Command',script],capture_output=True,text=True,encoding='utf8',errors='replace',timeout=15,env=environment)
    require(result.returncode == 0 and result.stdout.strip() == 'M07_OWNED_PROCESSES_ABSENT' and len(result.stderr) <= 1024)

def pending_migrations(value): return sorted(set(re.findall(r'\d{14}_[A-Za-z0-9_]+\.sql',value)))
def validate_pending(value,migration): require(pending_migrations(value) == [migration])
def push_command(dry_run): return ['db','push','--linked','--project-ref',TARGET,'--skip-vault','--yes','--output-format','json'] + (['--dry-run'] if dry_run else [])
def refuse_repeat_apply(): require(not CLAIM.exists() and not any(EVIDENCE.glob('*-apply-attempt.json')))

def retain(receipt,suffix):
    EVIDENCE.mkdir(parents=True,exist_ok=True); file = EVIDENCE/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+uuid.uuid4().hex[:8]+'-'+suffix+'.json')
    with file.open('x',encoding='utf8') as handle: json.dump(receipt,handle,indent=2); handle.write('\n'); handle.flush(); os.fsync(handle.fileno())
    return file.relative_to(ROOT).as_posix()

def main(arguments=None):
    arguments = sys.argv[1:] if arguments is None else arguments; require(len(arguments) <= 1); action = arguments[0] if arguments else 'dry-run'; require(action in ('inspect','dry-run','apply','readback'))
    receipt = {'action':action,'target':TARGET,'result':'failed','dispatch_attempted':False,'automatic_retry':False,'provider_called':False,'flags_changed':False,'key_or_credential_read_or_hashed':False,'oauth_provider_or_client_or_hook_changed':False,'identity_provisioned':False,'seeds':False,'hosting_deferred':True}
    try:
        inputs = current_release_inputs(); receipt['inputs'] = inputs; delta = read_json(inputs['delta']); before = inspect_state(inputs); receipt['before'] = before
        if action == 'inspect': receipt['readback'] = before
        elif action == 'readback':
            require(before['old_data']['versions'] == inputs['versions']); claim = read_json(CLAIM.relative_to(ROOT).as_posix())
            require(claim['target'] == TARGET and claim['inputs_sha256'] == canonical(inputs)); attempt_file = claim['attempt_receipt']
            require(type(attempt_file) is str and re.fullmatch(r'tracking/evidence/cloud-m07-29/[A-Za-z0-9_.-]+-apply-attempt\.json',attempt_file))
            attempt = read_json(attempt_file); require(canonical(attempt['before']) == claim['before_sha256'])
            receipt['before'] = attempt['before']; receipt['readback'] = before; receipt['comparison'] = compare_states(attempt['before'],before,delta,inputs['version'])
        else:
            require(before['old_data']['versions'] == inputs['versions'][:-1]); validate_before_state(before,delta,inputs['versions'])
            if action == 'apply':
                refuse_repeat_apply(); validate_quiescence(inputs,before); dry = read_json('tracking/evidence/cloud-m07-29/dry-run.json'); age = (datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(dry['finished_at'])).total_seconds()
                require(dry['result'] == 'passed' and dry['inputs'] == inputs and dry['before'] == before and dry['pending_migrations'] == [inputs['migration']] and 0 <= age <= 900)
            receipt['attempt_receipt'] = retain(receipt,action+'-attempt')
            if action == 'apply': private_write(CLAIM,(json.dumps({'target':TARGET,'inputs_sha256':canonical(inputs),'before_sha256':canonical(before),'attempt_receipt':receipt['attempt_receipt'],'dispatch_may_have_occurred':True})+'\n').encode())
            require(current_release_inputs() == inputs)
            if action == 'apply': receipt['dispatch_attempted'] = True
            result = call(push_command(action == 'dry-run')); receipt['exit_code'] = result.returncode; receipt['pending_migrations'] = pending_migrations(result.stdout+'\n'+result.stderr); after = inspect_state(inputs); receipt['readback'] = after
            if action == 'apply': receipt['comparison'] = compare_states(before,after,delta,inputs['version'])
            else: require(before == after)
            require(result.returncode == 0); validate_pending(result.stdout+'\n'+result.stderr,inputs['migration'])
        receipt['application_verified_by_readback'] = action in ('apply','readback'); receipt['result'] = 'passed'
    except Exception:
        receipt['reason'] = 'Fixed29 release unconfirmed. Preserve claim and reconcile read-only; no repeat write.'; raise
    finally:
        receipt['finished_at'] = stamp(); file = retain(receipt,action)
        if action == 'dry-run' and receipt['result'] == 'passed':
            temporary = EVIDENCE/('dry-'+uuid.uuid4().hex+'.tmp'); temporary.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8'); os.replace(temporary,EVIDENCE/'dry-run.json')
        print(json.dumps({'result':receipt['result'],'receipt':file,'application_verified_by_readback':receipt.get('application_verified_by_readback',False),'automatic_retry':False}))

if __name__ == '__main__':
    try: main()
    except Exception: sys.stderr.write('Fixed29 release stopped; raw diagnostics remain private. No automatic retry.\n'); sys.exit(1)
