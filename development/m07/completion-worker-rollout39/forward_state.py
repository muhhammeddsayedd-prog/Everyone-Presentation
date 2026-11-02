"""Additive initial-baseline qualification; frozen State4c SQL is inherited."""
from pathlib import Path
import copy,hashlib,importlib.util
HERE=Path(__file__).resolve().parent
BASE_SHA='4c184701d181e539d3b5de2d2d4a68d7a985086c195108872dde5d6fe61a4ff9'
file=HERE/'state.py'
if hashlib.sha256(file.read_bytes()).hexdigest()!=BASE_SHA:raise ValueError('FORWARD39_BASE_SOURCE_CHANGED')
spec=importlib.util.spec_from_file_location('completion39_forward_frozen_state4c',file);base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
need=base.need

class State(base.State):
 def initial(self,value):
  self.check(value)
  legacy=value['canonical']['base']['legacy']
  need(type(legacy)is dict and set(legacy)=={'unsupported_metadata_count','job_count','kinds'}and type(legacy['unsupported_metadata_count'])is int and legacy['unsupported_metadata_count']==0)
  need(type(legacy['job_count'])is int and legacy['job_count']>=0 and type(legacy['kinds'])is dict and set(legacy['kinds'])<=set(('specs_extract','candidate_scan','frame_extract','ai_suggestion','review_fit','presentation_render','presentation_export')))
  need(all(type(n)is int and n>=0 for n in legacy['kinds'].values())and sum(legacy['kinds'].values())==legacy['job_count'])
  current=copy.deepcopy(value['canonical']);anchor=copy.deepcopy(self.anchor)
  for item in(current,anchor):
   del item['base']['data'];del item['base']['trace_rows'];del item['project39']['intent_rows']
   del item['base']['legacy']['job_count'];del item['base']['legacy']['kinds']
  need(current==anchor)
  need(all(row['public']['enabled']is True for row in value['canonical']['processing_config'].values()))
  need(value['canonical']['processing_config']['frame_extraction_config']['public']['native_image_id']==base.OLD_NATIVE)
  return value
 def sql_contract_sha256(self):return base.sha(base.load(Path(__file__).resolve()))
