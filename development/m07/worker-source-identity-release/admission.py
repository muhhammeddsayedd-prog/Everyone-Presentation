"""Pure release-anchor admission only; no transport, private I/O or execution."""
import copy,hashlib,json

EXECUTION_ENABLED=False
TARGET='pyibofyctwnqpvktepse'
VERSION='20261102085405'
MIGRATION_SHA='08bf4de8a63823b0e7c9aee75560a6e7de0620eb9b8b3c483c65929578db8212'
APPLY={'path':'tracking/evidence/m07/review-link-reason40-canonical-release/2026-11-02T16-28-48-678533Z-apply.json','sha256':'e04cca3019363a5e9bdcc46790118e23d939dc0e893fb56bb708d8823451a6cf'}
APPLY_CONTENT_SHA='36d9475de97e6c97bf2051e1e2dea2927d60c6bdbbf112e0ecf80a854b59fde3'
FUNCTIONAL={'path':'tracking/evidence/m07/review-link-reason40-preparing-proof/2026-11-02T10-22-01.195Z-51a83db4.json','sha256':'d79b1938472a0d943c3c7e993bffeaeff1c51d78a73454e092b16767dbfd4060'}
COLLECTOR={'path':'tracking/evidence/m07/reason40-collector-validation/2026-11-02T15-57-52.741Z-bd221d39.json','sha256':'4b25872ffe84758d98acfce52c2d0b95da6476d05749bbef15b696ccdb90c3dd'}
CHECKPOINT={'path':'.local/review-link-reason40-canonical-release/c1e984fa-965b-48fa-8ace-188233f30874/after-checkpoint.json','sha256':'981510d1dde26df882a4dbac3faaf9c54eb5df529bd387be789daa462897544e','history_path':['state','history'],'scope':'after_apply','tables':76,'restore_verified':False}
OLD={'deployment_id':'dpl_Cp1TW1vP3JiLJoL5G3Zx2yfei97M','source_sha256':'0566342ec367efef328885aac513adeb5a942048ba01c88e1af63e4d636b6730','native_digest':'sha256:46de2f0c0772e10d712fba514788d24041d6741faa8966b6fe9c554fe47e4af4','daemon_digest':'sha256:2d66eed2c5f584f3f261d2f241062cbb9fa088bbbc32437aed1ce0b6adf2c594','manifest_sha256':'a317b0c7398ab12d960271f9d9d8ce98d846ed390a77fc0bb02c50b9b6df9943'}
PUBLIC_DIGESTS=('EPS_DAEMON_SOURCE_SHA256','EPS_NATIVE_COMPATIBILITY_SHA256')
PHASES=('prepare','pause','env','deploy','ready','pin','resume')
PRIVATE_NAMESPACE='.local/worker-source-identity-release'
EVIDENCE_NAMESPACE='tracking/evidence/m07/worker-source-identity-release'
CLAIMS=('native-export','daemon-export','native-oci-prepare','daemon-oci-prepare','native-registry','daemon-registry','native-probe','prepare','pause','env','deploy','pin','resume')

def need(value):
 if not value:raise ValueError('WORKER_IDENTITY_RELEASE_ANCHOR_REFUSED')

def canonical40(value):
 need(hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()==APPLY_CONTENT_SHA)
 need(type(value)is dict and value.get('result')=='passed'and value.get('target')==TARGET and value.get('version')==VERSION and value.get('migration_sha256')==MIGRATION_SHA)
 need(value.get('normal_return_marker_observed')is True and value.get('two_independent_readbacks_equal')is True and value.get('first')==value.get('second'))
 state=value['first'];need(type(state)is dict and type(state.get('history'))is list and len(state['history'])==40 and state['history'][-1]==VERSION)
 need(value.get('local_proof')==FUNCTIONAL and value.get('admission',{}).get('local_proof')==FUNCTIONAL and value['admission'].get('collector_validation')==COLLECTOR)
 need(value.get('checkpoint')==CHECKPOINT and value.get('private_checkpoint_is_restore_proof')is False)
 return {'canonical_apply':copy.deepcopy(APPLY),'canonical_apply_content_sha256':APPLY_CONTENT_SHA,'functional_sql40_proof':copy.deepcopy(FUNCTIONAL),'collector_validation':copy.deepcopy(COLLECTOR),'after_apply_checkpoint':copy.deepcopy(CHECKPOINT),'history':copy.deepcopy(state['history'])}

def draft(value):
 return {'purpose':'first_worker_separate_source_identity_release','execution_enabled':False,'operations_implemented':False,'canonical':canonical40(value),'old_worker_anchor':copy.deepcopy(OLD),
  'final_Main_source':None,'native_build':None,'daemon_build':None,'new_native_ready':None,'new_native_probe':None,'current40_worker_SQL_proof':None,'new_startup_observer':None,
  'required_new_public_digests':list(PUBLIC_DIGESTS),'phase_order':list(PHASES),'fresh_prepare_checkpoint_required':True,'historical_checkpoint_is_restore_proof':False,
  'private_namespace':PRIVATE_NAMESPACE,'evidence_namespace':EVIDENCE_NAMESPACE,'permanent_claim_namespaces':list(CLAIMS),'normal_return_markers_required':True,'env_has_separate_per_operation_claims':True,
  'rollback_or_AT069_operation_included':False,'automatic_replay':False,'source_archive_frozen':False}

if __name__=='__main__':
 # Deliberately refuses before any evidence/private file or provider access.
 print('{"result":"source_only_disabled","execution_enabled":false,"operations_implemented":false}');raise SystemExit(1)
