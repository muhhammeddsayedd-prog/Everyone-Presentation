"""Fixed reviewed16->17 candidate pipeline. Root invokes; no auto retry/enablement.

Fresh baselines preserve real specs jobs, library records and enrollment. The
exact composed-local delta is applied only to reviewed catalog leaves. No
provider/native/Storage byte acceptance is claimed by this release helper.
"""
import copy,datetime,hashlib,json,os,re,subprocess,sys,tomllib,uuid
from pathlib import Path
from release_foundation import ROOT,TARGET,call as cli_call
from release_specs_read_operation import validate_runtime as validate_ten_operation_runtime,Blocked
MIGRATION='20261029100500_m03_candidate_pipeline.sql'
SEAL='4af04b4a3fb050e39aa23958c3f82e304cc7d7a1f450a5d93f7f50bc001bd836'
READBACK='tools/sql/candidate-pipeline-readback.sql'
PROOF='tracking/evidence/m03/kernel-local/2026-10-29T10-17-45-307Z-cfce26d3.json'
PREVIEW='tracking/evidence/m03/kernel-catalog/2026-10-29T10-20-30-781Z-5b008cdd.json'
PROMOTION='tracking/evidence/m03/kernel-promotion/2026-10-29T10-22-38-271Z-7d5268d8.json'
BRIDGE='tools/compare-m03-kernel-states.mjs'
FILES={READBACK:'4bfaa7da1b96a4bb5c4dcea198ce56bb4b05aaaf64815b2dae1243c4ee2abbc9',
 PROOF:'dd2268f96c94107266229b1b05c43e8f81492782e2e93ce1a315995719a39fc7',
 PREVIEW:'4d9d66c35f7419056365df954c6ee3fd9024b53ff2749d228cebfb8b3b2badc3',
 PROMOTION:'85808c54d0d18dd1752511dfb908d2dd6bcc0b408ea0fdfc01a8396677383791',
 BRIDGE:'b70ac7534483fad81ab3f6ec26a803126261822946f090ae4073977d16b42d8e',
 'tools/lib/candidate-pipeline-comparison.mjs':'7cc3e53bf50a99770890e49a2fd0d0b67b57aab69dc4ad5a561737d9378fc6e7',
 'tools/release_specs_read_operation.py':'a68be68c78bb20b59216e5aabd9b568bb0d46ef9fd35097ceb78392f85ad304e',
 'tracking/evidence/m03/kernel-preparation/migration17-source.json':'0b1a420b4d502c86cd5408a0228bab5571de796ac6a24dd72f69550f10869909',
 'development/local-db/reviewed.json':'f4ae3d8ba1169ae9f89ee16c1d8b922edaf6a5bea2e8ad56c5a5194ef8aadfdb'}
OPERATIONS={'eps.claim_job_stage(jsonb)','eps.get_specs_stage_input(uuid,uuid,text)',
 'eps.record_job_event(jsonb)','eps.recover_job_stages(integer)','eps.claim_job_outbox(integer)',
 'eps.finish_job_outbox(uuid,text,boolean)','eps.get_job_asset_access(jsonb)',
 'eps.reserve_job_output(jsonb)','eps.complete_job_output(jsonb)','eps.store_specs_preparation(jsonb)',
 'eps.claim_job_stage_replay(jsonb,text,text,text)'}
EVIDENCE=ROOT/'tracking/evidence/cloud-candidate-pipeline'

