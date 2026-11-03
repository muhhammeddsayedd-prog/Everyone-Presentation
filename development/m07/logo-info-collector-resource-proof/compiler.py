"""Fresh namespace; one schema-backed audit fixture field, all core inherited."""
from pathlib import Path
import hashlib,importlib.util,json,re,uuid
HERE=Path(__file__).resolve().parent;SOURCE=HERE.parents[2];MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
OLD=MAIN/'development/m07/logo-info-collector-proof'
PINS={'compiler.py':'a0996447f7440055e77f7c95753e14e706162b79e4d30bdc6bcffbc86be697d9','entry.mjs':'ae464c02a6a1d8dad1ff83e737eed9ca03256227558344b518d52fd0f26648b3','local.py':'7426176548939d27caf039c9d93b6dcd79791ab3a1bdb4a99b75daab1ec86fd5','README.md':'3c006fe8b3f434e18f1debba7511e0f32741f79e014431b4fc4fed8f565b1ba7','test_proof.py':'9e86913f7517eb9878ce7b1ef479d6bfc32e1e2359fbe2688f8549e6a2c9e169'}
FAILURE='tracking/evidence/m07/logo-info-collector-proof/2026-11-03T04-03-51.226Z-925f434b.json';FAILURE_SHA='d1fe06328373d6e21cea68b52c508d77cef4e7811115c6fed1ff463ba5d3cb03'
AUDIT='tracking/evidence/m07/logo-info-collector-proof/Root-925f434b-postrun-audit.json';AUDIT_SHA='1e46ca554d22a6dfe37154c785f0dffb6c5ce22f661aebf966fff2c1bea67366'
FOUNDATION='supabase/migrations/20261028010943_m01_canonical_foundation.sql';FOUNDATION_SHA='8a5f3ed7727a72051e630307d2daecab8c4a74054398a6425e73bd85e17568b9'
def need(value):
 if not value:raise ValueError('LOGO41_RESOURCE_SOURCE_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

def compile_source(relative):
 match=re.fullmatch(r'\.local/logo-info-collector-resource-compiled/controller-([a-f0-9-]{36})\.mjs',relative);need(match is not None and str(uuid.UUID(match[1]))==match[1]and uuid.UUID(match[1]).version==4)
 for name,digest in PINS.items():need(sha((OLD/name).read_bytes())==digest)
 for name,digest in [(FAILURE,FAILURE_SHA),(AUDIT,AUDIT_SHA),(FOUNDATION,FOUNDATION_SHA)]:need(sha((MAIN/name).read_bytes())==digest)
 failure=json.loads((MAIN/FAILURE).read_bytes());need(failure['result']=='failed'and failure['checkpoint']=='restore38-and-apply39'and'collector_validation'not in failure and'logo41_bridge_diagnostics'not in failure and all(failure[k]is True for k in('all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released')))
 need(failure['source_seals']['development/m07/logo-info-collector-proof/entry.mjs']=='c450e16c633a0bea45cf3a03f3c43fb72ed501a9a9ea5aa92ad8481e8828cc18')
 raw=(OLD/'entry.mjs').read_bytes();need(raw.count(b'export const EXECUTION_ENABLED = false;')==1 and sha(raw.replace(b'export const EXECUTION_ENABLED = false;',b'export const EXECUTION_ENABLED = true;'))==failure['source_seals']['development/m07/logo-info-collector-proof/entry.mjs'])
 flag=(HERE/'entry.mjs').read_bytes();need(flag.count(b'export const EXECUTION_ENABLED = false;')+flag.count(b'export const EXECUTION_ENABLED = true;')==1);enabled=b'export const EXECUTION_ENABLED = true;'in flag
 old=module('logo41_resource_frozen_compiler',OLD/'compiler.py');old_relative=relative.replace('logo-info-collector-resource-compiled','logo-info-collector-compiled');source,bridge,prior=old.compile_source(old_relative);before=source;before_bridge=bridge;edits=[]
 begin=source.index('const cfg=')+len('const cfg=');cfg,_=json.JSONDecoder().raw_decode(source[begin:]);old_cfg=json.dumps(cfg,sort_keys=True)
 cfg['source_pins'].pop(cfg['bridge_file']);bridge_relative=relative.replace('/controller-','/bridge-');entry_relative=relative.replace('/controller-','/entry-');cfg.update(controller=str(MAIN/relative),bridge_file=str(MAIN/bridge_relative),entry_file=str(MAIN/entry_relative))
 # Same script/actions/process/caps/custody; only fresh protected parent path.
 a="'.local/logo-info-collector-proof'";b="'.local/logo-info-collector-resource-proof'";need(bridge.count(a)==1);bridge=bridge.replace(a,b,1);need(bridge.replace(b,a,1)==before_bridge)
 entry=(OLD/'entry.mjs').read_text();original_entry=entry
 entry_edits=[('export const EXECUTION_ENABLED = false;','export const EXECUTION_ENABLED = '+str(enabled).lower()+';'),("'.local/logo-info-collector-once'","'.local/logo-info-collector-resource-once'"),("'label=eps.logocollector.run='","'label=eps.logoresource.run='")]
 for a,b in entry_edits:need(entry.count(a)==1);entry=entry.replace(a,b,1)
 inverse=entry
 for a,b in reversed(entry_edits):need(inverse.count(b)==1);inverse=inverse.replace(b,a,1)
 need(inverse==original_entry)
 cfg['bridge_sha256']=sha(bridge.encode());cfg['entry_sha256']=sha(entry.encode());cfg['source_pins'][cfg['bridge_file']]=cfg['bridge_sha256'];cfg['source_pins'][cfg['entry_file']]=cfg['entry_sha256']
 for file in[MAIN/FAILURE,MAIN/AUDIT,MAIN/FOUNDATION,*sorted(HERE.iterdir())]:
  if file.is_file():cfg['source_pins'][str(file)]=sha(file.read_bytes())
 def edit(a,b):
  nonlocal source
  need(source.count(a)==1);source=source.replace(a,b,1);edits.append((a,b))
 edit('const cfg='+old_cfg+';','const cfg='+json.dumps(cfg,sort_keys=True)+';')
 edit((OLD/'entry.mjs').as_uri(),(MAIN/entry_relative).as_uri())
 for a,b in[("'.local/logo-info-collector-proof'","'.local/logo-info-collector-resource-proof'"),("'eps.logocollector.run'","'eps.logoresource.run'"),("'eps.logocollector.workspace'","'eps.logoresource.workspace'"),("'eps.logocollector.purpose'","'eps.logoresource.purpose'"),("'logo-info-collector-transaction-rehearsal'","'logo-info-resource-fixture-transaction-rehearsal'"),("'eps-logocollector-'","'eps-logoresource-'"),("'logo-info-collector-owned-proof'","'logo-info-collector-resource-owned-proof'"),("'tracking/evidence/m07/logo-info-collector-proof'","'tracking/evidence/m07/logo-info-collector-proof/resource-successor'")]:edit(a,b)
 # The only fixture data delta: required nonnull resource_id on each new row.
 a='insert into eps.audit_events(id,principal_id,action,reason)select';b='insert into eps.audit_events(id,principal_id,action,resource_id,reason)select';edit(a,b)
 a="::uuid,'logo41.collector.synthetic',case n";b="::uuid,'logo41.collector.synthetic',md5(\"+quote(runId)+\"||':resource'||n)::uuid,case n";edit(a,b)
 # Rebuild provenance paths only, including actual generated entry and bridge.
 marker='report.source_seals = {}; for (const [root, file] of ';start=source.index(marker)+len(marker);end=source.index(') {\n      const bytes',start);old_records=source[start:end]
 records=[]
 for name in cfg['source_pins']:
  file=Path(name);root=MAIN if file.is_relative_to(MAIN)else SOURCE;need(file.is_relative_to(root));records.append([str(root),file.relative_to(root).as_posix()])
 records.append([str(MAIN),relative]);edit(old_records,json.dumps(records))
 inverse=source
 for a,b in reversed(edits):need(inverse.count(b)==1);inverse=inverse.replace(b,a,1)
 need(inverse==before)
 return source,bridge,entry,{'parent_controller_inverse_byte_equal':True,'parent_entry_inverse_byte_equal':True,'parent_bridge_inverse_byte_equal':True,'fixture_only_adds_required_resource_id':True,'failed_run':{'path':FAILURE,'sha256':FAILURE_SHA},'postrun_audit':{'path':AUDIT,'sha256':AUDIT_SHA},'source_pins':cfg['source_pins'],'prior':{k:v for k,v in prior.items()if k!='source_pins'}}

if __name__=='__main__':
 relative='.local/logo-info-collector-resource-compiled/controller-'+str(uuid.uuid4())+'.mjs';controller,bridge,entry,proof=compile_source(relative)
 for kind,text in [('bridge',bridge),('entry',entry),('controller',controller)]:
  file=MAIN/relative.replace('/controller-','/'+kind+'-');file.parent.mkdir(parents=True,exist_ok=True)
  with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(text)
 print(json.dumps({'compiled_only':True,'execution_dispatched':False,'controller':relative,'controller_sha256':sha(controller.encode()),'entry_sha256':sha(entry.encode()),'bridge_sha256':sha(bridge.encode()),'projection':proof}))
