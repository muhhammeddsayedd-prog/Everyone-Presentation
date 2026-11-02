"""Versioned correction: only JSONB deletion's RHS type, never its six keys."""
from pathlib import Path
import hashlib,importlib.util
HERE=Path(__file__).resolve().parent;PRIOR=HERE.parent/'review-link-reason40-canonical-release'
BASE_SHA='712762e9b1b886e986111510b9823a88c7490edf689fb68a50a32b4dbba146f2'
file=PRIOR/'state.py'
if hashlib.sha256(file.read_bytes()).hexdigest()!=BASE_SHA:raise ValueError('REASON40_FROZEN_STATE_CHANGED')
spec=importlib.util.spec_from_file_location('reason40_typed_frozen_state',file);base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
KEYS=['columns|eps.audit_events.reason|'+key for key in('type','not_null','acl','identity','generated','default')]
OLD='catalog-'+base.json_sql(KEYS)
NEW='catalog-ARRAY['+','.join(base.literal(key)for key in KEYS)+']::text[]'
def correct(context):
 context.c.catalogue=base.replace_once(context.c.catalogue,OLD,NEW)
 base.need(base.replace_once(context.c.catalogue,NEW,OLD).count(OLD)==1)
 return context
class Context(base.Context):
 def __init__(self,*args,**kwargs):super().__init__(*args,**kwargs);correct(self)
 def source_pins(self):
  pins=super().source_pins()
  for file in sorted(HERE.iterdir()):
   if file.is_file():pins[str(file)]=base.sha(base.load(file))
  return dict(sorted(pins.items()))
