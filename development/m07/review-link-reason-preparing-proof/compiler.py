"""New disabled purpose after retained50f refusal; source compilation only."""
from pathlib import Path
import hashlib,importlib.util,json,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];PRIOR=HERE.parent/'review-link-reason'
PRIOR_COMPILER='b43b741235e176972d0981ced897ce3be512a58173fa1db43fcd3da13356d567'
PRIOR_PROOF='89c9e414e5cc8440656d0c6f1e1f7d22199bc891a13783d8b25c688ea484b483'
PRIOR_FIXTURE='ebd92fb2c4746c12912dd42a2458acc71a991d988df7dca61810b3497e01a49f'
FAILURE=ROOT/'tracking/evidence/m07/review-link-reason40-proof/2026-11-02T09-58-29.387Z-50f795f1.json'
FAILURE_SHA='68dae78e35ae1ca476eb125d38a933da13003dcceb7d15a10adc73661d6b7c27'
MIGRATION='supabase/migrations/20261102085405_m07_review_link_action_reason.sql';MIGRATION_SHA='08bf4de8a63823b0e7c9aee75560a6e7de0620eb9b8b3c483c65929578db8212'
def sha(raw):return hashlib.sha256(raw).hexdigest()
def need(value):
 if not value:raise ValueError('REASON40_PREPARING_COMPILATION_UNCONFIRMED')
def load(path):
 need(path.is_file()and not path.is_symlink()and path.resolve()==path and path.stat().st_nlink==1 and path.stat().st_size<16*1024**2);return path.read_bytes()
def compile_source(relative):
 for file,expected in [(PRIOR/'compiler.py',PRIOR_COMPILER),(PRIOR/'proof.mjs',PRIOR_PROOF),(PRIOR/'fixture.sql',PRIOR_FIXTURE),(FAILURE,FAILURE_SHA),(ROOT/MIGRATION,MIGRATION_SHA)]:need(sha(load(file))==expected)
 failure=json.loads(load(FAILURE));need(failure['result']=='failed'and failure['all_owned_resources_absent']is True and failure['original_data_catalogue_and_global_roles_unchanged']is True and failure['shared_lock_released']is True)
 spec=importlib.util.spec_from_file_location('frozen_reason40_first_compiler',PRIOR/'compiler.py');old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old);source=old.compile_source(relative)
 def replace(old,new):
  nonlocal source
  need(source.count(old)==1);source=source.replace(old,new)
 replace((PRIOR/'proof.mjs').as_uri(),(HERE/'proof.mjs').as_uri())
 replace(json.dumps(str(PRIOR/'proof.mjs').replace('\\','/')),json.dumps(str(HERE/'proof.mjs').replace('\\','/')))
 replace(json.dumps(PRIOR_PROOF),json.dumps(sha(load(HERE/'proof.mjs'))))
 replace('fixtureSha:'+json.dumps(PRIOR_FIXTURE),'fixtureSha:'+json.dumps(sha(load(HERE/'fixture.sql'))))
 for old,new in[("'.local/review-link-reason40-proof'","'.local/review-link-reason40-preparing-proof'"),("'eps.reason40.run'","'eps.reason40preparing.run'"),("'eps.reason40.workspace'","'eps.reason40preparing.workspace'"),("'eps.reason40.purpose'","'eps.reason40preparing.purpose'"),("'reason40-compatibility-proof'","'reason40-preparing-compatibility-proof'"),("'eps-reason40-'","'eps-reason40p-'"),("'review-link-reason40-owned-proof'","'review-link-reason40-preparing-owned-proof'"),("'tracking/evidence/m07/review-link-reason40-proof'","'tracking/evidence/m07/review-link-reason40-preparing-proof'")]:replace(old,new)
 for name in('compiler.py','fixture.sql','proof.mjs'):
  replace(json.dumps('development/m07/review-link-reason/'+name),json.dumps('development/m07/review-link-reason-preparing-proof/'+name))
 replace('independent owned network-none PG17 synthetic39-to40 compatibility, durable reason/trace and actual row-lock replay races; no canonical/provider/native/MCP/UI acceptance','fresh second owned network-none PG17 purpose with normal external Preparing-series fixture; exact39-to40 reason/trace and real row-lock replay races; no canonical/provider/native/MCP/UI acceptance')
 replace("report.checkpoint='reason40-owned-red-green-and-concurrency';","report.prior_failed_run={path:"+json.dumps(str(FAILURE.relative_to(ROOT)).replace('\\','/'))+",sha256:"+json.dumps(FAILURE_SHA)+",result:'failed',cleanup_verified:true};report.immutable_prior_source_pins="+json.dumps({'compiler.py':PRIOR_COMPILER,'proof.mjs':PRIOR_PROOF,'fixture.sql':PRIOR_FIXTURE})+";report.checkpoint='reason40-preparing-owned-red-green-and-concurrency';")
 replace('report.all_preexisting_old_column_rows_preserved = true;','report.all_preexisting_old_column_rows_preserved = true;report.normal_preparing_fixture.all_old_series_and_ready_snapshots_preserved=true;')
 return source
if __name__=='__main__':
 relative='.local/review-link-reason40-preparing-source/controller-'+str(uuid.uuid4())+'.mjs';text=compile_source(relative);file=ROOT/relative;file.parent.mkdir(parents=True,exist_ok=True)
 with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(text)
 print(json.dumps({'controller':str(file),'sha256':sha(text.encode()),'sql_or_docker_executed':False}))
