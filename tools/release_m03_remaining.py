"""Fixed reviewed17->19 two-migration release. Root executes explicitly.

The single apply intent is retained before dispatch. Unknown outcomes require
read-only reconciliation; this tool has no retry/force/target/SQL/flag options.
"""
import copy,datetime,hashlib,json,os,re,subprocess,sys,tomllib,uuid
from pathlib import Path
from release_foundation import ROOT,TARGET,call as cli_call
from release_specs_read_operation import validate_runtime as validate_ten_runtime,Blocked

BASE_MIGRATION='20261029133455_m03_remaining_media_library.sql'
BASE_MIGRATION_SHA='2e190e001b2bda044d9c90da4287f54e5839b0af7ffec84d4c93083909c944fb'
MIGRATION='20261029135318_m03_frame_request_resubmission.sql'
MIGRATION_SHA='e816ad6b491626ace489efd256b56c322d25d9101de94e5fb8b24d2d4b745048'
MIGRATIONS=[{'migration':BASE_MIGRATION,'sha256':BASE_MIGRATION_SHA},{'migration':MIGRATION,'sha256':MIGRATION_SHA}]
READBACK='tools/sql/m03-remaining-readback.sql'
READBACK_SHA='c8e74d2bd7399682c984ad79b8f1732fd074056bf6ac065c19407948bfcc7b72'
PROOF='tracking/evidence/m03/remaining-composed-local/2026-10-29T13-43-40-528Z-97b70205.json'
PROOF_SHA='04f7e98ea89d6ed8550ee56b8c19fa4ee4f112c5625a27af05608c4db535cba0'
BASELINE_MANIFEST='tracking/evidence/m03/remaining-preparation/baseline17-reviewed-manifest.json'
BASELINE_MANIFEST_SHA='f4ae3d8ba1169ae9f89ee16c1d8b922edaf6a5bea2e8ad56c5a5194ef8aadfdb'
PROMOTION='tracking/evidence/m03/remaining-promotion/2026-10-29T13-49-25-671Z-06ab16d1.json'
PROMOTION_SHA='8a6a761c04bb04de88bc9b4147c7e624ab4b7d1b3aa111cd8c562103148eae6b'
BASE_MANIFEST_SHA='ac7a72b6e694e69ad6d59441ccb5b3f65d4de2ea9965c787489ce4e96c230853'
BASE_MANIFEST='tracking/evidence/m03/remaining-preparation/baseline18-reviewed-manifest.json'
# Final fixed19 local proof/promotion seals are required before any CLI access.
RESUBMISSION_PROOF='tracking/evidence/m03/frame-resubmission-local/2026-10-29T13-58-19-049Z-f0b71f9a.json'
RESUBMISSION_PROOF_SHA='73368b041323340ecc2009bb4432cabb311b8a961a96d48f788547227b28f676'
RESUBMISSION_PROMOTION='tracking/evidence/m03/frame-resubmission-promotion/2026-10-29T14-02-13-973Z-4999b031.json'
RESUBMISSION_PROMOTION_SHA='3f58d21977f054af732af51dbaecacde825638a3328cc4bd121380529eda54e2'
MANIFEST_SHA='f504c4745bfb1ac31c7ba30d42153fe965dcc9e3451821808b3b4050122985b2'
DEPENDENCY_SEALS={'tools/release_foundation.py':'02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751',
 'tools/release_specs_read_operation.py':'a68be68c78bb20b59216e5aabd9b568bb0d46ef9fd35097ceb78392f85ad304e',
 'tools/provision_logo_verifier.py':'660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c'}
EVIDENCE=ROOT/'tracking/evidence/cloud-m03-remaining'
PRIVATE=ROOT/'.local/cloud-m03-remaining'
CLAIM=PRIVATE/'apply.claim.json'
CATALOG_KEYS={'functions':('signature',),'relations':('name',),'columns':('table','name'),'roles':('name',),
 'table_acls':('table','role'),'column_acls':('table','column','role'),'policies':('table','name'),
 'constraints':('table','name'),'indexes':('table','name'),'triggers':('table','name')}
NEW_ROLES={'eps_support_upload_owner','eps_support_verify_owner'}
NEW_TABLES={'eps.candidate_support_config','eps.support_uploads','eps.support_verification_keys','eps.candidate_support',
 'eps.frame_extraction_config','eps.frame_extraction_requests'}
