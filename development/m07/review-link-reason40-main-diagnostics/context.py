"""Source pin extension only; all ACL/type/query/acceptance bytes inherited."""
from pathlib import Path
import importlib.util,hashlib
HERE=Path(__file__).resolve().parent;ACL=HERE.parent/'review-link-reason40-acl-collector'
file=ACL/'context.py'
if hashlib.sha256(file.read_bytes()).hexdigest()!='ffe2b950f185789111346e2cd5120c577169d654be8c949a06dc34cbd99cf9e4':raise ValueError('REASON40_ACL_CONTEXT_CHANGED')
spec=importlib.util.spec_from_file_location('reason40_main_frozen_acl_context',file);acl=importlib.util.module_from_spec(spec);spec.loader.exec_module(acl);base=acl.base
class Context(acl.Context):
 def source_pins(self):
  pins=super().source_pins()
  for file in sorted(HERE.iterdir()):
   if file.is_file():pins[str(file)]=base.sha(base.load(file))
  return dict(sorted(pins.items()))
