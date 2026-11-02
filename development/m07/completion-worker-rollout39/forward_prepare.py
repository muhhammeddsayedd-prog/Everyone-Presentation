"""New default-off read-only preparation continuation; frozen transports reused."""
from pathlib import Path
import hashlib,importlib.util,json,sys,uuid
HERE=Path(__file__).resolve().parent
FORWARD_ENABLED=False
FROZEN={'state.py':'4c184701d181e539d3b5de2d2d4a68d7a985086c195108872dde5d6fe61a4ff9','provider.py':'8ae748c4176ae6553e2fcdef81696aa0bce6652a8d0991c449aa95e147749054','controller.py':'76aec005352f845928454e4aaba1b1f4700a00820a54d35f512cb401ed7c764c','forward_state.py':'f8aa16ba5f5969d497d1326b3368cc66c98dddd59cc675f633af0377d6506107'}
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
for name,digest in FROZEN.items():
 if hashlib.sha256((HERE/name).read_bytes()).hexdigest()!=digest:raise ValueError('FORWARD39_FROZEN_SOURCE_CHANGED')
p=module('completion39_forward_frozen_provider',HERE/'provider.py');c=module('completion39_forward_frozen_controller',HERE/'controller.py');f=module('completion39_forward_new_state',HERE/'forward_state.py');need=p.need
PRIOR_SHA='4a599d9c76a9536e19486d4d589462e652f685a1f1e48bed92701855ccdc6ffa'
FAILURES={'tracking/evidence/m07/completion-worker/2026-11-02T01-15-35-164257Z-rollout39-prepare.json':'2075ee170319ea718b79401e6bdedff0da7e9051302f38762aa8df1c2780c3f3','tracking/evidence/m07/completion-worker/2026-11-02T01-19-26-790016Z-rollout39-prepare.json':'d4c93274aeb8ad3c16d10e9bd986904175fee658de266fbdb03475035f5acdfc'}
ADDITIONS={'forward_state.py','test_forward_state.py','forward_prepare.py','forward_inputs.json','test_forward_prepare.py','FORWARD.md'}
CLAIM='forward-prepare.claim.json'

class ForwardProvider(p.Provider):
 def __init__(self):
  super().__init__();self.s=f.State();previous=self.inputs['startup_observer_sha256'];self.inputs=json.loads(p.s.load(HERE/'forward_inputs.json'))
  need(set(self.inputs)=={'startup_observer_sha256','native_concurrency'}and self.inputs['startup_observer_sha256']==previous)
 def concurrency(self):
  ref=self.inputs['native_concurrency'];need(type(ref)is dict and set(ref)=={'path','sha256'}and ref['path'].startswith('tracking/evidence/')and'..'not in Path(ref['path']).parts)
  raw=p.s.load(p.s.MAIN/ref['path']);need(p.s.sha(raw)==ref['sha256']);p.check_native_concurrency(json.loads(raw),self.s.sql_contract_sha256());return ref
 def admission(self,phase):
  ref=self.concurrency();value=super().admission(phase);value['references']['native_concurrency']=ref;return value

def retained_preparation(port,pins):
 port._ensure();need(not port.exists('plan.json')and not port.exists(CLAIM))
 need({file.name for file in p.PRIVATE.glob('*.claim.json')}=={'prepare.claim.json'})
 need(port.hash('prepare.claim.json')==PRIOR_SHA);prior=port.read('prepare.claim.json');need(prior['provider_reads_only']is True)
 need(all(pins.get(key)==digest for key,digest in prior['pins'].items()))
 added=set(pins)-set(prior['pins']);need(added=={str(HERE/name)for name in ADDITIONS})
 for name,digest in FROZEN.items():need(pins[str(HERE/name)]==digest)
 failures=[]
 for relative,digest in FAILURES.items():
  raw=p.s.load(p.s.ROOT/relative);need(p.s.sha(raw)==digest);value=json.loads(raw)
  need(value['result']=='unconfirmed'and value['action']=='prepare'and value['run']==p.RUN and value['source_sha256']==p.s.SOURCE and value['provider_rollback_or_AT069_performed']is False)
  failures.append({'path':relative,'sha256':digest})
 return {'prepare_claim_sha256':PRIOR_SHA,'prepare_claim_protected_file':(p.PRIVATE/'prepare.claim.json').relative_to(p.s.MAIN).as_posix(),'failed_preparations':failures,'retained_old_pins_unchanged':True}

def prepare(port):
 pins=port.pins();retained=retained_preparation(port,pins);proof=port.concurrency()
 port.write(CLAIM,{'pins':pins,'retained_read_only_preparation':retained,'native_concurrency':proof,'provider_reads_only':True,'automatic_retry':False})
 admission=port.admission('prepare');first,second=port.snapshot(),port.snapshot();need(first==second);port.s.initial(first)
 before,again=port.environment(),port.environment();need(before==again);actions=port.e.actions(before)
 old,again=port.old_ready(),port.old_ready();need(old==again and port.inventory()==[old['instance_id']])
 checkpoint=port.checkpoint(first);need(port.snapshot()==first);output=port.output();need(port.pins()==pins and port.admission('prepare')==admission)
 reference={'retained_read_only_preparation':retained,'forward_claim_sha256':port.hash(CLAIM)}
 plan={'purpose':'completion-worker-production39','pins':pins,'admission':admission,'checkpoint':checkpoint,'before':first,'environment':before,'environment_actions':actions,'old':old,'output':output,'marker':str(uuid.uuid4()),'forward_preparation':reference}
 port.write('plan.json',plan)
 return {'result':'prepared','provider_mutations':False,'retained_prepare_claim_sha256':PRIOR_SHA,'forward_claim_sha256':reference['forward_claim_sha256'],'sql_contract_sha256':port.s.sql_contract_sha256(),'baseline_sha256':p.s.sha(json.dumps(first,sort_keys=True).encode()),'old_instance_id':old['instance_id']}

def operate(action,port):
 need(FORWARD_ENABLED)
 if action!='prepare':
  plan=port.read('plan.json');reference=plan['forward_preparation'];need(reference['retained_read_only_preparation']['prepare_claim_sha256']==PRIOR_SHA and reference['forward_claim_sha256']==port.hash(CLAIM))
  return c.operate(action,port,port.s)
 try:result=prepare(port)
 except Exception:result={'result':'unconfirmed','code':'FORWARD39_PREPARATION_UNCONFIRMED','claim_retained':True,'automatic_retry':False,'provider_rollback_or_AT069_performed':False}
 return port.save('forward-prepare',result)

def main():
 need(FORWARD_ENABLED and len(sys.argv)==2);port=ForwardProvider();result=operate(sys.argv[1],port);print(json.dumps(result))
 if result['result']not in('passed','prepared','submitted','observed'):raise ValueError('FORWARD39_UNCONFIRMED')
if __name__=='__main__':
 try:main()
 except Exception:print('FORWARD39_UNCONFIRMED');sys.exit(1)
