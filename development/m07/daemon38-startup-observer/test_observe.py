"""Inert fake API envelopes and pinned local projector; no external query."""
from pathlib import Path
import copy, importlib.util, io, json, subprocess, sys, unittest
from unittest.mock import Mock, patch
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('observer38_tests',HERE/'observe.py');o=importlib.util.module_from_spec(spec);spec.loader.exec_module(o)
START=1793556000000
INSTANCE={'id':o.INSTANCE,'started_at_ms':START}
SCOPE={'deployment':o.DEPLOYMENT,'instance':INSTANCE,'window':{'start':START,'end':START+600000}}
def payload():
 event={'timestamp':o.iso(START+1),'projectId':o.d.PROJECT,'deploymentId':o.DEPLOYMENT,'source':'daemon','daemonName':'worker','daemonInstanceId':o.INSTANCE,
  'environment':'','attributes':{'scope.type':'target','scope.value':'production'},'truncated':False,'message':json.dumps({'event':'specs_worker_started','authentication':'narrow_database_login','orchestration':'n8n_required'})}
 return {'events':[event],'pagination':{'hasMore':False,'nextCursor':None},'meta':{'excludedIntervals':[]}}
def project(kind,value):
 assert kind=='runtime'
 program="import fs from'node:fs';const p=JSON.parse(fs.readFileSync(0,'utf8'));const m=await import("+json.dumps(o.d.RUNTIME.as_uri())+");process.stdout.write(JSON.stringify(m.projectRuntimeLogs(p.text,p.scope)));"
 result=subprocess.run([str(o.d.NODE),'--input-type=module','-e',program],input=json.dumps(value).encode(),capture_output=True,timeout=5,env=o.d.environment())
 assert result.returncode==0
 return json.loads(result.stdout)

