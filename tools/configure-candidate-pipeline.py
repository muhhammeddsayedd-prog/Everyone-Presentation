"""Fixed17 one-row candidate activation. Default is read-only dry-run.

Root explicitly runs --enable after a matching fresh dry-run and reconciliation.
No migration retry, ACL/schema/identity, credentials, provider, workflow or flags.
"""
import copy, datetime, hashlib, json, os, re, sys, uuid
from pathlib import Path
import release_candidate_pipeline as release

ROOT, TARGET = release.ROOT, release.TARGET
MIGRATION = '20261029100500_m03_candidate_pipeline.sql'
MIGRATION_SHA = '4af04b4a3fb050e39aa23958c3f82e304cc7d7a1f450a5d93f7f50bc001bd836'
INSPECT = 'tools/sql/inspect-candidate-configuration.sql'
ENABLE = 'tools/sql/enable-candidate-configuration.sql'
SEALS = {INSPECT:'cd27a12add722095900fc85d8a41d7032409582938c2d4ec9242195e56fc74b9',
 ENABLE:'c54ed4e1d95dee34442f19d85049364225049c639254e17307826e99199f70bf',
 'tools/release_candidate_pipeline.py':'e58629f8d402c7ed9c3cabafc3207b1c1cc29e9766c3b9cf199b6ebaf18be806',
 'tools/sql/candidate-pipeline-readback.sql':'4bfaa7da1b96a4bb5c4dcea198ce56bb4b05aaaf64815b2dae1243c4ee2abbc9'}
PRISTINE = {'id':True,'enabled':False,'transcription_model':None,'extraction_model':None,
 'prompt_version':'candidate-v1','schema_version':'1.0','media_implementation_version':'video-preparation.v1'}
ENABLED = {**PRISTINE,'enabled':True,'transcription_model':'gpt-transcribe','extraction_model':'gpt-6.1-sol'}
RECONCILIATIONS = ROOT / 'tracking/evidence/cloud-candidate-pipeline-reconciliation'
EVIDENCE = ROOT / 'tracking/evidence/m03/candidate-activation'
PRIVATE = ROOT / '.local/candidate-runtime'
CLAIM = PRIVATE / 'cloud-enable.claim.json'


def require(value):
    if not value: raise ValueError('FIXED_CANDIDATE_ACTIVATION_UNCONFIRMED')


def sha(value): return hashlib.sha256(value).hexdigest()
def canonical(value): return sha(json.dumps(value,sort_keys=True,separators=(',',':')).encode())
def now(): return datetime.datetime.now(datetime.timezone.utc)


def versions():
    manifest=json.loads((ROOT/'development/local-db/reviewed.json').read_bytes())
    rows=manifest['migrations'];require(len(rows)==17)
    names=sorted(path.name for path in (ROOT/'supabase/migrations').glob('*.sql'))
    require(names==[Path(row['path']).name for row in rows] and names[-1]==MIGRATION)
    for row in rows:
        require(row['reviewed_by'] and row['reviewed_at'] and sha((ROOT/row['path']).read_bytes())==row['sha256'])
    require(rows[-1]['sha256']==MIGRATION_SHA)
    return [name[:14] for name in names]


def validate_reconciliation(value, expected_versions):
    require(value['result']=='passed' and value['target']==TARGET and value['migration']==MIGRATION
      and value['migration_sha256']==MIGRATION_SHA and value['application_verified_by_readback'] is True
      and value['candidate_configuration_disabled_verified'] is True and value['exact_runtime_function_operations']==11
      and value['cloud_write_attempted'] is False and value['migration_retry_attempted'] is False
      and value['flags_changed'] is False and value['original_failed_receipt_preserved'] is True
      and value['readback']['versions']==expected_versions)
    comparison=value['at_apply_reconciliation']
    require(comparison['business_rows_preserved'] is True and comparison['old_catalog_preserved_except_reviewed_delta'] is True
      and comparison['runtime_authority_unchanged'] is True and comparison['cloud_grants_changed'] is False
      and comparison['derived_boolean_count']==9 and len(comparison['managed_public_predicates'])==3)
    current=value['reconciliation']
    require(current['deployment_catalog_runtime_config_unchanged_since_apply'] is True
      and current['fresh_whole_business_unchanged'] is False)
    drift=current['post_release_business_drift']
    require(isinstance(drift,list) and len(drift)==4 and {row['table'] for row in drift}==
      {'eps.workspaces','eps.workspace_candidates','eps.audit_events','eps.idempotency_records'})
    drift={row['table']:row for row in drift}
    require(all(row['fingerprint_changed'] is True and type(row['at_apply_count']) is int
      and type(row['current_count']) is int for row in drift.values()))
    require(drift['eps.workspaces']['current_count']==drift['eps.workspaces']['at_apply_count']
      and drift['eps.workspace_candidates']['current_count']==drift['eps.workspace_candidates']['at_apply_count']+1)
    actions=drift['eps.audit_events']['current_count']-drift['eps.audit_events']['at_apply_count']
    require(actions in (1,2) and drift['eps.idempotency_records']['current_count']-drift['eps.idempotency_records']['at_apply_count']==actions)
    attested=current['root_attested_ui_operations']
    require(attested['workspace_id']=='e470aefd-e0f7-480c-bf0d-170cb2cb7069'
      and attested['candidate_id']=='b7341092-50c4-49b4-ad5f-a0ceedddebf1'
      and attested['workspace_candidate_id']=='ebe0ce53-5f42-4daa-9c46-4519ab18f383')


