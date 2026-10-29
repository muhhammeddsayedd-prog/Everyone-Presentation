"""One fixed already-applied17 read-only reconciliation. No push/SQL mutation."""
import datetime,hashlib,json,subprocess,sys,uuid
import release_candidate_pipeline as release
ROOT=release.ROOT
FAILED='tracking/evidence/cloud-candidate-pipeline/2026-10-29T10-32-13-540642Z-e50f546a-apply.json'
FAILED_SEAL='99a982b357ff45cc7379fc4d317eec4dde78597a005199adc713669a3ac197a4'
BRIDGE='tools/compare-candidate17-reconciliation.mjs'
SEALS={BRIDGE:'b43f5372545eb289edac1b5afdd28be74dd121e808535305fa05d93437688924',
 'tools/lib/candidate17-storage-reconciliation.mjs':'e7a9029c369a18120e5e34e67288c7f4dd2188565fd17c9d2cc3f07fac2f5a73',
 'tools/release_candidate_pipeline.py':'e58629f8d402c7ed9c3cabafc3207b1c1cc29e9766c3b9cf199b6ebaf18be806'}
EVIDENCE=ROOT/'tracking/evidence/cloud-candidate-pipeline-reconciliation'
UI_ATTESTATION={'reported_by':'root integration owner from actual signed-in app',
 'workspace_id':'e470aefd-e0f7-480c-bf0d-170cb2cb7069','candidate_id':'b7341092-50c4-49b4-ad5f-a0ceedddebf1',
 'workspace_candidate_id':'ebe0ce53-5f42-4daa-9c46-4519ab18f383',
 'operations':['Add to project returned the participation ID','Save project choices clicked; may have committed after first readback'],
 'scope':'Post17 app mutations reported by root; app mutations paused for final reconciliation.'}
def sha(value):return hashlib.sha256(value).hexdigest()
def require(value):
    if not value:raise ValueError('FIXED_CANDIDATE17_RECONCILIATION_UNCONFIRMED')
def compare(before,after):
    result=subprocess.run(['node',str(ROOT/BRIDGE)],input=json.dumps({'before':before,'after':after}),capture_output=True,text=True,encoding='utf8',cwd=ROOT,timeout=30)
    require(result.returncode==0);value=json.loads(result.stdout)
    require(value['derived_boolean_count']==9 and value['cloud_grants_changed'] is False and len(value['managed_public_predicates'])==3)
    return value
def compare_current_deployment(applied,current):
    # At-apply row preservation is proved separately against the sealed apply
    # snapshot. Later root-attested app writes must not be blamed on migration.
    require({k:v for k,v in current.items() if k not in ('counts','data_sha256')}=={k:v for k,v in applied.items() if k not in ('counts','data_sha256')})
    require(set(current['counts'])==set(applied['counts']) and set(current['data_sha256'])==set(applied['data_sha256']))
    allowed={'eps.workspaces','eps.workspace_candidates','eps.audit_events','eps.idempotency_records'}
    drift=[]
    for table in current['counts']:
        old_count=applied['counts'][table];new_count=current['counts'][table]
        changed_hash=current['data_sha256'].get(table)!=applied['data_sha256'].get(table)
        if old_count!=new_count or changed_hash:
            require(table in allowed);drift.append({'table':table,'at_apply_count':old_count,'current_count':new_count,'fingerprint_changed':changed_hash})
    require({row['table'] for row in drift}==allowed)
    require(current['counts']['eps.workspaces']==applied['counts']['eps.workspaces'])
    require(current['counts']['eps.workspace_candidates']==applied['counts']['eps.workspace_candidates']+1)
    actions=current['counts']['eps.audit_events']-applied['counts']['eps.audit_events']
    require(actions in (1,2) and current['counts']['eps.idempotency_records']-applied['counts']['eps.idempotency_records']==actions)
    return {'deployment_catalog_runtime_config_unchanged_since_apply':True,'post_release_business_drift':drift,'root_attested_ui_operations':UI_ATTESTATION,'fresh_whole_business_unchanged':False}
def prerequisites():
    for file,seal in SEALS.items():require(sha((ROOT/file).read_bytes())==seal)
    require(sha((ROOT/FAILED).read_bytes())==FAILED_SEAL)
    inputs,versions=release.prerequisites();failed=release.read_json(FAILED)
    require(failed['result']=='failed' and failed['action']=='apply' and failed['dispatch_attempted'] is True and failed['exit_code']==0)
    require(failed['target']==release.TARGET and failed['inputs']==inputs and failed['pending_migrations']==[release.MIGRATION])
    require(failed['before']['versions']==versions and failed['readback']['versions']==versions+[release.MIGRATION[:14]])
    comparison=compare(failed['before'],failed['readback'])
    return inputs,failed,comparison
def main():
    require(sys.argv[1:]==['readback']);inputs,failed,retained=prerequisites()
    receipt={'action':'readback','target':release.TARGET,'result':'failed','migration':release.MIGRATION,'migration_sha256':release.SEAL,
      'original_failed_receipt':FAILED,'original_failed_receipt_sha256':FAILED_SEAL,'reviewed_inputs':inputs,
      'cloud_write_attempted':False,'migration_retry_attempted':False,'provider_called':False,'flags_changed':False,
      'retained_apply_reconciliation':retained}
    try:
        # The only cloud operation: existing sealed SELECT/READ ONLY snapshot,
        # through the already-reviewed runtime-identity inspecting wrapper.
        current=release.inspect();receipt['readback']=current
        receipt['at_apply_reconciliation']=retained
        receipt['reconciliation']=compare_current_deployment(failed['readback'],current)
        require(sha((ROOT/FAILED).read_bytes())==FAILED_SEAL)
        receipt['original_failed_receipt_preserved']=True
        receipt['application_verified_by_readback']=True
        receipt['candidate_configuration_disabled_verified']=True
        receipt['exact_runtime_function_operations']=len(current['runtime']['execute'])
        require(receipt['exact_runtime_function_operations']==11)
        receipt['result']='passed'
    finally:
        receipt['observed_at']=datetime.datetime.now(datetime.timezone.utc).isoformat()
        EVIDENCE.mkdir(parents=True,exist_ok=True);file=EVIDENCE/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+uuid.uuid4().hex[:8]+'.json')
        file.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8')
        print(json.dumps({'result':receipt['result'],'receipt':file.relative_to(ROOT).as_posix(),'cloud_write_attempted':False,'migration_retry_attempted':False}))
if __name__=='__main__':
    try:main()
    except Exception:sys.stderr.write('Fixed17 read-only reconciliation stopped; failed receipt remains preserved.\n');sys.exit(1)
