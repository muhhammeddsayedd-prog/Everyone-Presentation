"""Single row-guard alias correction over frozen41 Context; no field masks."""
from pathlib import Path
import hashlib,importlib.util
HERE=Path(__file__).resolve().parent;SOURCE=HERE.parents[2];MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
file=MAIN/'development/m07/logo-info-canonical-release/state.py'
if hashlib.sha256(file.read_bytes()).hexdigest()!='701d7aeb4b57b45092f91b84abea5f2136c57a79be407a2ba92ec868b1da6a3a':raise ValueError('LOGO41_FROZEN_CONTEXT_CHANGED')
spec=importlib.util.spec_from_file_location('logo41_alias_frozen_state',file);old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
for name in dir(old):
 if not name.startswith('_')and name not in('HERE','SOURCE','Context'):globals()[name]=getattr(old,name)
ROW_OLD="p.oid='eps.logo_storage_read_allowed(text,text)'::regprocedure and to_jsonb(p)?'prosrc'"
ROW_NEW="(to_jsonb(p)->>'oid')::oid='eps.logo_storage_read_allowed(text,text)'::regprocedure and to_jsonb(p)?'prosrc'"
def correct_rows(prior,count):
 need(prior.count(ROW_OLD)==count);result=prior.replace(ROW_OLD,ROW_NEW);need(result.replace(ROW_NEW,ROW_OLD)==prior);return result
class Context(old.Context):
 def normalized(self,text):
  return correct_rows(super().normalized(text),text.count('to_jsonb(p)'))
 def source_pins(self):
  pins=super().source_pins()
  for file in sorted(HERE.iterdir()):
   if file.is_file():pins[str(file)]=sha(load(file))
  return dict(sorted(pins.items()))