def inputs(receipt_name):
    require(re.fullmatch(r'[0-9TZA-Za-z-]{10,100}\.json',receipt_name) is not None and Path(receipt_name).name==receipt_name)
    require((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
    expected_versions=versions()
    for file,seal in SEALS.items():require(sha((ROOT/file).read_bytes())==seal)
    raw=(RECONCILIATIONS/receipt_name).read_bytes();reconciled=json.loads(raw)
    validate_reconciliation(reconciled,expected_versions)
    failed=ROOT/reconciled['original_failed_receipt']
    require(failed.resolve().is_relative_to((ROOT/'tracking/evidence/cloud-candidate-pipeline').resolve())
      and sha(failed.read_bytes())==reconciled['original_failed_receipt_sha256'])
    return {'reconciliation_receipt':receipt_name,'reconciliation_sha256':sha(raw),'sources':SEALS,
      'helper_sha256':sha(Path(__file__).read_bytes()),'migration':MIGRATION,'migration_sha256':MIGRATION_SHA,'versions':expected_versions}


def inspect_configuration():
    result=release.call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT/INSPECT),'--output-format','json'])
    require(result.returncode==0);rows=json.loads(result.stdout)['rows']
    require(len(rows)==1 and set(rows[0])=={'candidate_configuration'})
    value=rows[0]['candidate_configuration']
    require(value['query_role']=='postgres' and value['database']=='postgres' and value['configuration_rows']==1)
    return value


def inspect_state(expected_versions):
    snapshot=release.inspect();require(snapshot['versions']==expected_versions)
    configuration=inspect_configuration()
    return {'snapshot':snapshot,'configuration':configuration}


def require_pristine(state):
    value=state['configuration'];require(value['configuration']==PRISTINE
      and value['active_candidate_jobs']==0 and value['active_candidate_uploads']==0)


def compare_activation(before, after, result):
    require_pristine(before)
    require(result=={'before':PRISTINE,'after':ENABLED,'changed_rows':1})
    require(after['configuration']=={**before['configuration'],'configuration':ENABLED})
    old,new=copy.deepcopy(before['snapshot']),copy.deepcopy(after['snapshot'])
    previous=old['data_sha256'].pop('eps.candidate_asset_config')
    current=new['data_sha256'].pop('eps.candidate_asset_config')
    require(re.fullmatch(r'[a-f0-9]{64}',previous) and re.fullmatch(r'[a-f0-9]{64}',current) and previous!=current)
    require(old==new)  # All other business/catalog/runtime/count/hash fields stay exact.


def retain(value, suffix):
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    file=EVIDENCE/(now().strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+uuid.uuid4().hex[:8]+'-'+suffix+'.json')
    file.write_text(json.dumps(value,indent=2)+'\n',encoding='utf8')
    return file


def arguments(values):
    action='dry-run'
    if values and values[0] in ('--dry-run','--enable'):action=values.pop(0)[2:]
    require(len(values)==2 and values[0]=='--receipt')
    return action,values[1]


def main():
    action,receipt_name=arguments(sys.argv[1:]);sealed=inputs(receipt_name)
    require(not CLAIM.exists())
    receipt={'observed_at':now().isoformat(),'target':TARGET,'action':action,'inputs':sealed,'result':'failed',
      'cloud_write_attempted':False,'automatic_retry':False,'migration_retry_attempted':False,
      'provider_called':False,'credentials_changed':False,'acl_schema_identity_changed':False,'local_flags_changed':False}
    try:
        before=inspect_state(sealed['versions']);receipt['before']=before;require_pristine(before)
        if action=='enable':
            dry=json.loads((EVIDENCE/'dry-run.json').read_bytes())
            age=(now()-datetime.datetime.fromisoformat(dry['observed_at'])).total_seconds()
            require(dry['result']=='passed' and dry['action']=='dry-run' and dry['inputs']==sealed
              and dry['before']==before and 0<=age<=900)
            PRIVATE.mkdir(parents=True,exist_ok=True)
            with CLAIM.open('x',encoding='utf8') as handle:
                json.dump({'target':TARGET,'status':'dispatching','at':now().isoformat(),'automatic_retry':False,
                  'dry_run_sha256':sha((EVIDENCE/'dry-run.json').read_bytes())},handle);handle.flush();os.fsync(handle.fileno())
            receipt['cloud_write_attempted']=True
            result=release.call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT/ENABLE),'--output-format','json'])
            receipt['sql_exit_code']=result.returncode;require(result.returncode==0)
            rows=json.loads(result.stdout)['rows'];require(len(rows)==1 and set(rows[0])=={'candidate_activation'})
            receipt['activation']=rows[0]['candidate_activation']
            after=inspect_state(sealed['versions']);receipt['after']=after
            compare_activation(before,after,receipt['activation'])
            receipt['configuration_enabled_verified']=True;receipt['all_other_catalog_runtime_business_hashes_unchanged']=True
        else:
            after=inspect_state(sealed['versions']);require(before==after)
            receipt['read_only_verified']=True
        receipt['result']='passed'
    finally:
        receipt['finished_at']=now().isoformat();file=retain(receipt,action)
        if receipt['result']=='passed' and action=='dry-run':
            temporary=EVIDENCE/('dry-'+uuid.uuid4().hex+'.tmp');temporary.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8');os.replace(temporary,EVIDENCE/'dry-run.json')
        print(json.dumps({'result':receipt['result'],'action':action,'receipt':file.relative_to(ROOT).as_posix(),
          'cloud_write_attempted':receipt['cloud_write_attempted'],'automatic_retry':False}))


if __name__=='__main__':
    try:main()
    except Exception:sys.stderr.write('Fixed candidate activation stopped. Preserve any dispatch claim and inspect metadata; no automatic retry.\n');sys.exit(1)
