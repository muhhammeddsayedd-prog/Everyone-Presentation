"""Additive ACL-shape correction. Existing reference ACLs remain exact."""
from pathlib import Path
import hashlib,importlib.util
HERE=Path(__file__).resolve().parent;TYPED=HERE.parent/'review-link-reason40-typed-collector'
file=TYPED/'context.py';EXPECTED='d35aea7b80f1c496ae99f10b2379eb8dbd63bf6bc7609c705dc406280278e188'
if hashlib.sha256(file.read_bytes()).hexdigest()!=EXPECTED:raise ValueError('REASON40_TYPED_CONTEXT_CHANGED')
spec=importlib.util.spec_from_file_location('reason40_acl_frozen_typed_context',file);typed=importlib.util.module_from_spec(spec);spec.loader.exec_module(typed);base=typed.base
OLD="reference.attacl is null and(to_jsonb(a)-array['attname','attnum']::text[])=(to_jsonb(reference)-array['attname','attnum']::text[])"
NEW="a.attacl is null and(to_jsonb(a)-array['attname','attnum','attacl']::text[])=(to_jsonb(reference)-array['attname','attnum','attacl']::text[])"
def correct_reason(sql):return base.replace_once(sql,OLD,NEW)
class Context(typed.Context):
 def reason_sql(self):return correct_reason(super().reason_sql())
 def source_pins(self):
  pins=super().source_pins()
  for file in sorted(HERE.iterdir()):
   if file.is_file():pins[str(file)]=base.sha(base.load(file))
  return dict(sorted(pins.items()))
