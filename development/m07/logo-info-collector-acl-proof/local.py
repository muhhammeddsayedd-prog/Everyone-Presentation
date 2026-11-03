"""Owned-only missing PUBLIC USAGE qualification; no SQL or transport change."""
from pathlib import Path
import copy,inspect,types
import importlib.util
HERE=Path(__file__).resolve().parent;MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
prior=module('logo41_frozen_alias_owned_adapter',MAIN/'development/m07/logo-info-collector-alias-proof/local.py')
s=prior.alias;s.need(s.sha(s.load(MAIN/'development/m07/logo-info-collector-alias-proof/local.py'))=='3327262ac378a71ba38a3ab4fa84eeb077c1a65a70dacd1316d23bca1c92fafb')
KEY='schemas|public|acl';PUBLIC_USAGE='=U/pg_database_owner'
class OwnedContext(prior.old.old.OwnedContext):
 def bind_current(self,before,system,run):
  super().bind_current(before,system,run)
  expected=self.c.delta[KEY]['after'];actual=before['canonical']['project39']['delta']
  s.need(type(expected)is list and expected.count(PUBLIC_USAGE)==1)
  qualified=[row for row in expected if row!=PUBLIC_USAGE]
  s.need(actual[KEY]=={'present':True,'value':qualified})
  self.c.delta[KEY]['after']=qualified
  # All remaining keys and every ordered ACL entry must still match exactly.
  s.need(actual==self.c.project(True));return self

frozen=prior.old.Context.bind
s.need(inspect.getsource(frozen).count('old.OwnedContext(')==1)
namespace=dict(frozen.__globals__);library=types.SimpleNamespace(**vars(prior.old.old));library.OwnedContext=OwnedContext;namespace['old']=library
class Context(prior.Context):
 bind=types.FunctionType(frozen.__code__,namespace,frozen.__name__,frozen.__defaults__,frozen.__closure__)
 def source_pins(self):
  pins=super().source_pins()
  for file in sorted(HERE.iterdir()):
   if file.is_file():pins[str(file)]=s.sha(s.load(file))
  return dict(sorted(pins.items()))
def rebind(function):
 namespace=dict(function.__globals__);namespace['Context']=Context
 return types.FunctionType(function.__code__,namespace,function.__name__,function.__defaults__,function.__closure__)
configuration=rebind(prior.configuration);dispatch=rebind(prior.dispatch)
if __name__=='__main__':
 import json,sys,traceback
 try:
  s.need(len(sys.argv)==2)
  if sys.argv[1]=='configuration':result=configuration()
  else:
   raw=sys.stdin.buffer.read(32*1024**2+1);s.need(0<len(raw)<=32*1024**2);result=dispatch(sys.argv[1],json.loads(raw))
  print(json.dumps(result,ensure_ascii=False,separators=(',',':')))
 except Exception:
  traceback.print_exc(file=sys.stderr);print('{"result":"unconfirmed","code":"OWNED_LOGO41_ACL_REFUSED"}',file=sys.stderr);sys.exit(1)
