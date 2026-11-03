"""Fresh owned ACL-qualified bridge; all SQL/controller mechanics inherited."""
from pathlib import Path
import hashlib,importlib.util,json,re,uuid
HERE=Path(__file__).resolve().parent;SOURCE=HERE.parents[2];MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
OLD=MAIN/'development/m07/logo-info-collector-alias-proof'
PINS={'compiler.py':'d8ca38da435b20371aef254529d942b8e9727045e29dc7570d66c7e1e34b94b7','entry.mjs':'1e62b06bb6013cbe878b0e8304042aa630419a575cbf48e10505653553f7a68c','local.py':'3327262ac378a71ba38a3ab4fa84eeb077c1a65a70dacd1316d23bca1c92fafb','README.md':'4f15c1ad0d4eca3c0537b811c23b6e12aaa83f2452e29c5cb9a33c4eef2b3333','test_alias.py':'0632624f95014e49a87fc8c1d47df0aae4dca3965e7249266308b1ffd2b0b6d3'}
FAILURE='tracking/evidence/m07/logo-info-collector-proof/alias-successor/2026-11-03T04-38-01.517Z-c8792790.json';FAILURE_SHA='492ee6bf2b7a7e7cea901be5c8db4ad0488f372ae25568be79f0920217e68e30'
AUDIT='tracking/evidence/m07/logo-info-collector-proof/alias-successor/Root-c8792790-postrun-audit.json';AUDIT_SHA='8a776f8d9c73e43b7b3ee7e584a643eec171d92d0e2efc01f362aa4e76db107e'
def need(value):
 if not value:raise ValueError('LOGO41_ACL_COLLECTOR_SOURCE_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
def compile_source(relative):
 match=re.fullmatch(r'\.local/logo-info-collector-acl-compiled/controller-([a-f0-9-]{36})\.mjs',relative);need(match is not None and str(uuid.UUID(match[1]))==match[1]and uuid.UUID(match[1]).version==4)
 for name,digest in PINS.items():need(sha((OLD/name).read_bytes())==digest)
 for name,digest in[(FAILURE,FAILURE_SHA),(AUDIT,AUDIT_SHA)]:need(sha((MAIN/name).read_bytes())==digest)
 failure=json.loads((MAIN/FAILURE).read_bytes());need(failure['result']=='failed'and'collector_validation'not in failure and all(failure[k]is True for k in('all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released')))
 raw=(OLD/'entry.mjs').read_bytes();need(raw.count(b'export const EXECUTION_ENABLED = false;')==1 and sha(raw.replace(b'export const EXECUTION_ENABLED = false;',b'export const EXECUTION_ENABLED = true;'))==failure['source_seals']['development/m07/logo-info-collector-alias-proof/entry.mjs'])
 flag=(HERE/'entry.mjs').read_bytes();need(flag.count(b'export const EXECUTION_ENABLED = false;')+flag.count(b'export const EXECUTION_ENABLED = true;')==1);enabled=b'export const EXECUTION_ENABLED = true;'in flag
 parent=module('logo41_acl_frozen_alias_compiler',OLD/'compiler.py');local=module('logo41_acl_actual_owned_adapter',HERE/'local.py');actual=local.configuration()
 old_relative=relative.replace('logo-info-collector-acl-compiled','logo-info-collector-alias-compiled');source,bridge,entry,prior=parent.compile_source(old_relative);before=source;before_bridge=bridge;before_entry=entry
 begin=source.index('const cfg=')+len('const cfg=');cfg,_=json.JSONDecoder().raw_decode(source[begin:]);old_cfg=json.dumps(cfg,sort_keys=True);old_entry_file=cfg['entry_file'];cfg['source_pins'].pop(cfg['entry_file']);cfg['source_pins'].pop(cfg['bridge_file'])
 need(cfg['snapshot_sql']==actual['snapshot_sql']and cfg['checkpoint_sql']==actual['checkpoint_sql'])
 cfg.update(controller=str(MAIN/relative),bridge_file=str(MAIN/relative.replace('/controller-','/bridge-')),entry_file=str(MAIN/relative.replace('/controller-','/entry-')))
 def projected(text,changes):
  original=text
  for a,b in changes:need(text.count(a)==1);text=text.replace(a,b,1)
  inverse=text
  for a,b in reversed(changes):need(inverse.count(b)==1);inverse=inverse.replace(b,a,1)
  need(inverse==original);return text
 bridge=projected(bridge,[("const LOCAL="+json.dumps(str(OLD/'local.py').replace('\\','/'))+';',"const LOCAL="+json.dumps(str(HERE/'local.py').replace('\\','/'))+';'),("'.local/logo-info-collector-alias-proof'","'.local/logo-info-collector-acl-proof'")])
 entry=projected(entry,[('export const EXECUTION_ENABLED = false;','export const EXECUTION_ENABLED = '+str(enabled).lower()+';'),("'.local/logo-info-collector-alias-once'","'.local/logo-info-collector-acl-once'"),("'label=eps.logoalias.run='","'label=eps.logoacl.run='")])
 cfg['entry_sha256']=sha(entry.encode());cfg['bridge_sha256']=sha(bridge.encode());cfg['source_pins'].update(actual['source_pins']);cfg['source_pins'][cfg['entry_file']]=cfg['entry_sha256'];cfg['source_pins'][cfg['bridge_file']]=cfg['bridge_sha256']
 for file in[MAIN/FAILURE,MAIN/AUDIT,*sorted(HERE.iterdir())]:
  if file.is_file():cfg['source_pins'][str(file)]=sha(file.read_bytes())
 changes=[('const cfg='+old_cfg+';','const cfg='+json.dumps(cfg,sort_keys=True)+';'),(Path(old_entry_file).as_uri(),Path(cfg['entry_file']).as_uri())]
 for a,b in[("'.local/logo-info-collector-alias-proof'","'.local/logo-info-collector-acl-proof'"),("'eps.logoalias.run'","'eps.logoacl.run'"),("'eps.logoalias.workspace'","'eps.logoacl.workspace'"),("'eps.logoalias.purpose'","'eps.logoacl.purpose'"),("'logo-info-alias-collector-transaction-rehearsal'","'logo-info-acl-collector-transaction-rehearsal'"),("'eps-logoalias-'","'eps-logoacl-'"),("'logo-info-collector-alias-owned-proof'","'logo-info-collector-acl-owned-proof'"),("'tracking/evidence/m07/logo-info-collector-proof/alias-successor'","'tracking/evidence/m07/logo-info-collector-proof/acl-successor'")]:changes.append((a,b))
 marker='report.source_seals = {}; for (const [root, file] of ';start=source.index(marker)+len(marker);end=source.index(') {\n      const bytes',start);records=[]
 for name in cfg['source_pins']:
  file=Path(name);root=MAIN if file.is_relative_to(MAIN)else SOURCE;need(file.is_relative_to(root));records.append([str(root),file.relative_to(root).as_posix()])
 records.append([str(MAIN),relative]);changes.append((source[start:end],json.dumps(records)));source=projected(source,changes)
 return source,bridge,entry,{'parent_controller_inverse_byte_equal':True,'parent_entry_inverse_byte_equal':True,'parent_bridge_inverse_byte_equal':True,'actual_snapshot_checkpoint_SQL_byte_equal':True,'only_owned_expected_PUBLIC_USAGE_absence_qualified':True,'source_pins':cfg['source_pins'],'failed_run':{'path':FAILURE,'sha256':FAILURE_SHA},'postrun_audit':{'path':AUDIT,'sha256':AUDIT_SHA},'snapshot_sha256':sha(cfg['snapshot_sql'].encode()),'checkpoint_sha256':sha(cfg['checkpoint_sql'].encode())}
if __name__=='__main__':
 relative='.local/logo-info-collector-acl-compiled/controller-'+str(uuid.uuid4())+'.mjs';controller,bridge,entry,proof=compile_source(relative)
 for kind,text in[('bridge',bridge),('entry',entry),('controller',controller)]:
  file=MAIN/relative.replace('/controller-','/'+kind+'-');file.parent.mkdir(parents=True,exist_ok=True)
  with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(text)
 print(json.dumps({'compiled_only':True,'execution_dispatched':False,'controller':relative,'controller_sha256':sha(controller.encode()),'entry_sha256':sha(entry.encode()),'bridge_sha256':sha(bridge.encode()),'projection':proof}))