MANAGED_PREDICATES={'storage.operation','storage.allow_only_operation','storage.allow_any_operation'}
# These five fixture-only provider rows are unchanged by both migrations.
# The observed cloud's actual Storage constraints/indexes remain authoritative
# and are still compared in full before/after; no actual row is discarded.
ABSENT_LOCAL_STORAGE_ROWS={('constraints','storage.buckets','buckets_name_key'),
 ('constraints','storage.objects','objects_bucket_id_fkey'),('constraints','storage.objects','objects_bucket_id_name_key'),
 ('indexes','storage.buckets','buckets_name_key'),('indexes','storage.objects','objects_bucket_id_name_key')}
KEY_METADATA='eps.support_verification_keys:metadata'
OPERATIONS={'eps.claim_job_stage(jsonb)','eps.get_specs_stage_input(uuid,uuid,text)','eps.record_job_event(jsonb)',
 'eps.recover_job_stages(integer)','eps.claim_job_outbox(integer)','eps.finish_job_outbox(uuid,text,boolean)',
 'eps.get_job_asset_access(jsonb)','eps.reserve_job_output(jsonb)','eps.complete_job_output(jsonb)',
 'eps.store_specs_preparation(jsonb)','eps.claim_job_stage_replay(jsonb,text,text,text)'}

def require(value):
    if not value:raise ValueError('M03_REMAINING_RELEASE_UNCONFIRMED')

def sha(value):return hashlib.sha256(value).hexdigest()
def canonical(value):return sha(json.dumps(value,sort_keys=True,separators=(',',':')).encode())
def read_json(relative):return json.loads((ROOT/relative).read_bytes())
def _map(kind,rows):
    require(isinstance(rows,list));result={}
    for row in rows:
        key=tuple(row[name] for name in CATALOG_KEYS[kind]);require(key not in result);result[key]=copy.deepcopy(row)
    return result

def _patch(actual,old,new):
    if old==new:return copy.deepcopy(actual)
    if isinstance(old,dict) and isinstance(new,dict):
        require(isinstance(actual,dict));result=copy.deepcopy(actual)
        for key in old.keys()|new.keys():
            if key not in old:require(key not in result);result[key]=copy.deepcopy(new[key])
            elif key not in new:require(result.get(key)==old[key]);del result[key]
            else:require(key in result);result[key]=_patch(result[key],old[key],new[key])
        return result
    require(actual==old);return copy.deepcopy(new)

def expected_catalog(actual,reference_before,reference_after):
    require(set(actual)==set(reference_before)==set(reference_after)==set(CATALOG_KEYS));result={}
    derived=0
    for kind in CATALOG_KEYS:
        old=_map(kind,reference_before[kind]);new=_map(kind,reference_after[kind]);expected=_map(kind,actual[kind])
        require(set(old)<=set(new))
        for key,row in old.items():
            if key not in expected:
                require((kind,*key) in ABSENT_LOCAL_STORAGE_ROWS and row==new[key])
                continue
            if row!=new[key]:expected[key]=_patch(expected[key],row,new[key])
        for key,row in new.items():
            if key not in old:require(key not in expected);expected[key]=copy.deepcopy(row)
        if kind=='functions':
            # These managed predicates already differed in PUBLIC EXECUTE in cloud17.
            # Preserve their exact source/ACL/current flags, deriving ONLY new-role
            # booleans from the observed authenticated/PUBLIC inheritance boundary.
            for key,row in expected.items():
                if row['name'] in MANAGED_PREDICATES and key in _map(kind,actual[kind]):
                    observed=_map(kind,actual[kind])[key]
                    for role in NEW_ROLES:
                        require(role in row['execute'])
                        value=bool(observed['public_execute'] or observed['execute'].get('authenticated',False))
                        if row['execute'][role]!=value:derived+=1
                        row['execute'][role]=value
        if kind=='column_acls':
            table_rows=_map('table_acls',result['table_acls'])
            for column in actual['columns']:
                for role in NEW_ROLES:
                    key=(column['table'],column['name'],role)
                    if key not in expected:
                        table=table_rows[(column['table'],role)]
                        expected[key]={'table':column['table'],'column':column['name'],'role':role,
                          **{name:table[name] for name in ('select','insert','update','references')}}
        result[kind]=list(expected.values())
    return result,derived

