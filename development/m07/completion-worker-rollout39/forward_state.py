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
  legacy=value['canonical']['base']['legacy'];historical=self.anchor['base']['legacy']
  for item in(legacy,historical):
   need(type(item)is dict and set(item)=={'unsupported_metadata_count','job_count','kinds'}and type(item['unsupported_metadata_count'])is int and item['unsupported_metadata_count']==0)
   need(type(item['job_count'])is int and item['job_count']>=0 and type(item['kinds'])is dict and set(item['kinds'])<=set(('specs_extract','candidate_scan','frame_extract','ai_suggestion','review_fit','presentation_render','presentation_export')))
   need(all(type(n)is int and n>=0 for n in item['kinds'].values())and sum(item['kinds'].values())==item['job_count'])
  need(legacy['job_count']>=historical['job_count']and all(legacy['kinds'].get(kind,0)>=count for kind,count in historical['kinds'].items()))
  current=copy.deepcopy(value['canonical']);anchor=copy.deepcopy(self.anchor)
  for item in(current,anchor):
   del item['base']['data'];del item['base']['trace_rows'];del item['project39']['intent_rows']
   del item['base']['legacy']['job_count'];del item['base']['legacy']['kinds']
  need(current==anchor)
  need(all(row['public']['enabled']is True for row in value['canonical']['processing_config'].values()))
  need(value['canonical']['processing_config']['frame_extraction_config']['public']['native_image_id']==base.OLD_NATIVE)
  return value
 def sql_contract_sha256(self):return base.sha(base.load(Path(__file__).resolve()))
