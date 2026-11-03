"""Fresh purpose and Context binding; sealed normal phase methods unchanged."""
from pathlib import Path
import datetime,hashlib,importlib.util,json,sys,types
HERE=Path(__file__).resolve().parent
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
s=module('logo41_alias_context',HERE/'state.py')
file=s.MAIN/'development/m07/logo-info-canonical-release/release.py';s.need(s.sha(s.load(file))=='74432d59044a04dff443b5ec3f47a5e1e3c305f879caf446eaec564839ddd0e2');old=module('logo41_alias_frozen_release',file)
READ_ENABLED=True
APPLY_ENABLED=True
PURPOSE='logo-info-canonical-alias-release'
def bind(function,**values):
 namespace=dict(function.__globals__);namespace.update(values)
 return types.FunctionType(function.__code__,namespace,function.__name__,function.__defaults__,function.__closure__)
methods={name:bind(value,s=s,PURPOSE=PURPOSE)for name,value in vars(old.Base).items()if isinstance(value,types.FunctionType)}
Base=type('AliasPhaseLibrary',(),methods)
validate_collector_proof=bind(old.validate_collector_proof,s=s,HERE=HERE)
class Release(old.Release):
 def __init__(self,run,context=None):Base.__init__(self,run,context or s.Context())
 def enabled(self,apply=False):s.need(READ_ENABLED and(not apply or APPLY_ENABLED))
 def query(self,sql,label):self.enabled(label=='apply');return Base.query(self,sql,label)
 def snapshot(self):return Base.snapshot(self)
 def checkpoint(self,phase,expected,installed):
  value=Base.checkpoint(self,phase,expected,installed);value['history_path']=['state','history','versions'];return value
 def prepare(self):self.enabled();value=Base.prepare(self);value['worker']=self.last_worker;return value
 def apply(self):self.enabled(True);value=Base.apply(self);value['worker']=getattr(self,'last_worker',None);return value
 def reconcile(self):self.enabled();return Base.reconcile(self)
 def admission(self):
  value=self.c.admission();value['mechanism_projection']=old.PROJECTION;value['row_alias_correction']={'old':s.ROW_OLD,'new':s.ROW_NEW,'target_prosrc_scope_unchanged':True}
  reference=self.read(self.private/'query-validation.json');s.need(type(reference)is dict and set(reference)=={'path','sha256'})
  relative=Path(reference['path']);s.need(not relative.is_absolute()and'..'not in relative.parts and relative.parts[:4]==('tracking','evidence','m07','logo-info-collector-proof'))
  raw=s.load(self.c.source/relative);validate_collector_proof(raw,reference['sha256'],self.c.source_pins());value['collector_validation']=reference;return value

def save(action,value,root):
 directory=root/'tracking/evidence/m07'/PURPOSE;directory.mkdir(parents=True,exist_ok=True);file=directory/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action+'.json')
 with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps({'schema_version':'1.0','purpose':PURPOSE,'action':action,'target':s.TARGET,'version':s.VERSION,'migration_sha256':s.MIGRATION_SHA,'raw_payloads_logged':False,'private_checkpoint_is_restore_proof':False,**value},sort_keys=True,indent=2)+'\n')
 return file.relative_to(root).as_posix()
def main(argv=None):
 args=sys.argv[1:]if argv is None else argv;s.need(len(args)==2 and args[0]in('prepare','apply','reconcile'));s.need(READ_ENABLED and(args[0]!='apply'or APPLY_ENABLED))
 op=Release(args[1]);op.enabled(args[0]=='apply');value=getattr(op,args[0])();print(json.dumps({'result':value['result'],'receipt':save(args[0],value,op.c.source)}));s.need(value['result']in('passed','prepared'))
if __name__=='__main__':
 try:main()
 except Exception:print('{"result":"unconfirmed","safe_error_code":"LOGO_INFO41_ALIAS_UNCONFIRMED"}',file=sys.stderr);sys.exit(1)