class Tests(unittest.TestCase):
 def test_default_false_entry_refuses_before_private_or_provider_ports(self):
  self.assertIs(type(o.OBSERVE_ENABLED),bool)
  with patch.object(o,'OBSERVE_ENABLED',False),patch.object(o,'pins')as pins,patch.object(o.d,'readback')as read,patch.object(sys,'argv',['observe.py']):
   with self.assertRaises(ValueError):o.main()
   pins.assert_not_called();read.assert_not_called()

 def test_held_source_and_explicit_read_only_cli_contract_are_pinned(self):
  self.assertEqual(o.sha(o.d.load(o.DEPLOY)),o.DEPLOY_SHA)
  for name,digest in o.CLI_PINS.items():self.assertEqual(o.sha(o.d.load(o.d.CLI.parent/name)),digest)
  command=o.command();self.assertIn(o.ENDPOINT,command);self.assertEqual(command[command.index('--method')+1],'POST');self.assertIn(o.HEADER,command);self.assertEqual(command[command.index('--input')+1],'-');self.assertIn(o.d.SLUG,command)
  body=o.request(SCOPE);self.assertEqual(body['scope'],{'ownerId':o.d.TEAM,'projectIds':[o.d.PROJECT]});self.assertEqual(body['limit'],100)
  self.assertIn('daemonName',body['select']);self.assertIn('daemonInstanceId',body['select']);self.assertIn(o.DEPLOYMENT,body['filter']);self.assertIn(o.INSTANCE,body['filter'])

 def test_fixed_historical_window_cannot_roll_or_change_instance(self):
  self.assertEqual(o.window(INSTANCE,START+600000),SCOPE['window'])
  with self.assertRaises(ValueError):o.window(INSTANCE,START+599999)
  bad=copy.deepcopy(SCOPE);bad['window']['start']-=1
  with self.assertRaises(ValueError):o.request(bad)
  bad=copy.deepcopy(SCOPE);bad['instance']['id']='dmni_foreign'
  with self.assertRaises(ValueError):o.request(bad)

 def test_only_empty_environment_is_removed_and_real_identity_is_retained(self):
  text,proof=o.normalize(payload(),SCOPE);first=json.loads(text.splitlines()[0])['data']
  self.assertNotIn('environment',first);self.assertEqual(first['daemonName'],'worker');self.assertEqual(first['daemonInstanceId'],o.INSTANCE);self.assertFalse(proof['identity_synthesized'])
  result=project('runtime',{'text':text,'scope':SCOPE});self.assertEqual(result['events']['worker_started'],1);self.assertEqual(result['unbound_records'],0)

 def test_missing_foreign_or_conflicting_identity_cannot_be_supplied_by_filter(self):
  for key,value in [('daemonName',None),('daemonInstanceId',None),('daemonInstanceId','dmni_foreign'),('projectId','prj_foreign'),('deploymentId','dpl_foreign'),('source','function')]:
   bad=payload()
   if value is None:del bad['events'][0][key]
   else:bad['events'][0][key]=value
   with self.assertRaises(ValueError):o.normalize(bad,SCOPE)
  for key in ['daemonInstanceId','projectId','deploymentId','source']:
   bad=payload();bad['events'][0]['attributes'][key]='foreign'
   with self.assertRaises(ValueError):o.normalize(bad,SCOPE)

 def test_production_binding_and_complete_untruncated_error_free_page_are_required(self):
  mutations=[lambda p:p['events'][0].update(environment='preview'),lambda p:p['events'][0]['attributes'].update({'scope.value':'preview'}),
   lambda p:p['events'][0].update(truncated=True),lambda p:p['events'][0].pop('truncated'),lambda p:p.update(error={}),lambda p:p.update(errors=[]),lambda p:p.update(warnings=['unprinted']),
   lambda p:p['pagination'].update(hasMore=True),lambda p:p['pagination'].update(nextCursor='unprinted'),lambda p:p['pagination'].pop('nextCursor'),lambda p:p['meta'].update(excludedIntervals=[{}])]
  for mutate in mutations:
   bad=payload();mutate(bad)
   with self.assertRaises(ValueError):o.normalize(bad,SCOPE)

 def test_startup_override_uses_unchanged_projector_and_rejects_wrong_time_or_failure(self):
  port=o.ObserverPorts();port.project_js=project
  with patch.object(o,'OBSERVE_ENABLED',True),patch.object(o,'pins',return_value={'synthetic':'a'*64}),patch.object(o,'post',return_value=payload()):
   value=port.startup(o.DEPLOYMENT,INSTANCE);self.assertEqual(value['events']['worker_started'],1);self.assertTrue(value['explicit_select_observer']['read_only_observability_post'])
  for mode in ['time','failure']:
   bad=payload()
   if mode=='time':bad['events'][0]['timestamp']=o.iso(START-1)
   else:bad['events'].append({**bad['events'][0],'message':json.dumps({'event':'hosted_worker_unconfirmed'})})
   with patch.object(o,'OBSERVE_ENABLED',True),patch.object(o,'pins',return_value={'synthetic':'a'*64}),patch.object(o,'post',return_value=bad):
    with self.assertRaises(ValueError):port.startup(o.DEPLOYMENT,INSTANCE)

 def test_main_reuses_original_readback_with_only_startup_override(self):
  expected={'result':'passed','receipt':'synthetic-only'}
  with patch.object(o,'OBSERVE_ENABLED',True),patch.object(o,'pins',return_value={'synthetic':'a'*64}),patch.object(o.d,'readback',return_value=expected)as read,patch.object(sys,'argv',['observe.py']):
   self.assertEqual(o.main(),expected);self.assertIsInstance(read.call_args.args[0],o.ObserverPorts)
  self.assertEqual({key for key in o.ObserverPorts.__dict__ if not key.startswith('__')}, {'startup'})

 def test_transport_caps_output_and_never_returns_raw_failure(self):
  class Process:
   def __init__(self,stdout,timeout=False):self.stdin=io.BytesIO();self.stdout=io.BytesIO(stdout);self.stderr=io.BytesIO();self.returncode=0;self.timeout=timeout;self.kills=0
   def kill(self):self.kills+=1;self.returncode=-9
   def wait(self,timeout=None):
    if self.timeout:self.timeout=False;raise subprocess.TimeoutExpired('synthetic',1)
    return self.returncode
  process=Process(json.dumps(payload()).encode())
  with patch.object(subprocess,'Popen',return_value=process):self.assertEqual(o.post(o.request(SCOPE)),payload())
  for process in [Process(b'x'*(1048576+4096)),Process(b'',True)]:
   with patch.object(subprocess,'Popen',return_value=process):
    with self.assertRaisesRegex(ValueError,'^DAEMON38_EXPLICIT_STARTUP_UNCONFIRMED$'):o.post(o.request(SCOPE))
   self.assertGreaterEqual(process.kills,1)

if __name__=='__main__':unittest.main()
