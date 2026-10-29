"""Fixed reviewed19->20 assignment/lifecycle release. No import-time IO.

Root executes explicitly. One durable apply claim precedes dispatch. Unknown
outcomes require read-only reconciliation; no target/SQL/force/retry options.
"""
import copy,datetime,hashlib,json,os,re,subprocess,sys,tomllib,uuid
from pathlib import Path
from release_foundation import ROOT,TARGET,call as cli_call
import release_m03_remaining as prior

MIGRATION='20261029174841_m04_casting_assignments_lifecycle.sql'
MIGRATION_SHA='2825681bf529f1b32db2473749180901f0961b025e8da847b38ad49c06f4b900'
MANIFEST_SHA='f8e9c48d19a66b38b81eee6f6a7d10e01d8604a9aed9e60e0de1f0f1dc610f14'
BASELINE='tracking/evidence/m04/migration-preparation/baseline19-reviewed-manifest.json'
BASELINE_SHA='f504c4745bfb1ac31c7ba30d42153fe965dcc9e3451821808b3b4050122985b2'
PROOF='tracking/evidence/m04/migration-local/2026-10-29T17-50-48-101Z-2d85109f.json'
PROOF_SHA='f3c6400ce6905ce4562021cc61453640251dac4a93dbadee711a92a1a7bf88d0'
PROMOTION='tracking/evidence/m04/migration-promotion/2026-10-29T17-55-46-337Z-813da042.json'
PROMOTION_SHA='22301e840b918eb7f473347ce7cd369251dd06d3ce909f4c98c6cee28f7c3205'
RACE='tracking/evidence/m04/main-race-local/2026-10-29T16-44-42-247Z-f410889c.json'
RACE_SHA='0255aa6df6423abc175a5cd660a4251683f29e1f86e19ff759f64488b7ae9d87'
READBACK='tools/sql/m04-casting-readback.sql'
READBACK_SHA='13cc727a2e2e34321c6bbee2c98a3b7c85af88445fe1a1effd067d895fe5456f'
DEPENDENCIES={'tools/release_foundation.py':'02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751',
 'tools/release_m03_remaining.py':'5a608e480c7afb56a1b49c7a683c238d950301c589c1ff91348368f486995b7e',
 'tools/release_specs_read_operation.py':'a68be68c78bb20b59216e5aabd9b568bb0d46ef9fd35097ceb78392f85ad304e',
 'tools/provision_logo_verifier.py':'660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c',
 'tools/local-postgres.mjs':'49929bce8eb51194d9299cfd9639e537eb237daaec76c15740cb88059604e2de'}
NEW_ROLES={'eps_casting_owner':True,'eps_casting_guard_owner':False}
NEW_TABLES={'eps.assignments','eps.assignment_change_events','eps.assignment_change_consumptions'}
CATALOG_KEYS=prior.CATALOG_KEYS
PRIVATE=ROOT/'.local/cloud-m04-casting'
EVIDENCE=ROOT/'tracking/evidence/cloud-m04-casting'
CLAIM=PRIVATE/'apply.claim.json'