def require(value):
    if not value:raise ValueError('CANDIDATE_PIPELINE_RELEASE_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def canonical(value):return sha(json.dumps(value,sort_keys=True,separators=(',',':')).encode())
def read_json(file):return json.loads((ROOT/file).read_bytes())
def compare(before,after):
    # Metadata only, shell disabled. Diagnostics contain no row payloads and are
    # not forwarded. The bridge and imported comparator are pinned above.
    result=subprocess.run(['node',str(ROOT/BRIDGE)],input=json.dumps({'before':before,'after':after}),capture_output=True,text=True,encoding='utf8',cwd=ROOT,timeout=30)
    require(result.returncode==0 and json.loads(result.stdout)=={'comparison':'passed'})

def prerequisites():
    require((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
    config=tomllib.loads((ROOT/'supabase/config.toml').read_text());require(config['db']['migrations']['enabled'] is True and config['db']['seed']['enabled'] is False)
    for file,seal in FILES.items():require(sha((ROOT/file).read_bytes())==seal)
    manifest=read_json('development/local-db/reviewed.json');require(len(manifest['migrations'])==17)
    names=sorted(p.name for p in (ROOT/'supabase/migrations').glob('*.sql'));require(names==[Path(row['path']).name for row in manifest['migrations']])
    for row in manifest['migrations']:require(row['reviewed_by'] and row['reviewed_at'] and sha((ROOT/row['path']).read_bytes())==row['sha256'])
    require(names[-1]==MIGRATION and sha((ROOT/'supabase/migrations'/MIGRATION).read_bytes())==SEAL)
    proof,preview,promotion=read_json(PROOF),read_json(PREVIEW),read_json(PROMOTION)
    require(proof['result']=='passed' and proof['rollback_verified'] and proof['sources_stable'] and proof['assertions_passed'] and proof['cloud_called'] is False and proof['provider_called'] is False)
    for file,seal in proof['source_seals'].items():require(sha((ROOT/file).read_bytes())==seal)
    require(preview['result']=='passed' and preview['rollback_verified'] and preview['sources_stable'] and preview['migration_sha256']==SEAL)
    require(promotion['result']=='passed' and promotion['business_and_old_catalog_preserved'] and promotion['migration_sha256']==SEAL and promotion['cloud_called'] is False)
    compare(promotion['before'],promotion['after'])
    return {'migration_sha256':SEAL,'reviewed_files':FILES},[name[:14] for name in names[:-1]]

def call(arguments):
    result=cli_call(arguments);directory=ROOT/'.local/cloud-candidate-pipeline';directory.mkdir(parents=True,exist_ok=True)
    label=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%f')+'-'+uuid.uuid4().hex[:8]
    for stream in ('stdout','stderr'):(directory/(label+'.'+stream)).write_text(getattr(result,stream),encoding='utf8')
    return result

def inspect():
    result=call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT/READBACK),'--output-format','json']);require(result.returncode==0)
    rows=json.loads(result.stdout)['rows'];require(len(rows)==1 and set(rows[0])=={'candidate_pipeline_release'})
    state=rows[0]['candidate_pipeline_release'];require(state['query_role']=='postgres' and state['database']=='postgres' and state['unrestricted_visibility'] is True)
    runtime=state['runtime'];require(isinstance(runtime,dict))
    require({value.replace(' ','') for value in runtime['execute']}==OPERATIONS)
    # Reuse the proven NOINHERIT role / INHERIT membership / exact managed
    # incoming-edge, connection, expiry and private-logging checks. Remove only
    # the exact known11th operation from a copy, never from the actual identity.
    base=copy.deepcopy(runtime);replay='eps.claim_job_stage_replay(jsonb, text, text, text)'
    require(base['execute'].count(replay)==1);base['execute'].remove(replay)
    try:validate_ten_operation_runtime(base)
    except Blocked:raise ValueError('CANDIDATE_PIPELINE_RUNTIME_UNCONFIRMED') from None
    return state

def retain(receipt,suffix):
    EVIDENCE.mkdir(parents=True,exist_ok=True);file=EVIDENCE/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+uuid.uuid4().hex[:8]+'-'+suffix+'.json')
    file.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8');return file.relative_to(ROOT).as_posix()

def main():
    action=sys.argv[1] if len(sys.argv)==2 else '';require(action in ('dry-run','apply','readback'))
    inputs,versions=prerequisites();receipt={'action':action,'target':TARGET,'inputs':inputs,'result':'failed','dispatch_attempted':False,'automatic_retry':False,'provider_called':False,'native_media_tested':False,'identity_provisioned':False,'flags_changed':False,'seeds':False}
    try:
        before=inspect();receipt['before']=before;require(before['versions'] in (versions,versions+[MIGRATION[:14]]))
        if action=='readback':
            baseline=read_json('tracking/evidence/cloud-candidate-pipeline/dry-run.json')['before'];compare(baseline,before);receipt['application_verified_by_readback']=True
        else:
            require(before['versions']==versions)
            if action=='apply':
                dry=read_json('tracking/evidence/cloud-candidate-pipeline/dry-run.json');age=(datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(dry['finished_at'])).total_seconds()
                require(dry['result']=='passed' and canonical(dry['inputs'])==canonical(inputs) and dry['before']==before and 0<=age<=3600)
            receipt['attempt_receipt']=retain(receipt,action+'-attempt');command=['db','push','--linked','--project-ref',TARGET,'--skip-vault','--yes','--output-format','json']
            if action=='dry-run':command.append('--dry-run')
            receipt['dispatch_attempted']=action=='apply';result=call(command);receipt['exit_code']=result.returncode
            pending=sorted(set(re.findall(r'\d{14}_[A-Za-z0-9_]+\.sql',result.stdout+'\n'+result.stderr)));receipt['pending_migrations']=pending
            after=inspect();receipt['readback']=after
            if action=='apply':compare(before,after);receipt['application_verified_by_readback']=True
            else:require(before==after)
            require(result.returncode==0 and pending==[MIGRATION])
        receipt['result']='passed'
    except Exception:
        receipt['reason']='Fixed candidate17 release unconfirmed. Inspect retained history/readback before any repeat mutator.';raise
    finally:
        receipt['finished_at']=datetime.datetime.now(datetime.timezone.utc).isoformat();file=retain(receipt,action)
        if action=='dry-run' and receipt['result']=='passed':
            temporary=EVIDENCE/('dry-'+uuid.uuid4().hex+'.tmp');temporary.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8');os.replace(temporary,EVIDENCE/'dry-run.json')
        print(json.dumps({'result':receipt['result'],'receipt':file,'application_verified_by_readback':receipt.get('application_verified_by_readback',False),'automatic_retry':False}))
if __name__=='__main__':
    try:main()
    except Exception:sys.stderr.write('Fixed candidate pipeline release stopped; raw diagnostics remain private.\n');sys.exit(1)