def compare_states(before,after,reference_before,reference_after):
    require(set(before)==set(after))
    require(reference_after['versions'][:len(reference_before['versions'])]==reference_before['versions'])
    additions=reference_after['versions'][len(reference_before['versions']):]
    require(additions in ([BASE_MIGRATION[:14]],[BASE_MIGRATION[:14],MIGRATION[:14]]))
    require(after['versions']==before['versions']+additions)
    require({k:v for k,v in before.items() if k not in ('catalog','versions','counts','data_sha256','remaining')}
      =={k:v for k,v in after.items() if k not in ('catalog','versions','counts','data_sha256','remaining')})
    require(set(after['counts'])==set(before['counts'])|NEW_TABLES and not(set(before['counts'])&NEW_TABLES))
    for table,count in before['counts'].items():require(after['counts'][table]==count+(1 if table=='storage.buckets' else 0))
    for table in NEW_TABLES:require(after['counts'][table]==(1 if table in ('eps.candidate_support_config','eps.frame_extraction_config') else 0))
    new_hashes=(NEW_TABLES-{'eps.support_verification_keys'})|{KEY_METADATA}
    require(set(after['data_sha256'])==set(before['data_sha256'])|new_hashes)
    require('eps.support_verification_keys' not in after['data_sha256'])
    for table,value in before['data_sha256'].items():require(after['data_sha256'][table]==value)
    for table in new_hashes:require(after['data_sha256'][table]==reference_after['data_sha256'][table])
    require(before['remaining']==reference_before['remaining'] and after['remaining']==reference_after['remaining'])
    require(after['remaining']['frame_config']['enabled'] is False and after['remaining']['support_config']['uploads_enabled'] is False
      and after['remaining']['support_verification_keys']==[])
    expected,derived=expected_catalog(before['catalog'],reference_before['catalog'],reference_after['catalog'])
    for kind in CATALOG_KEYS:require(_map(kind,after['catalog'][kind])==_map(kind,expected[kind]))
    return {'business_rows_preserved':True,'old_catalog_preserved_except_reviewed_delta':True,'runtime_authority_unchanged':True,
      'new_tables_empty_except_disabled_configs':True,'managed_storage_derived_flags':derived,
      'managed_storage_absent_local_fixture_rows':[list(key) for key in sorted(ABSENT_LOCAL_STORAGE_ROWS)
        if tuple(key[1:]) not in _map(key[0],before['catalog'][key[0]])]}

def _sealed(relative,digest):
    require(isinstance(relative,str) and isinstance(digest,str) and re.fullmatch('[a-f0-9]{64}',digest))
    path=ROOT/relative;require(path.resolve().is_relative_to(ROOT.resolve()) and sha(path.read_bytes())==digest);return path

