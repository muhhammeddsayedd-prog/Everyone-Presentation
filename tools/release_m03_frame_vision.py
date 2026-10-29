"""Fixed reviewed20->21 image-aware frame-selection release. No import-time IO.

Root executes explicitly. One durable apply claim precedes dispatch. Unknown
outcomes require read-only reconciliation; no target/SQL/force/retry options.
"""
import copy,datetime,hashlib,json,os,re,subprocess,sys,tomllib,uuid
from pathlib import Path
from release_foundation import ROOT,TARGET,call as cli_call
import release_m03_remaining as prior

MIGRATION='20261029180953_m03_frame_vision_selection.sql'
MIGRATION_SHA='bcd12794eccfa590e5d160f62dfd67838c8186376cddda1952f291c50d03bec8'
MANIFEST_SHA='1ecec87384926fea82b433d3ddfde386f64d09c17a946ac2aa6fd51b4831dedc'
BASELINE='tracking/evidence/m04/migration-preparation/reviewed20-manifest.json'
BASELINE_SHA='f8e9c48d19a66b38b81eee6f6a7d10e01d8604a9aed9e60e0de1f0f1dc610f14'
PROOF='tracking/evidence/m03/frame-vision-local/2026-10-29T18-35-46-743Z-9826d8e6.json'
PROOF_SHA='4f372cacb8453f9f5045d546dba0ae53d1f7bf78863afaeb7eef603f180e9452'
PROMOTION='tracking/evidence/m03/frame-vision-promotion/2026-10-29T18-41-31-828Z-a531b6a9.json'
PROMOTION_SHA='c7fe4292af6be4fa1059197111911015d5feda2f445d8cbc40130645e47e5603'
READBACK='tools/sql/m04-casting-readback.sql'
READBACK_SHA='13cc727a2e2e34321c6bbee2c98a3b7c85af88445fe1a1effd067d895fe5456f'
DEPENDENCIES={'tools/release_foundation.py':'02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751',
 'tools/release_m03_remaining.py':'5a608e480c7afb56a1b49c7a683c238d950301c589c1ff91348368f486995b7e',
 'tools/release_specs_read_operation.py':'a68be68c78bb20b59216e5aabd9b568bb0d46ef9fd35097ceb78392f85ad304e',
 'tools/provision_logo_verifier.py':'660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c',
 'tools/local-postgres.mjs':'49929bce8eb51194d9299cfd9639e537eb237daaec76c15740cb88059604e2de'}
FUNCTIONS=('eps.candidate_validate_stage(eps.jobs, text, jsonb)','eps.get_candidate_stage_input(uuid, uuid, text)','eps.apply_candidate_scan(uuid, uuid, text, text, jsonb)')
PRIVATE=ROOT/'.local/cloud-m03-frame-vision'
EVIDENCE=ROOT/'tracking/evidence/cloud-m03-frame-vision'
CLAIM=PRIVATE/'apply.claim.json'

