"""Same owned adapter/dispatch, with the real alias-safe Context correction."""
from pathlib import Path
import importlib.util,json,sys,types
HERE=Path(__file__).resolve().parent;MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
alias=module('collector41_fixed_canonical_context',HERE.parent/'logo-info-canonical-alias-release/state.py')
file=MAIN/'development/m07/logo-info-collector-proof/local.py';alias.need(alias.sha(alias.load(file))=='7426176548939d27caf039c9d93b6dcd79791ab3a1bdb4a99b75daab1ec86fd5');old=module('collector41_frozen_owned_adapter',file)
class Context(old.Context):
 def normalized(self,text):return alias.correct_rows(super().normalized(text),text.count('to_jsonb(p)'))
 def source_pins(self):
  pins=super().source_pins()
  for file in sorted((HERE.parent/'logo-info-canonical-alias-release').iterdir()):
   if file.is_file():pins[str(file)]=alias.sha(alias.load(file))
  return dict(sorted(pins.items()))
def bind(function):
 namespace=dict(function.__globals__);namespace['Context']=Context
 return types.FunctionType(function.__code__,namespace,function.__name__,function.__defaults__,function.__closure__)
configuration=bind(old.configuration);dispatch=bind(old.dispatch)
if __name__=='__main__':
 try:
  alias.need(len(sys.argv)==2)
  if sys.argv[1]=='configuration':result=configuration()
  else:
   raw=sys.stdin.buffer.read(32*1024**2+1);alias.need(0<len(raw)<=32*1024**2);result=dispatch(sys.argv[1],json.loads(raw))
  print(json.dumps(result,ensure_ascii=False,separators=(',',':')))
 except Exception:
  __import__('traceback').print_exc(file=sys.stderr)
  print('{"result":"unconfirmed","code":"OWNED_LOGO41_ALIAS_REFUSED"}',file=sys.stderr);sys.exit(1)
