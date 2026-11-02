"""Default-off pure baseline proposal. No CLI, private I/O or provider entry."""
from pathlib import Path
import copy,hashlib,importlib.util,json
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
file=HERE.parent/'review-link-reason40-main-diagnostics/context.py'
if hashlib.sha256(file.read_bytes()).hexdigest()!='209378698e118b6c5ce0b292f5ed1772c1a9cfd8f40a2000c159fb1c362ffcf6':raise ValueError('REASON40_FROZEN_CONTEXT_CHANGED')
spec=importlib.util.spec_from_file_location('reason40_forward_frozen_context',file);prior=importlib.util.module_from_spec(spec);spec.loader.exec_module(prior);s=prior.base
LIVE_ENABLED=False
CLASSIFICATION='tracking/evidence/m07/review-link-reason40-main-diagnostics/canonical-drift-classification-5f5644bd.json'
CLASSIFICATION_SHA='e4b3a20db058d3fc0cab1b803fbf6d50e8b56823d847689f5af5141f52b0404c'
OLD={'oauth':'b222bec0934eddf375b33b6c474ac027882e807cc4657f021f28ea011c3b8a07','identities':{'count':6442,'sha256':'4c2f95e5b47e3567448f8bee52c0b656278e3ebfd8ce55f5656ed22aa0be7724'},'catalogue':{'count':20412,'sha256':'5465dd6b02b8496b41991360da18f86b9022f383d9d0e9ec2827cdc9404fafd8'}}
CURRENT={'oauth':'28a39ad2c523e1637be62ca226f2f272f5a3e116f1817a5d901dbb7fc148225f','identities':{'count':6443,'sha256':'d49227164cdbe18aac92c2b9ac295365a9f22959c58f3b3b273123d91d8c6392'},'catalogue':{'count':20428,'sha256':'55171de705714269420f778c895f4ccf1382c4db0e356b9a67a41bbfacd848a8'}}
SCOPE='classified_current_full_identity_to_future40_only'
def anchor_from(historical,classification):
 s.need(classification['identity']['historical_aggregate']==OLD['identities']and classification['identity']['current_aggregate']==CURRENT['identities']and classification['identity']['additions_only_reconstructs_historical']is False)
 s.need(classification['catalogue']['added_count']==17 and classification['catalogue']['removed_keys']==['constraints|storage.buckets.buckets_versioning_dark_check|definition']and classification['catalogue']['changed_keys']==[])
 s.need(classification['upstream_source_match']['git_blob_sha1']=='d0e28135e866601b78de24dee901c026fcb4a2eb'and classification['upstream_source_match']['new_function_prosrc_exact_bytes_match']is True)
 s.need(classification['oauth']['current_claims_count']==3 and classification['oauth']['historical_claims_count']==2 and all(classification['oauth'][key]is True for key in('current_full_hash_matches','current_static_hash_matches','historical_static_hash_matches','only_old_count_replacement_reconstructs_historical_full_hash')))
 s.need(historical['base']['oauth']['sha256']==OLD['oauth']and historical['project39']['old_identities']==OLD['identities']and historical['project39']['remaining_catalogue']==OLD['catalogue'])
 forward=copy.deepcopy(historical);forward['base']['oauth']['sha256']=CURRENT['oauth'];forward['project39']['old_identities']=copy.deepcopy(CURRENT['identities']);forward['project39']['remaining_catalogue']=copy.deepcopy(CURRENT['catalogue']);return forward
class ProposedContext(prior.Context):
 def __init__(self,*args,**kwargs):
  super().__init__(*args,**kwargs);raw=s.load(self.source/CLASSIFICATION);s.need(s.sha(raw)==CLASSIFICATION_SHA);classification=json.loads(raw)
  self.historical39_anchor=copy.deepcopy(self.anchor);self.forward_identity_scope=SCOPE;self.historical_identity_equivalence_since39=False
  self.anchor=anchor_from(self.historical39_anchor,classification)
 def source_pins(self):
  pins=super().source_pins();pins[str(self.source/CLASSIFICATION)]=CLASSIFICATION_SHA
  for file in sorted(HERE.iterdir()):
   if file.is_file():pins[str(file)]=s.sha(s.load(file))
  return dict(sorted(pins.items()))
 def admission(self):
  value=super().admission();value['forward_baseline']={'classification':{'path':CLASSIFICATION,'sha256':CLASSIFICATION_SHA},'current_full_identity':CURRENT['identities'],'scope':SCOPE,'historical_identity_equivalence_since39':False,'SQL_queries_and_transaction_methods_inherited_unchanged':True};return value
if __name__=='__main__':
 # No live phase exists. A later reviewed entry and actual owned proof are required.
 print('{"result":"disabled_source_proposal","live_enabled":false}');raise SystemExit(1)