def require(value):
    if not value:raise ValueError('M03_FRAME_VISION_RELEASE_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def canonical(value):return sha(json.dumps(value,sort_keys=True,separators=(',',':')).encode())
def read_json(relative):return json.loads((ROOT/relative).read_bytes())
def sealed(relative,digest):
    require(isinstance(relative,str) and isinstance(digest,str) and re.fullmatch('[a-f0-9]{64}',digest))
    file=ROOT/relative;require(file.resolve()==file and not file.is_symlink() and sha(file.read_bytes())==digest)
def compare_states(before,after,reference_before,reference_after):
    require(set(before)==set(after));require(after['versions']==before['versions']+[MIGRATION[:14]])
    require(reference_after['versions']==reference_before['versions']+[MIGRATION[:14]])
    masked=copy.deepcopy(after);masked['versions']=before['versions']
    changes=[]
    for signature in FUNCTIONS:
        old=next((r for r in before['catalog']['functions']if r['signature']==signature),None)
        current=next((r for r in masked['catalog']['functions']if r['signature']==signature),None)
        proven_old=next((r for r in reference_before['catalog']['functions']if r['signature']==signature),None)
        proven_new=next((r for r in reference_after['catalog']['functions']if r['signature']==signature),None)
        require(old and current and proven_old and proven_new)
        require(old['source_sha256']==proven_old['source_sha256'] and current['source_sha256']==proven_new['source_sha256'] and old['source_sha256']!=current['source_sha256'])
        changes.append({'signature':signature,'before_sha256':old['source_sha256'],'after_sha256':current['source_sha256']});current['source_sha256']=old['source_sha256']
    old_check=next((r for r in before['catalog']['constraints']if r['table']=='eps.candidate_media'and r['name']=='candidate_media_processing_issues_check'),None)
    next_check=next((r for r in masked['catalog']['constraints']if r['table']=='eps.candidate_media'and r['name']=='candidate_media_processing_issues_check'),None)
    reference_check=next((r for r in reference_after['catalog']['constraints']if r['table']=='eps.candidate_media'and r['name']=='candidate_media_processing_issues_check'),None)
    require(old_check and next_check and reference_check and sha(old_check['definition'].encode())=='60cae19b6b16531e21d2b1f3b1c4c096b3c980e4d5bfd788953dee0bbbff76f2')
    require(next_check['definition']==reference_check['definition']and sha(next_check['definition'].encode())=='eecd0bd7a085000d9bf9b23ebefa49f7683e4a5325e7acae08bdec23a27b6e38')
    next_check['definition']=old_check['definition'];require(masked==before)
    return {'business_rows_and_media_pins_preserved':True,'only_three_function_bodies_and_one_check_changed':True,
      'all_other_catalog_and_runtime11_preserved':True,'managed_auth_and_schema_defaults_preserved':True,'changed_functions':changes}
def current_release_inputs():
    require(isinstance(MANIFEST_SHA,str)and isinstance(PROMOTION,str)and isinstance(PROMOTION_SHA,str))
    require((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
    config=tomllib.loads((ROOT/'supabase/config.toml').read_text());require(config['db']['migrations']['enabled']is True and config['db']['seed']['enabled']is False)
    for file,digest in {BASELINE:BASELINE_SHA,PROOF:PROOF_SHA,PROMOTION:PROMOTION_SHA,READBACK:READBACK_SHA,'development/local-db/reviewed.json':MANIFEST_SHA,**DEPENDENCIES}.items():sealed(file,digest)
    manifest=read_json('development/local-db/reviewed.json');baseline=read_json(BASELINE)
    require(len(manifest['migrations'])==21 and len(baseline['migrations'])==20 and manifest['migrations'][:-1]==baseline['migrations'])
    require(manifest['migrations'][-1]['path']=='supabase/migrations/'+MIGRATION and manifest['migrations'][-1]['sha256']==MIGRATION_SHA)
    names=sorted(file.name for file in(ROOT/'supabase/migrations').glob('*.sql'));require(names==[Path(row['path']).name for row in manifest['migrations']])
    for row in manifest['migrations']:require(row['reviewed_by']and row['reviewed_at']);sealed(row['path'],row['sha256'])
    proof=read_json(PROOF);promotion=read_json(PROMOTION)
    require(proof['result']=='passed' and proof['cloud_called']is False and proof['provider_called']is False and proof['hosted_credential_files_read']is False)
    require(all(proof[key]is True for key in('red_reproduced','red_rollback_verified','rollback_verified','sources_stable','assertions_passed','owned_backend_settled','only_three_function_bodies_and_one_check_changed')))
    require(proof['before']==proof['after'] and len(proof['markers'])==1 and proof['migration_sha256']==MIGRATION_SHA)
    for file,digest in proof['source_seals'].items():
        if file=='development/local-db/reviewed.json':require(digest==BASELINE_SHA)
        else:sealed(file,digest)
    sealed('tools/test-m03-frame-vision-local.mjs',proof['harness_sha256'])
    require(promotion['result']=='passed' and promotion['cloud_called']is False and promotion['provider_called']is False and promotion['migration_sha256']==MIGRATION_SHA)
    require(promotion['proof_sha256']==PROOF_SHA and promotion['business_and_old_catalog_preserved']is True)
    require(promotion['before']==proof['before']and promotion['after']==proof['expected']);sealed('tools/promote-m03-frame-vision-local.mjs',promotion['harness_sha256'])
    compare_states(proof['before'],proof['expected'],proof['before'],proof['expected'])
    return {'migration':MIGRATION,'migration_sha256':MIGRATION_SHA,'manifest_sha256':MANIFEST_SHA,'proof':PROOF,'proof_sha256':PROOF_SHA,
      'promotion':PROMOTION,'promotion_sha256':PROMOTION_SHA,'readback_sha256':READBACK_SHA,
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
        raise ValueError('M03_FRAME_VISION_CLI_UNCONFIRMED')from None
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
    except prior.Blocked:raise ValueError('M03_FRAME_VISION_RUNTIME_UNCONFIRMED')from None
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
    receipt={'action':action,'target':TARGET,'migration':MIGRATION,'migration_sha256':MIGRATION_SHA,'result':'failed','dispatch_attempted':False,'automatic_retry':False,'provider_called':False,'flags_changed':False,'identity_provisioned':False,'native_image_changed':False,'n8n_changed':False,'seeds':False,'vault_sync':False,'hosting_deferred':True}
    try:
        inputs=current_release_inputs();receipt['inputs']=inputs;proof=read_json(PROOF);before=inspect_state();receipt['before']=before;versions=inputs['versions'];require(before['versions']in(versions[:-1],versions))
        if action=='inspect':receipt['readback']=before
        elif action=='readback':
            require(before['versions']==versions);claim=read_json(CLAIM.relative_to(ROOT).as_posix())
            require(claim['target']==TARGET and claim['migration_sha256']==MIGRATION_SHA and claim['inputs_sha256']==canonical(inputs))
            file=Path(claim['attempt_receipt']);require(file.parent.as_posix()=='tracking/evidence/cloud-m03-frame-vision'and file.name.endswith('-apply-attempt.json'))
            attempt=read_json(file);require(canonical(attempt['before'])==claim['before_sha256'])
            receipt['before']=attempt['before'];receipt['readback']=before;receipt['comparison']=compare_states(attempt['before'],before,proof['before'],proof['expected'])
        else:
            require(before['versions']==versions[:-1]);require(all(next(r for r in before['catalog']['functions']if r['signature']==signature)['source_sha256']==next(r for r in proof['before']['catalog']['functions']if r['signature']==signature)['source_sha256']for signature in FUNCTIONS))
            if action=='apply':
                refuse_repeat_apply();dry=read_json('tracking/evidence/cloud-m03-frame-vision/dry-run.json');age=(datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(dry['finished_at'])).total_seconds()
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
        receipt['reason']='Fixed21 release unconfirmed. Preserve intent/history/readback and reconcile read-only before any repeat mutation.';raise
    finally:
        receipt['finished_at']=datetime.datetime.now(datetime.timezone.utc).isoformat();file=retain(receipt,action)
        if action=='dry-run'and receipt['result']=='passed':
            temporary=EVIDENCE/('dry-'+uuid.uuid4().hex+'.tmp');temporary.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8');os.replace(temporary,EVIDENCE/'dry-run.json')
        print(json.dumps({'result':receipt['result'],'receipt':file,'application_verified_by_readback':receipt.get('application_verified_by_readback',False),'automatic_retry':False}))
if __name__=='__main__':
    try:main()
    except Exception:sys.stderr.write('Fixed21 release stopped; raw diagnostics remain private. No automatic retry.\n');sys.exit(1)