def require(value):
    if not value:raise ValueError('M04_CASTING_RELEASE_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def canonical(value):return sha(json.dumps(value,sort_keys=True,separators=(',',':')).encode())
def read_json(relative):return json.loads((ROOT/relative).read_bytes())
def sealed(relative,digest):
    require(isinstance(relative,str) and isinstance(digest,str) and re.fullmatch('[a-f0-9]{64}',digest))
    file=ROOT/relative;require(file.resolve()==file and not file.is_symlink() and sha(file.read_bytes())==digest)
def expected_catalog(actual,reference_before,reference_after,schema_defaults=None):
    """Apply only reviewed exact deltas, preserving observed managed differences."""
    require(set(actual)==set(reference_before)==set(reference_after)==set(CATALOG_KEYS));result={};derived=0
    for kind in CATALOG_KEYS:
        old=prior._map(kind,reference_before[kind]);new=prior._map(kind,reference_after[kind]);expected=prior._map(kind,actual[kind]);require(set(old)<=set(new))
        for key,row in old.items():
            if key not in expected:
                require((kind,*key) in prior.ABSENT_LOCAL_STORAGE_ROWS and row==new[key]);continue
            if row!=new[key]:expected[key]=prior._patch(expected[key],row,new[key])
        for key,row in new.items():
            if key not in old:require(key not in expected);expected[key]=copy.deepcopy(row)
        if kind=='functions':
            observed=prior._map(kind,actual[kind])
            for key,row in expected.items():
                if row['name'] in prior.MANAGED_PREDICATES and key in observed:
                    for role,inherits_auth in NEW_ROLES.items():
                        value=bool(observed[key]['public_execute'] or inherits_auth and observed[key]['execute']['authenticated'])
                        if row['execute'][role]!=value:derived+=1
                        row['execute'][role]=value
        if kind=='roles' and schema_defaults is not None:
            require(set(schema_defaults)=={'eps','public','auth','storage','extensions'})
            for role,inherits_auth in NEW_ROLES.items():
                row=expected[(role,)];explicit={'eps','public'} if inherits_auth else {'eps'}
                for schema,flags in schema_defaults.items():
                    require(set(flags)=={'public_usage','public_create','authenticated_usage','authenticated_create'} and all(isinstance(v,bool) for v in flags.values()))
                    row['schema_usage'][schema]=schema in explicit or flags['public_usage'] or inherits_auth and flags['authenticated_usage']
                    row['schema_create'][schema]=flags['public_create'] or inherits_auth and flags['authenticated_create']
                require(not any(row['schema_create'].values()))
        if kind=='column_acls':
            table_rows=prior._map('table_acls',result['table_acls'])
            for column in actual['columns']:
                for role in NEW_ROLES:
                    key=(column['table'],column['name'],role)
                    if key not in expected:
                        table=table_rows[(column['table'],role)]
                        expected[key]={'table':column['table'],'column':column['name'],'role':role,**{name:table[name]for name in('select','insert','update','references')}}
        result[kind]=list(expected.values())
    for row in result['roles']:
        if row['name'] in NEW_ROLES:require(not any(row[name]for name in('login','inherit','superuser','bypass_rls','create_db','create_role','replication')))
    return result,derived
def compare_states(before,after,reference_before,reference_after):
    require(set(before)==set(after));require(after['versions']==before['versions']+[MIGRATION[:14]])
    require(reference_after['versions']==reference_before['versions']+[MIGRATION[:14]])
    unchanged=set(before)-{'catalog','versions','counts','data_sha256'}
    require(all(before[key]==after[key]for key in unchanged))
    require(set(after['counts'])==set(before['counts'])|NEW_TABLES and not(set(before['counts'])&NEW_TABLES))
    require(all(after['counts'][table]==count for table,count in before['counts'].items()))
    require(all(after['counts'][table]==0 for table in NEW_TABLES))
    require(set(after['data_sha256'])==set(before['data_sha256'])|NEW_TABLES)
    require(all(after['data_sha256'][table]==value for table,value in before['data_sha256'].items()))
    require(all(after['data_sha256'][table]==reference_after['data_sha256'][table]for table in NEW_TABLES))
    expected,derived=expected_catalog(before['catalog'],reference_before['catalog'],reference_after['catalog'],before.get('schema_defaults'))
    require(all(prior._map(kind,after['catalog'][kind])==prior._map(kind,expected[kind])for kind in CATALOG_KEYS))
    return {'business_rows_preserved':True,'exact_reviewed_catalog_delta':True,'runtime11_and_configuration_unchanged':True,
      'new_casting_tables_empty':True,'managed_auth_and_schema_defaults_preserved':'managed_auth'in before and 'schema_defaults'in before,
      'managed_storage_derived_flags':derived,'managed_storage_absent_local_fixture_rows':[list(key)for key in sorted(prior.ABSENT_LOCAL_STORAGE_ROWS)if tuple(key[1:])not in prior._map(key[0],before['catalog'][key[0]])]}
def current_release_inputs():
    require((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
    config=tomllib.loads((ROOT/'supabase/config.toml').read_text());require(config['db']['migrations']['enabled']is True and config['db']['seed']['enabled']is False)
    for file,digest in {BASELINE:BASELINE_SHA,PROOF:PROOF_SHA,PROMOTION:PROMOTION_SHA,RACE:RACE_SHA,READBACK:READBACK_SHA,'development/local-db/reviewed.json':MANIFEST_SHA,**DEPENDENCIES}.items():sealed(file,digest)
    manifest=read_json('development/local-db/reviewed.json');baseline=read_json(BASELINE)
    require(len(manifest['migrations'])==20 and len(baseline['migrations'])==19 and manifest['migrations'][:-1]==baseline['migrations'])
    require(manifest['migrations'][-1]['path']=='supabase/migrations/'+MIGRATION and manifest['migrations'][-1]['sha256']==MIGRATION_SHA)
    names=sorted(file.name for file in(ROOT/'supabase/migrations').glob('*.sql'));require(names==[Path(row['path']).name for row in manifest['migrations']])
    for row in manifest['migrations']:require(row['reviewed_by']and row['reviewed_at']);sealed(row['path'],row['sha256'])
    proof=read_json(PROOF);promotion=read_json(PROMOTION)
    require(proof['result']=='passed' and proof['cloud_called']is False and proof['provider_called']is False and proof['hosted_credential_files_read']is False)
    require(all(proof[key]is True for key in('rollback_verified','sources_stable','assertions_passed','owned_backend_settled','lifecycle_behavior_tested','preexisting_rows_configs_and_runtime_preserved_in_draft')))
    require(proof['before']==proof['after'] and proof['managed_auth_before']==proof['managed_auth_after'] and len(proof['markers'])==8 and proof['migration_sha256']==MIGRATION_SHA)
    for file,digest in proof['source_seals'].items():
        if file=='development/local-db/reviewed.json':require(digest==BASELINE_SHA)
        else:sealed(file,digest)
    sealed('tools/test-m04-casting-migration-local.mjs',proof['harness_sha256'])
    require(promotion['result']=='passed' and promotion['cloud_called']is False and promotion['provider_called']is False and promotion['migration_sha256']==MIGRATION_SHA)
    require(promotion['proof_sha256']==PROOF_SHA and promotion['business_and_old_catalog_preserved']is True and promotion['managed_auth_preserved']is True and promotion['managed_auth_before']==promotion['managed_auth_after'])
    require(promotion['before']==proof['before']and promotion['after']==proof['expected']);sealed('tools/promote-m04-casting-local.mjs',promotion['harness_sha256'])
    compare_states(proof['before'],proof['expected'],proof['before'],proof['expected'])
    race=read_json(RACE);require(race['result']=='passed'and race['cloud_called']is False and race['provider_called']is False)
    return {'migration':MIGRATION,'migration_sha256':MIGRATION_SHA,'manifest_sha256':MANIFEST_SHA,'proof':PROOF,'proof_sha256':PROOF_SHA,
      'promotion':PROMOTION,'promotion_sha256':PROMOTION_SHA,'race':RACE,'race_sha256':RACE_SHA,'readback_sha256':READBACK_SHA,
      'versions':[name[:14]for name in names],'dependencies':DEPENDENCIES,'helper_sha256':sha(Path(__file__).read_bytes())}
def private_write(file,data):
    from provision_logo_verifier import WindowsPrivateFiles
    PRIVATE.mkdir(parents=True,exist_ok=True);security=WindowsPrivateFiles()
    with security.create(file)as handle:handle.write(data);handle.flush();os.fsync(handle.fileno());security.verify_open(handle)
def call(arguments):
    label=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%f')+'-'+uuid.uuid4().hex[:8]
    try:result=cli_call(arguments)
    except subprocess.TimeoutExpired as error:
        for stream in('stdout','stderr'):
            value=getattr(error,stream,None)or b'';private_write(PRIVATE/(label+'.'+stream),value.encode()if isinstance(value,str)else value)
        raise ValueError('M04_CASTING_CLI_UNCONFIRMED')from None
    for stream in('stdout','stderr'):private_write(PRIVATE/(label+'.'+stream),getattr(result,stream).encode())
    return result
def inspect_state():
    sealed(READBACK,READBACK_SHA)
    result=call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT/READBACK),'--output-format','json']);require(result.returncode==0)
    rows=json.loads(result.stdout)['rows'];require(len(rows)==1 and set(rows[0])=={'m04_casting_release'})
    state=rows[0]['m04_casting_release'];require(state['query_role']=='postgres'and state['database']=='postgres'and state['unrestricted_visibility']is True)
    runtime=copy.deepcopy(state['runtime']);require({name.replace(' ','')for name in runtime['execute']}==prior.OPERATIONS)
    replay='eps.claim_job_stage_replay(jsonb, text, text, text)';require(runtime['execute'].count(replay)==1);runtime['execute'].remove(replay)
    try:prior.validate_ten_runtime(runtime)
    except prior.Blocked:raise ValueError('M04_CASTING_RUNTIME_UNCONFIRMED')from None
    require(state['protected_m02']['job_exists']is True and state['protected_m02']['manual_note_retained']is True and state['protected_m02']['source_inputs_count']>=1)
    require(isinstance(state['managed_auth'],dict)and isinstance(state['schema_defaults'],dict))
    return state
