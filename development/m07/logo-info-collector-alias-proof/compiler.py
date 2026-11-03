"""Fresh namespace; only fixed collector SQL/script provenance over84 parent."""
from pathlib import Path
import hashlib,importlib.util,json,re,uuid
HERE=Path(__file__).resolve().parent;SOURCE=HERE.parents[2];MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
OLD=MAIN/'development/m07/logo-info-collector-resource-proof'
PINS={'compiler.py':'3dc216f16517cbbf87248c7a1c5e50c76395995bced4cec43d342a70e788d44e','entry.mjs':'6ede1183b5b7180537ff6a2f21fe03679b20e8c4b00179d4ff5da242a351c91c','README.md':'6fdda4c3e369b3b8e1f59e3d59923b0057910cbf777ac5e0dfc954e24a5036f4','test_resource.py':'c52adaef8e99d8fb6aa51e4a4f17455994731f41b9c370d309b7065b02923e75'}
FAILURE='tracking/evidence/m07/logo-info-collector-proof/resource-successor/2026-11-03T04-16-01.656Z-84d79b2c.json';FAILURE_SHA='5f34005d1e7418997e1623af65450df168877a8eb812c3244f0a886b0c246911'
AUDIT='tracking/evidence/m07/logo-info-collector-proof/resource-successor/Root-84d79b2c-postrun-audit.json';AUDIT_SHA='ca92bcd9c0b3f3c795abfb263a88273f1dbddda11b63c55efec44dc4dee40941'
def need(value):
 if not value:raise ValueError('LOGO41_ALIAS_COLLECTOR_SOURCE_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
def compile_source(relative):
 match=re.fullmatch(r'\.local/logo-info-collector-alias-compiled/controller-([a-f0-9-]{36})\.mjs',relative);need(match is not None and str(uuid.UUID(match[1]))==match[1]and uuid.UUID(match[1]).version==4)
 for name,digest in PINS.items():need(sha((OLD/name).read_bytes())==digest)
 for name,digest in[(FAILURE,FAILURE_SHA),(AUDIT,AUDIT_SHA)]:need(sha((MAIN/name).read_bytes())==digest)
 failure=json.loads((MAIN/FAILURE).read_bytes());need(failure['result']=='failed'and failure['checkpoint']=='logo-info-rollback-proof'and failure['declared_owned_fixture']['new_synthetic_audit_rows']==3 and'logo41_bridge_diagnostics'not in failure and all(failure[k]is True for k in('all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released')))
 flag=(OLD/'entry.mjs').read_bytes();need(flag.count(b'export const EXECUTION_ENABLED = false;')==1 and sha(flag.replace(b'export const EXECUTION_ENABLED = false;',b'export const EXECUTION_ENABLED = true;'))=='3d975a2d5e3720e128012b5773891737c44f912b023460149039e06a38f05689')
 flag=(HERE/'entry.mjs').read_bytes();need(flag.count(b'export const EXECUTION_ENABLED = false;')+flag.count(b'export const EXECUTION_ENABLED = true;')==1);enabled=b'export const EXECUTION_ENABLED = true;'in flag
 parent=module('logo41_alias_frozen_resource_compiler',OLD/'compiler.py');local=module('logo41_alias_actual_adapter',HERE/'local.py');actual=local.configuration()
 old_relative=relative.replace('logo-info-collector-alias-compiled','logo-info-collector-resource-compiled');source,bridge,entry,prior=parent.compile_source(old_relative);before=source;before_bridge=bridge;before_entry=entry;edits=[]
 begin=source.index('const cfg=')+len('const cfg=');cfg,_=json.JSONDecoder().raw_decode(source[begin:]);old_cfg=json.dumps(cfg,sort_keys=True);old_entry_file=cfg['entry_file'];cfg['source_pins'].pop(cfg['entry_file']);cfg['source_pins'].pop(cfg['bridge_file'])
 cfg.update(controller=str(MAIN/relative),bridge_file=str(MAIN/relative.replace('/controller-','/bridge-')),entry_file=str(MAIN/relative.replace('/controller-','/entry-')),snapshot_sql=actual['snapshot_sql'],checkpoint_sql=actual['checkpoint_sql'])
 original_condition="p.oid='eps.logo_storage_read_allowed(text,text)'::regprocedure and to_jsonb(p)?'prosrc'";fixed_condition="(to_jsonb(p)->>'oid')::oid='eps.logo_storage_read_allowed(text,text)'::regprocedure and to_jsonb(p)?'prosrc'"
 for key in('snapshot_sql','checkpoint_sql'):
  original=json.loads(old_cfg)[key];need(original.count(original_condition)==14 and cfg[key].count(fixed_condition)==14);need(cfg[key].replace(fixed_condition,original_condition)==original)
 changes=[("const LOCAL="+json.dumps(str(MAIN/'development/m07/logo-info-collector-proof/local.py').replace('\\','/'))+';',"const LOCAL="+json.dumps(str(HERE/'local.py').replace('\\','/'))+';'),("'.local/logo-info-collector-resource-proof'","'.local/logo-info-collector-alias-proof'")]
 for a,b in changes:need(bridge.count(a)==1);bridge=bridge.replace(a,b,1)
 inverse=bridge
 for a,b in reversed(changes):need(inverse.count(b)==1);inverse=inverse.replace(b,a,1)
 need(inverse==before_bridge)
 entry_changes=[('export const EXECUTION_ENABLED = false;','export const EXECUTION_ENABLED = '+str(enabled).lower()+';'),("'.local/logo-info-collector-resource-once'","'.local/logo-info-collector-alias-once'"),("'label=eps.logoresource.run='","'label=eps.logoalias.run='")]
 for a,b in entry_changes:need(entry.count(a)==1);entry=entry.replace(a,b,1)
 inverse=entry
 for a,b in reversed(entry_changes):need(inverse.count(b)==1);inverse=inverse.replace(b,a,1)
 need(inverse==before_entry)
 cfg['entry_sha256']=sha(entry.encode());cfg['bridge_sha256']=sha(bridge.encode());cfg['source_pins'].update(actual['source_pins']);cfg['source_pins'][cfg['entry_file']]=cfg['entry_sha256'];cfg['source_pins'][cfg['bridge_file']]=cfg['bridge_sha256']
 for file in[MAIN/FAILURE,MAIN/AUDIT,*sorted(HERE.iterdir())]:
  if file.is_file():cfg['source_pins'][str(file)]=sha(file.read_bytes())
 def edit(a,b):
  nonlocal source
  need(source.count(a)==1);source=source.replace(a,b,1);edits.append((a,b))
 edit('const cfg='+old_cfg+';','const cfg='+json.dumps(cfg,sort_keys=True)+';');edit(Path(old_entry_file).as_uri(),Path(cfg['entry_file']).as_uri())
 for a,b in[("'.local/logo-info-collector-resource-proof'","'.local/logo-info-collector-alias-proof'"),("'eps.logoresource.run'","'eps.logoalias.run'"),("'eps.logoresource.workspace'","'eps.logoalias.workspace'"),("'eps.logoresource.purpose'","'eps.logoalias.purpose'"),("'logo-info-resource-fixture-transaction-rehearsal'","'logo-info-alias-collector-transaction-rehearsal'"),("'eps-logoresource-'","'eps-logoalias-'"),("'logo-info-collector-resource-owned-proof'","'logo-info-collector-alias-owned-proof'"),("'tracking/evidence/m07/logo-info-collector-proof/resource-successor'","'tracking/evidence/m07/logo-info-collector-proof/alias-successor'")]:edit(a,b)
 marker='report.source_seals = {}; for (const [root, file] of ';start=source.index(marker)+len(marker);end=source.index(') {\n      const bytes',start);old_records=source[start:end];records=[]
 for name in cfg['source_pins']:
  file=Path(name);root=MAIN if file.is_relative_to(MAIN)else SOURCE;need(file.is_relative_to(root));records.append([str(root),file.relative_to(root).as_posix()])
 records.append([str(MAIN),relative]);edit(old_records,json.dumps(records));inverse=source
 for a,b in reversed(edits):need(inverse.count(b)==1);inverse=inverse.replace(b,a,1)
 need(inverse==before)
 return source,bridge,entry,{'parent_controller_inverse_byte_equal':True,'parent_entry_inverse_byte_equal':True,'parent_bridge_inverse_byte_equal':True,'only14ROWconditions_change_actual_collector_and_checkpoint':True,'source_pins':cfg['source_pins'],'snapshot_sha256':sha(cfg['snapshot_sql'].encode()),'checkpoint_sha256':sha(cfg['checkpoint_sql'].encode()),'failed_run':{'path':FAILURE,'sha256':FAILURE_SHA}}

if __name__=='__main__':
 relative='.local/logo-info-collector-alias-compiled/controller-'+str(uuid.uuid4())+'.mjs';controller,bridge,entry,proof=compile_source(relative)
 for kind,text in[('bridge',bridge),('entry',entry),('controller',controller)]:
  file=MAIN/relative.replace('/controller-','/'+kind+'-');file.parent.mkdir(parents=True,exist_ok=True)
  with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(text)
 print(json.dumps({'compiled_only':True,'execution_dispatched':False,'controller':relative,'controller_sha256':sha(controller.encode()),'entry_sha256':sha(entry.encode()),'bridge_sha256':sha(bridge.encode()),'projection':proof}))