def current_release_inputs():
    """Pure fixed source/evidence validation, reused by later explicit activation."""
    require((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
    config=tomllib.loads((ROOT/'supabase/config.toml').read_text());require(config['db']['migrations']['enabled'] is True and config['db']['seed']['enabled'] is False)
    _sealed(READBACK,READBACK_SHA);_sealed(PROOF,PROOF_SHA);_sealed(BASELINE_MANIFEST,BASELINE_MANIFEST_SHA)
    for file,digest in DEPENDENCY_SEALS.items():_sealed(file,digest)
    _sealed('development/local-db/reviewed.json',MANIFEST_SHA);_sealed(PROMOTION,PROMOTION_SHA);_sealed(BASE_MANIFEST,BASE_MANIFEST_SHA)
    _sealed(RESUBMISSION_PROOF,RESUBMISSION_PROOF_SHA);_sealed(RESUBMISSION_PROMOTION,RESUBMISSION_PROMOTION_SHA)
    manifest=read_json('development/local-db/reviewed.json');base=read_json(BASELINE_MANIFEST)
    require(len(base['migrations'])==17 and len(manifest['migrations'])==19 and manifest['migrations'][:-2]==base['migrations'])
    previous=read_json(BASE_MANIFEST);require(len(previous['migrations'])==18 and manifest['migrations'][:-1]==previous['migrations'])
    names=sorted(path.name for path in (ROOT/'supabase/migrations').glob('*.sql'))
    require(names==[Path(row['path']).name for row in manifest['migrations']] and names[-1]==MIGRATION)
    for row in manifest['migrations']:require(row['reviewed_by'] and row['reviewed_at']);_sealed(row['path'],row['sha256'])
    require([{'migration':Path(row['path']).name,'sha256':row['sha256']} for row in manifest['migrations'][-2:]]==MIGRATIONS)
    proof=read_json(PROOF);promotion=read_json(PROMOTION)
    require(proof['result']=='passed' and all(proof[key] is True for key in ('rollback_verified','sources_stable','assertions_passed','owned_backend_settled'))
      and proof['cloud_called'] is False and proof['provider_called'] is False and proof['migration_sha256']==BASE_MIGRATION_SHA)
    require(proof['before']==proof['after'] and len(proof['markers'])==5)
    for file,digest in proof['source_seals'].items():
        if file=='development/local-db/reviewed.json':require(digest==BASELINE_MANIFEST_SHA)
        else:_sealed(file,digest)
    _sealed('tools/test-m03-remaining-composed.mjs',proof['harness_sha256'])
    compare_states(proof['before'],proof['expected'],proof['before'],proof['expected'])
    require(promotion['result']=='passed' and promotion['cloud_called'] is False and promotion['provider_called'] is False
      and promotion['migration_sha256']==BASE_MIGRATION_SHA and promotion['business_and_old_catalog_preserved'] is True
      and promotion['proof_sha256']==PROOF_SHA and promotion['readback_sha256']==READBACK_SHA)
    require(promotion['managed_auth_preserved'] is True and promotion['managed_auth_before']==promotion['managed_auth_after'])
    _sealed('tools/promote-m03-remaining-local.mjs',promotion['harness_sha256'])
    require(promotion['before']==proof['before'] and promotion['after']==proof['expected'])
    compare_states(promotion['before'],promotion['after'],proof['before'],proof['expected'])
    resubmission=read_json(RESUBMISSION_PROOF);resubmission_promotion=read_json(RESUBMISSION_PROMOTION)
    validate_resubmission_evidence(resubmission,resubmission_promotion,proof)
    return {'migration':MIGRATION,'migration_sha256':MIGRATION_SHA,'migrations':MIGRATIONS,'proof':PROOF,'proof_sha256':PROOF_SHA,
      'promotion':PROMOTION,'promotion_sha256':PROMOTION_SHA,'manifest_sha256':MANIFEST_SHA,'readback_sha256':READBACK_SHA,
      'resubmission_proof':RESUBMISSION_PROOF,'resubmission_proof_sha256':RESUBMISSION_PROOF_SHA,
      'resubmission_promotion':RESUBMISSION_PROMOTION,'resubmission_promotion_sha256':RESUBMISSION_PROMOTION_SHA,
      'versions':[name[:14] for name in names],'dependencies':DEPENDENCY_SEALS,'helper_sha256':sha(Path(__file__).read_bytes())}

def final_reference():
    return read_json(PROOF)['before'],read_json(RESUBMISSION_PROOF)['expected']

def validate_resubmission_evidence(proof,promotion,original):
    require(proof['result']=='passed' and proof['cloud_called'] is False and proof['provider_called'] is False
      and proof['migration_sha256']==MIGRATION_SHA)
    require(all(proof[key] is True for key in ('rollback_verified','sources_stable','assertions_passed','owned_backend_settled')))
    require(proof['only_reviewed_function_body_changed'] is True and proof['red_reproduced'] is True
      and proof['transaction_completed_to_rollback'] is True and len(proof['markers'])==3
      and proof['managed_auth_before']==proof['managed_auth_after'])
    require(proof['before']==proof['after']==original['expected'])
    require(proof['expected']['versions']==proof['before']['versions']+[MIGRATION[:14]])
    old=copy.deepcopy(proof['before']);new=copy.deepcopy(proof['expected']);new['versions']=old['versions']
    signature='public.eps_extract_candidate_frames(uuid, jsonb, text)'
    old_rows=_map('functions',old['catalog']['functions']);new_rows=_map('functions',new['catalog']['functions'])
    require((signature,) in old_rows and (signature,) in new_rows)
    require(old_rows[(signature,)]['source_sha256']!=new_rows[(signature,)]['source_sha256'])
    new_rows[(signature,)]['source_sha256']=old_rows[(signature,)]['source_sha256'];new['catalog']['functions']=list(new_rows.values())
    require(old==new)
    for file,digest in proof['source_seals'].items():
        if file=='development/local-db/reviewed.json':require(digest==BASE_MANIFEST_SHA)
        else:_sealed(file,digest)
    _sealed('tools/test-m03-frame-resubmission.mjs',proof['harness_sha256'])
    require(promotion['result']=='passed' and promotion['cloud_called'] is False and promotion['provider_called'] is False
      and promotion['migration_sha256']==MIGRATION_SHA and promotion['proof_sha256']==RESUBMISSION_PROOF_SHA
      and promotion['readback_sha256']==READBACK_SHA and promotion['before']==proof['before'] and promotion['after']==proof['expected'])
    require(promotion['business_and_old_catalog_preserved'] is True and promotion['only_reviewed_function_body_changed'] is True
      and promotion['managed_auth_preserved'] is True and promotion['managed_auth_before']==promotion['managed_auth_after'])
    _sealed('tools/promote-m03-frame-resubmission-local.mjs',promotion['harness_sha256'])
    require(all(promotion['comparison'][key] is True for key in
      ('business_rows_preserved','only_one_reviewed_function_body_changed','all_other_catalog_and_runtime_preserved')))
    compare_states(original['before'],proof['expected'],original['before'],proof['expected'])

def _private_write(path,data):
    from provision_logo_verifier import WindowsPrivateFiles
    PRIVATE.mkdir(parents=True,exist_ok=True);security=WindowsPrivateFiles()
    with security.create(path) as handle:handle.write(data);handle.flush();os.fsync(handle.fileno());security.verify_open(handle)

def call(arguments):
    label=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%f')+'-'+uuid.uuid4().hex[:8]
    try:result=cli_call(arguments)
    except subprocess.TimeoutExpired as error:
        for stream in ('stdout','stderr'):
            value=getattr(error,stream,None) or b'';_private_write(PRIVATE/(label+'.'+stream),value.encode() if isinstance(value,str) else value)
        raise ValueError('M03_REMAINING_CLI_UNCONFIRMED') from None
    for stream in ('stdout','stderr'):_private_write(PRIVATE/(label+'.'+stream),getattr(result,stream).encode('utf8'))
    return result

def inspect_state():
    """Only the sealed metadata READ ONLY query; never starts a release."""
    _sealed(READBACK,READBACK_SHA)
    result=call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT/READBACK),'--output-format','json']);require(result.returncode==0)
    rows=json.loads(result.stdout)['rows'];require(len(rows)==1 and set(rows[0])=={'m03_remaining_release'})
    state=rows[0]['m03_remaining_release'];require(state['query_role']=='postgres' and state['database']=='postgres' and state['unrestricted_visibility'] is True)
    runtime=copy.deepcopy(state['runtime']);require({name.replace(' ','') for name in runtime['execute']}==OPERATIONS)
    replay='eps.claim_job_stage_replay(jsonb, text, text, text)';require(runtime['execute'].count(replay)==1);runtime['execute'].remove(replay)
    try:validate_ten_runtime(runtime)
    except Blocked:raise ValueError('M03_REMAINING_RUNTIME_UNCONFIRMED') from None
    protected=state['protected_m02'];require(protected['job_exists'] is True and protected['manual_note_retained'] is True and protected['source_inputs_count']>=1)
    return state