def pending_migrations(text):return sorted(set(re.findall(r'\d{14}_[A-Za-z0-9_]+\.sql',text)))
def validate_pending(text):require(pending_migrations(text)==[MIGRATION])
def push_command(dry_run):return ['db','push','--linked','--project-ref',TARGET,'--skip-vault','--yes','--output-format','json']+(['--dry-run']if dry_run else [])
def refuse_repeat_apply():require(not CLAIM.exists()and not any(EVIDENCE.glob('*-apply-attempt.json')))
def retain(receipt,suffix):
    EVIDENCE.mkdir(parents=True,exist_ok=True);file=EVIDENCE/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+uuid.uuid4().hex[:8]+'-'+suffix+'.json')
    with file.open('x',encoding='utf8')as h:json.dump(receipt,h,indent=2);h.write('\n');h.flush();os.fsync(h.fileno())
    return file.relative_to(ROOT).as_posix()
def main(arguments=None):
    arguments=sys.argv[1:]if arguments is None else arguments;require(len(arguments)<=1)
    action=arguments[0]if arguments else'dry-run';require(action in('inspect','dry-run','apply','readback'))
    receipt={'action':action,'target':TARGET,'migration':MIGRATION,'migration_sha256':MIGRATION_SHA,'result':'failed','dispatch_attempted':False,'automatic_retry':False,'provider_called':False,'flags_changed':False,'identity_provisioned':False,'seeds':False,'vault_sync':False,'hosting_deferred':True}
    try:
        inputs=current_release_inputs();receipt['inputs']=inputs;proof=read_json(PROOF);before=inspect_state();receipt['before']=before;versions=inputs['versions'];require(before['versions']in(versions[:-1],versions))
        if action=='inspect':receipt['readback']=before
        elif action=='readback':
            require(before['versions']==versions);claim=read_json(CLAIM.relative_to(ROOT).as_posix())
            require(claim['target']==TARGET and claim['migration_sha256']==MIGRATION_SHA and claim['inputs_sha256']==canonical(inputs))
            file=Path(claim['attempt_receipt']);require(file.parent.as_posix()=='tracking/evidence/cloud-m04-casting'and file.name.endswith('-apply-attempt.json'))
            attempt=read_json(file);require(canonical(attempt['before'])==claim['before_sha256'])
            receipt['before']=attempt['before'];receipt['readback']=before;receipt['comparison']=compare_states(attempt['before'],before,proof['before'],proof['expected'])
        else:
            require(before['versions']==versions[:-1]);expected_catalog(before['catalog'],proof['before']['catalog'],proof['expected']['catalog'],before['schema_defaults'])
            if action=='apply':
                refuse_repeat_apply();dry=read_json('tracking/evidence/cloud-m04-casting/dry-run.json');age=(datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(dry['finished_at'])).total_seconds()
                require(dry['result']=='passed'and dry['inputs']==inputs and dry['before']==before and dry['pending_migrations']==[MIGRATION]and 0<=age<=900)
            receipt['attempt_receipt']=retain(receipt,action+'-attempt')
            if action=='apply':private_write(CLAIM,(json.dumps({'target':TARGET,'migration_sha256':MIGRATION_SHA,'inputs_sha256':canonical(inputs),'before_sha256':canonical(before),'attempt_receipt':receipt['attempt_receipt'],'dispatch_may_have_occurred':True})+'\n').encode())
            require(current_release_inputs()==inputs)
            if action=='apply':receipt['dispatch_attempted']=True
            result=call(push_command(action=='dry-run'));receipt['exit_code']=result.returncode;receipt['pending_migrations']=pending_migrations(result.stdout+'\n'+result.stderr);after=inspect_state();receipt['readback']=after
            if action=='apply':receipt['comparison']=compare_states(before,after,proof['before'],proof['expected'])
            else:require(before==after)
            require(result.returncode==0);validate_pending(result.stdout+'\n'+result.stderr)
        receipt['application_verified_by_readback']=action in('apply','readback');receipt['runtime_execute_operations']=11;receipt['result']='passed'
    except Exception:
        receipt['reason']='Fixed20 release unconfirmed. Preserve intent/history/readback and reconcile read-only before any repeat mutation.';raise
    finally:
        receipt['finished_at']=datetime.datetime.now(datetime.timezone.utc).isoformat();file=retain(receipt,action)
        if action=='dry-run'and receipt['result']=='passed':
            temporary=EVIDENCE/('dry-'+uuid.uuid4().hex+'.tmp');temporary.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8');os.replace(temporary,EVIDENCE/'dry-run.json')
        print(json.dumps({'result':receipt['result'],'receipt':file,'application_verified_by_readback':receipt.get('application_verified_by_readback',False),'automatic_retry':False}))
if __name__=='__main__':
    try:main()
    except Exception:sys.stderr.write('Fixed20 release stopped; raw diagnostics remain private. No automatic retry.\n');sys.exit(1)
