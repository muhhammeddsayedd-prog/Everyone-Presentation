"""Additive repeatable read-only preflight, then one final preparation claim."""
from pathlib import Path
import hashlib,importlib.util,json,sys,uuid
HERE=Path(__file__).resolve().parent
COMPLETE_ENABLED=True
FORWARD_SHA='9071469ebf91592bb5175691cad2ee6f08dac630b503157c4d5cff2ae9e3a4ba'
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
if hashlib.sha256((HERE/'forward_prepare.py').read_bytes()).hexdigest()!=FORWARD_SHA:raise ValueError('COMPLETE39_FROZEN_SOURCE_CHANGED')
f=module('complete39_frozen_forward',HERE/'forward_prepare.py');h=module('complete39_cached_platform_health',HERE/'platform_health.py');p=f.p;need=f.need
CLAIM='complete-preparation.claim.json'
OLD_CLAIMS={'prepare.claim.json':f.PRIOR_SHA,'forward-prepare.claim.json':'a349e9100f719c79b1e12f61355deaa1be53217bb3bf37bd52fa10d58888ff77'}
FAILURES={**f.FAILURES,'tracking/evidence/m07/completion-worker/2026-11-02T01-32-57-690180Z-rollout39-forward-prepare.json':'ccb6a0255c8d5f72a6c2a96e64439854b01e867d9c7875a89867752d20d841a1'}
ADDITIONS={'platform_health.py','complete_preparation.py','test_complete_preparation.py','COMPLETION.md'}
class CompletionProvider(f.ForwardProvider):
 def __init__(self):super().__init__();self.cached_health=[]
 def healthy(self,value,deployment,digest):
  identity,cached=h.control_plane_ready(value,deployment,digest);need(len(self.cached_health)<32);self.cached_health.append(cached);return identity
 def save(self,action,value):return super().save(action,{**value,'cached_platform_health_metadata':self.cached_health,'fresh_application_heartbeat_claimed':False,'new_worker_complete_startup_log_gate_unchanged':True})

def retained(port,pins):
 port._ensure();need(not port.exists('plan.json')and not port.exists(CLAIM)and not port.exists('canonical39-checkpoint.json'))
 need({file.name for file in p.PRIVATE.glob('*.claim.json')}==set(OLD_CLAIMS))
 for name,digest in OLD_CLAIMS.items():
  need(port.hash(name)==digest);claim=port.read(name);need(claim['provider_reads_only']is True and all(pins.get(key)==value for key,value in claim['pins'].items()))
 forward=port.read('forward-prepare.claim.json');need(forward['retained_read_only_preparation']['prepare_claim_sha256']==f.PRIOR_SHA and forward['native_concurrency']==port.concurrency())
 need(set(pins)-set(forward['pins'])=={str(HERE/name)for name in ADDITIONS})
 failures=[]
 for relative,digest in FAILURES.items():
  raw=p.s.load(p.s.ROOT/relative);need(p.s.sha(raw)==digest);value=json.loads(raw);need(value['result']=='unconfirmed'and value['action']in('prepare','forward-prepare')and value['run']==p.RUN and value['source_sha256']==p.s.SOURCE and value['provider_rollback_or_AT069_performed']is False);failures.append({'path':relative,'sha256':digest})
 return {'claims':dict(OLD_CLAIMS),'failed_preparations':failures,'old_source_pins_unchanged':True}

def observe(port):
 pins=port.pins();prior=retained(port,pins);admission=port.admission('prepare');first,second=port.snapshot(),port.snapshot();need(first==second);port.s.initial(first)
 before,again=port.environment(),port.environment();need(before==again);actions=port.e.actions(before)
 old,again=port.old_ready(),port.old_ready();need(old==again and port.inventory()==[old['instance_id']]);need(port.snapshot()==first and port.pins()==pins)
 return {'pins':pins,'retained':prior,'admission':admission,'before':first,'environment':before,'actions':actions,'old':old}

def prepare(port):
 observed=observe(port);port.write(CLAIM,{'pins':observed['pins'],'retained_read_only_preparations':observed['retained'],'provider_reads_only':True,'automatic_retry':False})
 checkpoint=port.checkpoint(observed['before']);output=port.output();need(port.snapshot()==observed['before']and port.environment()==observed['environment']);port.old_matches(observed['old'])
 need(port.pins()==observed['pins']and port.admission('prepare')==observed['admission'])
 reference={'retained_read_only_preparation':port.read('forward-prepare.claim.json')['retained_read_only_preparation'],'forward_claim_sha256':OLD_CLAIMS['forward-prepare.claim.json'],'completion_claim_sha256':port.hash(CLAIM),'all_retained_read_only_preparations':observed['retained']}
 plan={'purpose':'completion-worker-production39','pins':observed['pins'],'admission':observed['admission'],'checkpoint':checkpoint,'before':observed['before'],'environment':observed['environment'],'environment_actions':observed['actions'],'old':observed['old'],'output':output,'marker':str(uuid.uuid4()),'forward_preparation':reference}
 port.write('plan.json',plan);return {'result':'prepared','provider_mutations':False,'completion_claim_sha256':reference['completion_claim_sha256'],'sql_contract_sha256':port.s.sql_contract_sha256(),'baseline_sha256':p.s.sha(json.dumps(observed['before'],sort_keys=True).encode()),'old_instance_id':observed['old']['instance_id']}

def operate(action,port):
 need(COMPLETE_ENABLED)
 if action not in('preflight','prepare'):
  plan=port.read('plan.json');need(plan['forward_preparation']['completion_claim_sha256']==port.hash(CLAIM)and all(port.hash(name)==digest for name,digest in OLD_CLAIMS.items()));return f.operate(action,port)
 try:
  if action=='prepare':result=prepare(port)
  else:
   value=observe(port);result={'result':'observed','read_only':True,'provider_mutations':False,'plan_or_new_claim_created':False,'baseline_sha256':p.s.sha(json.dumps(value['before'],sort_keys=True).encode()),'old_instance_id':value['old']['instance_id']}
 except Exception:result={'result':'unconfirmed','code':'COMPLETE39_PREFLIGHT_OR_PREPARATION_UNCONFIRMED','claim_retained':True,'automatic_mutation_retry':False,'provider_rollback_or_AT069_performed':False}
 return port.save('complete-'+action,result)
def main():
 need(COMPLETE_ENABLED and len(sys.argv)==2);port=CompletionProvider();result=operate(sys.argv[1],port);print(json.dumps(result))
 if result['result']not in('passed','prepared','submitted','observed'):raise ValueError('COMPLETE39_UNCONFIRMED')
if __name__=='__main__':
 try:main()
 except Exception:print('COMPLETE39_UNCONFIRMED');sys.exit(1)
