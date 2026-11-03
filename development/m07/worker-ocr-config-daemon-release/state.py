"""Retained3d pause/resume adapter. Same full State, checkpoint and SQL renderer."""
from pathlib import Path
import importlib.util,hashlib
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('ocr_state_anchors',HERE/'anchors.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
old=a.frozen('worker-source-identity-release/state.py');need=a.need
class State(old.State):
 def __init__(self,new_native,**options):need(new_native==a.BASELINE['native_digest']);super().__init__(new_native,**options)
 def check(self,value):
  super().check(value);need(value['schema40']['canonical']['processing_config']['frame_extraction_config']['public']['native_image_id']==self.new_native);return value
 def initial(self,value):
  self.check(value);need(all(row['public']['enabled']is True for row in value['schema40']['canonical']['processing_config'].values()));return value
 def expected(self,before,phase):
  self.check(before);need(phase in('pause','resume'));configs=before['schema40']['canonical']['processing_config'];need(all(row['public']['enabled']is(phase=='pause')for row in configs.values()))
  after=self.comparable(before)
  for row in after['schema40']['canonical']['processing_config'].values():row['public']['enabled']=phase=='resume'
  return after
 def source_pins(self):
  pins=super().source_pins();pins[str(Path(__file__).resolve())]=hashlib.sha256(Path(__file__).read_bytes()).hexdigest();return pins