def pending_migrations(text):return sorted(set(re.findall(r'\d{14}_[A-Za-z0-9_]+\.sql',text)))
def validate_pending(text):require(pending_migrations(text)==[row['migration'] for row in MIGRATIONS])
def push_command(dry_run):return ['db','push','--linked','--project-ref',TARGET,'--skip-vault','--yes','--output-format','json']+(['--dry-run'] if dry_run else [])
def apply_claim_exists():return CLAIM.exists() or any(EVIDENCE.glob('*-apply-attempt.json'))
def refuse_repeat_apply():require(not apply_claim_exists())
def retain(receipt,suffix):
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    name=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+uuid.uuid4().hex[:8]+'-'+suffix+'.json'
    path=EVIDENCE/name
    with path.open('x',encoding='utf8') as handle:json.dump(receipt,handle,indent=2);handle.write('\n');handle.flush();os.fsync(handle.fileno())
    return path.relative_to(ROOT).as_posix()

def main(arguments=None):
    arguments=sys.argv[1:] if arguments is None else arguments;require(len(arguments)<=1)
    action=arguments[0] if arguments else 'dry-run';require(action in ('inspect','dry-run','apply','readback'))
    receipt={'action':action,'target':TARGET,'migration':MIGRATION,'migration_sha256':MIGRATION_SHA,'migrations':MIGRATIONS,'result':'failed','dispatch_attempted':False,
      'automatic_retry':False,'provider_called':False,'flags_changed':False,'identity_provisioned':False,'seeds':False,'vault_sync':False}
    try:
        inputs=current_release_inputs();receipt['inputs']=inputs;reference_before,reference_after=final_reference();before=inspect_state();receipt['before']=before
        versions=inputs['versions'];require(before['versions'] in (versions[:-2],versions))
        if action=='inspect':receipt['readback']=before
        elif action=='readback':
            require(before['versions']==versions);claim=read_json(CLAIM.relative_to(ROOT).as_posix())
            require(claim['target']==TARGET and claim['migration_sha256']==MIGRATION_SHA and claim['inputs_sha256']==canonical(inputs))
            path=Path(claim['attempt_receipt']);require(path.parent.as_posix()=='tracking/evidence/cloud-m03-remaining' and path.name.endswith('-apply-attempt.json'))
            attempt=read_json(path);require(canonical(attempt['before'])==claim['before_sha256'])
            receipt['before']=attempt['before'];receipt['readback']=before;receipt['comparison']=compare_states(attempt['before'],before,reference_before,reference_after)
        else:
            require(before['versions']==versions[:-2]);expected_catalog(before['catalog'],reference_before['catalog'],reference_after['catalog'])
            if action=='apply':
                refuse_repeat_apply();dry=read_json('tracking/evidence/cloud-m03-remaining/dry-run.json')
                age=(datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(dry['finished_at'])).total_seconds()
                require(dry['result']=='passed' and dry['inputs']==inputs and dry['before']==before and dry['pending_migrations']==[row['migration'] for row in MIGRATIONS] and 0<=age<=900)
            receipt['attempt_receipt']=retain(receipt,action+'-attempt')
            if action=='apply':
                _private_write(CLAIM,(json.dumps({'target':TARGET,'migration_sha256':MIGRATION_SHA,'inputs_sha256':canonical(inputs),
                  'before_sha256':canonical(before),'attempt_receipt':receipt['attempt_receipt'],'dispatch_may_have_occurred':True})+'\n').encode())
            require(current_release_inputs()==inputs)
            if action=='apply':receipt['dispatch_attempted']=True
            result=call(push_command(action=='dry-run'));receipt['exit_code']=result.returncode;receipt['pending_migrations']=pending_migrations(result.stdout+'\n'+result.stderr)
            after=inspect_state();receipt['readback']=after
            if action=='apply':receipt['comparison']=compare_states(before,after,reference_before,reference_after)
            else:require(before==after)
            require(result.returncode==0);validate_pending(result.stdout+'\n'+result.stderr)
        receipt['application_verified_by_readback']=action in ('apply','readback');receipt['runtime_execute_operations']=11;receipt['result']='passed'
    except Exception:
        receipt['reason']='Fixed18+19 release unconfirmed. Retain attempt/history/readback and reconcile read-only before any repeat mutation.'
        raise
    finally:
        receipt['finished_at']=datetime.datetime.now(datetime.timezone.utc).isoformat();path=retain(receipt,action)
        if action=='dry-run' and receipt['result']=='passed':
            temporary=EVIDENCE/('dry-'+uuid.uuid4().hex+'.tmp');temporary.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8');os.replace(temporary,EVIDENCE/'dry-run.json')
        print(json.dumps({'result':receipt['result'],'receipt':path,'application_verified_by_readback':receipt.get('application_verified_by_readback',False),'automatic_retry':False}))

if __name__=='__main__':
    try:main()
    except Exception:sys.stderr.write('Fixed18+19 release stopped; raw diagnostics remain private. No automatic retry.\n');sys.exit(1)
