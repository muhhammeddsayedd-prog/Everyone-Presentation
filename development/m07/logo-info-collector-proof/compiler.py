"""Small new owned controller, sealed bootstrap/config/bridge libraries only."""
from pathlib import Path
import hashlib,importlib.util,json,re,uuid
HERE=Path(__file__).resolve().parent;SOURCE=HERE.parents[2];MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
OLD=MAIN/'development/m07/logo-info-owned-proof/compiler.py';OLD_SHA='d6a9f64b92dd02c424729e5a7f0ed7bd00d6a5a7301e427a3d9b4c1a385afb35'
WORKER=MAIN/'development/m07/worker-source-identity-sql-proof/compiler.py';WORKER_SHA='e3fe847eedd1097cea4f54e5a706c29004923e1e1251cfb6e8538ccad8050a0a'
BRIDGE=MAIN/'development/m07/worker-source-identity-sql-bridge-proof/bridge.mjs';BRIDGE_SHA='9a2e820cca1c7c26a11be4afa3545d43a0d962076ec99df306b2d5f87085fafb'
def need(value):
 if not value:raise ValueError('LOGO41_COLLECTOR_SOURCE_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

def compile_source(relative):
 match=re.fullmatch(r'\.local/logo-info-collector-compiled/controller-([a-f0-9-]{36})\.mjs',relative);need(match is not None and str(uuid.UUID(match[1]))==match[1]and uuid.UUID(match[1]).version==4)
 need(sha(OLD.read_bytes())==OLD_SHA and sha(WORKER.read_bytes())==WORKER_SHA and sha(BRIDGE.read_bytes())==BRIDGE_SHA)
 old=module('logo41_frozen_owned_bootstrap',OLD);worker=module('logo41_frozen_declared_setup',WORKER);local=module('logo41_new_local_adapter',HERE/'local.py')
 old_relative=relative.replace('logo-info-collector-compiled','logo-info-owned-compiled');source,_=old.compile_source(old_relative);before=source;edits=[]
 begin=source.index('const cfg=')+len('const cfg=');cfg,length=json.JSONDecoder().raw_decode(source[begin:]);original_cfg=json.dumps(cfg,sort_keys=True)
 setup=worker.configuration();actual=local.configuration()
 for key in('proof_sql','proof_sql_sha256','original_proof_sql_sha256','template_run','expected_cases'):cfg.pop(key,None)
 cfg.update(snapshot_sql=actual['snapshot_sql'],checkpoint_sql=actual['checkpoint_sql'],version=local.s.VERSION,migration_sha256=local.s.MIGRATION_SHA,controller=str(MAIN/relative),owned_qualifications=actual['owned_qualifications'])
 # Reuse the exact Buffer-based bounded bridge; only fixed script/private/report
 # namespaces differ. Inverse proves all process/limits/custody code unchanged.
 bridge=BRIDGE.read_text();changes=[("const LOCAL=MAIN+'/development/m07/worker-source-identity-sql-proof/local.py';","const LOCAL="+json.dumps(str(HERE/'local.py').replace('\\','/'))+';'),("'.local/worker-source-identity-sql-bridge-proof'","'.local/logo-info-collector-proof'"),('worker40_bridge_diagnostics','logo41_bridge_diagnostics')]
 original_bridge=bridge
 for a,b in changes:need(bridge.count(a)==1);bridge=bridge.replace(a,b,1)
 inverse=bridge
 for a,b in reversed(changes):need(inverse.count(b)==1);inverse=inverse.replace(b,a,1)
 need(inverse==original_bridge)
 bridge_relative=relative.replace('/controller-','/bridge-');cfg.update(bridge_file=str(MAIN/bridge_relative),bridge_sha256=sha(bridge.encode()))
 cfg['source_pins'].update(setup['source_pins']);cfg['source_pins'].update(actual['source_pins']);cfg['source_pins'][str(MAIN/bridge_relative)]=sha(bridge.encode())
 for file in [OLD,WORKER,BRIDGE,*sorted(HERE.iterdir())]:
  if file.is_file():cfg['source_pins'][str(file)]=sha(file.read_bytes())
 def edit(a,b):
  nonlocal source
  need(source.count(a)==1);source=source.replace(a,b,1);edits.append((a,b))
 edit('const cfg='+original_cfg+';','const cfg='+json.dumps(cfg,sort_keys=True)+';')
 edit('const ROOT = '+json.dumps(str(MAIN))+';','const ROOT = '+json.dumps(str(MAIN).replace('\\','/'))+';')
 edit((MAIN/'development/m07/logo-info-owned-proof/entry.mjs').as_uri(),(HERE/'entry.mjs').as_uri());edit(old_relative,relative)
 for a,b in[("'.local/logo-info-owned-proof'","'.local/logo-info-collector-proof'"),("'eps.logoinfo.run'","'eps.logocollector.run'"),("'eps.logoinfo.workspace'","'eps.logocollector.workspace'"),("'eps.logoinfo.purpose'","'eps.logocollector.purpose'"),("'logo-info-operation-owned-SQL-proof'","'logo-info-collector-transaction-rehearsal'"),("'eps-logoinfo-'","'eps-logocollector-'"),("'logo-info-operation-owned-proof'","'logo-info-collector-owned-proof'"),("'tracking/evidence/m07/logo-info-owned-proof'","'tracking/evidence/m07/logo-info-collector-proof'")]:edit(a,b)
 edit('fresh owned PG17 restored38 plus exact39/40 functional DDL, one rollback-only logo INFO operation/RLS proof; no hosted Storage, bytes, cloud or provider acceptance','fresh owned PG17 actual41 collector/checkpoint/negative-preimage/rollback/normal-COMMIT rehearsal; no39-case or generation replay, canonical or hosted acceptance')
 # Create only the admin-owned qualification schema before its exact3-row q.sql.
 # The unchanged original_rows capture is first populated AFTER declared setup.
 edit('`create schema project39_proof;create table project39_proof.original_rows','`create table project39_proof.original_rows')
 start=source.index('    await sql("set session authorization postgres;begin;set local row_security=on;"+functional+')
 end=source.index('\n    const after39 =',start);removed=source[start:end]
 new="""    await sql("set session authorization postgres;begin;set local row_security=on;"+functional+"insert into supabase_migrations.schema_migrations(version,statements,name)values('20261101223342',array[]::text[],'m07_project_creation');commit;");
    await sql('create schema project39_proof;');
    const qualified=QUALIFIED.replace('__WORKER39_OWNED_SYSTEM_SQL__',quote(identity.system_identifier)).replace('__WORKER39_OWNED_RUN_SQL__',quote(runId));
    const qualificationGuard="do $admin$begin if current_user<>'supabase_admin'or session_user<>'supabase_admin'or not(select rolsuper from pg_roles where rolname=current_user)or current_database()<>'project39'or(pg_control_system()).system_identifier::text<>"+quote(identity.system_identifier)+"or current_setting('eps.worker39.run',true)is distinct from"+quote(runId)+"or(select nspowner from pg_namespace where nspname='project39_proof')is distinct from(select oid from pg_roles where rolname=current_user)then raise exception'LOGO41_OWNED_ADMIN_REQUIRED';end if;end$admin$;";
    await sql("reset session authorization;begin;set local eps.worker39.run="+quote(runId)+';'+qualificationGuard+qualified+'commit;');
    const config=CONFIG.replace('__REASON40_FIXTURE_SYSTEM_SQL__',quote(identity.system_identifier)).replace('__REASON40_FIXTURE_RUN_SQL__',quote(runId));await sql("set session authorization postgres;begin;set local eps.reason40fixture.run="+quote(runId)+';'+config+'commit;');
    const managed=MANAGED.replace('__FORWARD_SYSTEM_SQL__',quote(identity.system_identifier)).replace('__FORWARD_RUN_SQL__',quote(runId));await sql("set session authorization postgres;set timezone='UTC';set eps.reason40forward.run="+quote(runId)+';'+managed);
    let migration40=MIGRATION40;const a="current_user<>'postgres'or current_database()<>'postgres'",b="current_user<>'postgres'or current_database()<>'project39'or(pg_control_system()).system_identifier::text<>"+quote(identity.system_identifier);assert.equal(migration40.split(a).length,2);migration40=migration40.replace(a,b);assert.equal(migration40.replace(b,a),MIGRATION40);
    await sql("set session authorization postgres;begin;"+migration40+"insert into supabase_migrations.schema_migrations(version,statements,name)values('20261102085405',array[]::text[],'m07_review_link_action_reason');update eps.frame_extraction_config set native_image_id='sha256:3d4286db01b27b40ec9078e303158e93003a096d5ddad1c9802130238de6dd80';commit;");
    await sql("reset session authorization;begin;insert into auth.users(id,is_anonymous)values(md5("+quote(runId+':actor')+")::uuid,false);set session authorization postgres;insert into eps.audit_events(id,principal_id,action,reason)select md5("+quote(runId)+"||':audit'||n)::uuid,md5("+quote(runId+':actor')+")::uuid,'logo41.collector.synthetic',case n when 0 then E'Owned collector Ω\\nالعربية'when 1 then''else null end from generate_series(0,2)n;commit;");
    await sql(snapshot);report.declared_owned_fixture={qualified_rows:3,config_tables:5,native_value:'3d',managed0074_and_one_ledger:true,new_synthetic_audit_rows:3,no_canonical_config_or_identity_claim:true,fresh_original_row_snapshot_after_declared_fixture:true};
""".replace('QUALIFIED',json.dumps(setup['qualification_sql'])).replace('CONFIG',json.dumps(setup['config_setup_sql'])).replace('MANAGED',json.dumps(setup['managed_fixture_sql'])).replace('MIGRATION40',json.dumps(setup['migration40']))
 edit(removed,new)
 edit('await logoInfo.runProof({runId,privateRoot,sql,baseline:cloneBaseline,report},cfg);','await logoInfo.runProof({root:ROOT,runId,privateRoot,system:identity.system_identifier,sql,baseline:cloneBaseline,report},cfg);')
 # All canonical and adapter bytes and generated bridge are private source copies.
 marker='report.source_seals = {}; for (const [root, file] of ';start=source.index(marker)+len(marker);end=source.index(') {\n      const bytes',start);old_records=source[start:end]
 records=[]
 for file in cfg['source_pins']:
  p=Path(file);root=MAIN if p.is_relative_to(MAIN)else SOURCE;need(p.is_relative_to(root));records.append([str(root),p.relative_to(root).as_posix()])
 records.append([str(MAIN),relative]);edit(old_records,json.dumps(records))
 inverse=source
 for a,b in reversed(edits):need(inverse.count(b)==1);inverse=inverse.replace(b,a,1)
 need(inverse==before)
 return source,bridge,{'controller_inverse_byte_equal':True,'bridge_inverse_byte_equal':True,'source_pins':cfg['source_pins'],'snapshot_sha256':sha(cfg['snapshot_sql'].encode()),'checkpoint_sha256':sha(cfg['checkpoint_sql'].encode()),'no_functional_or_generation_replay':True}

if __name__=='__main__':
 relative='.local/logo-info-collector-compiled/controller-'+str(uuid.uuid4())+'.mjs';controller,bridge,proof=compile_source(relative)
 for kind,text in [('bridge',bridge),('controller',controller)]:
  file=MAIN/relative.replace('/controller-','/'+kind+'-');file.parent.mkdir(parents=True,exist_ok=True)
  with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(text)
 print(json.dumps({'compiled_only':True,'execution_dispatched':False,'controller':relative,'controller_sha256':sha(controller.encode()),'bridge_sha256':sha(bridge.encode()),'projection':proof}))
