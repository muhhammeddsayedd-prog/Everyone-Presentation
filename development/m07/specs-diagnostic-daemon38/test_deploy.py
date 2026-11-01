"""Inert fake rollout/public-evidence checks. No provider, SQL or private reads."""
from pathlib import Path
import copy, importlib.util, json, subprocess, sys, types, unittest
from unittest.mock import Mock,patch

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('daemon38_deploy_tests',HERE/'deploy.py');d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)
OLD_ID='dmni_'+'0'*26;NEW_ID='dmni_'+'1'*26;NEW_DEPLOYMENT='dpl_SYNTHETICNEW123456'
INSTANT=int(d.datetime.datetime.now(d.datetime.timezone.utc).timestamp()*1000)

def packet(deployment,image,identity):
 return {'project_id':d.PROJECT,'team_id':d.TEAM,'deployment_id':deployment,'daemon':'worker','environment':'production','status':'ready',
  'configured_instances':{'dub1':1},'configured_override':None,'memory_mib':2048,'termination_grace_seconds':300,'desired':1,'ready':1,'total':1,
  'requested_image':{'digest':image},'resolved_image':{'digest':image},'instances':[{'id':identity,'alive':True,'image':{'digest':image},'region':'dub1','memory_mib':2048,'stopped_at_ms':None,'started_at_ms':INSTANT-1000,'last_checked_at_ms':INSTANT}]}

def public_inputs():
 v=json.loads((HERE/'inputs.template.json').read_bytes());docs={key:d.reference(v['references'][key])for key in d.CORE};return v,docs

class FakePorts:
 def __init__(self):
  self.calls=[];self.claims={};self.saved_plan=None;self.returned_value=None;self.reports=[];self.current='old';self.fail_deploy=False;self.fail_startup=False;self.old_remains=False
  self.pins_value={'synthetic':'a'*64};self.gates_value={'paused_state':{'full38':'synthetic-preserved','frame_pin':'old795'},'environment':{'hash':d.MANIFEST}};self.files=[{'path':'synthetic/.vc-config.json','sha256':'b'*64,'bytes':100}]
 def pins(self,phase='rollout'):return copy.deepcopy(self.pins_value)
 def gates(self):return copy.deepcopy(self.gates_value)
 def project(self):self.calls.append('project')
 def claim_exists(self,phase):return phase in self.claims
 def output_exists(self):return'synthetic_output'in self.calls
 def inspect(self,deployment):
  self.calls.append('inspect');return packet(deployment,d.OLD_IMAGE,OLD_ID)if deployment==d.OLD else packet(deployment,d.DAEMON,NEW_ID)
 def inventory(self):
  self.calls.append('inventory');return[OLD_ID]if self.current=='old'else sorted([NEW_ID,OLD_ID]if self.old_remains else[NEW_ID])
 def claim(self,phase,value):self.calls.append('claim:'+phase);self.claims[phase]=copy.deepcopy(value)
 def emit(self):self.calls.append('synthetic_output')
 def output(self):return copy.deepcopy(self.files)
 def save_plan(self,value):self.saved_plan=copy.deepcopy(value)
 def plan(self):return copy.deepcopy(self.saved_plan)
 def claimed(self):return copy.deepcopy(self.claims['deploy'])
 def claim_sha(self):return d.sha(json.dumps(self.claims['deploy'],sort_keys=True).encode())
 def run(self,command,timeout=30):
  self.calls.append('deploy_call')
  if self.fail_deploy:raise TimeoutError('PRIVATE response token')
  self.current='new';return'https://everyone-presentation-worker-pilot-syntheticnew.vercel.app\n'
 def returned(self,value):self.returned_value=value
 def return_value(self):d.need(self.returned_value is not None);return self.returned_value
 def deployment(self,url,marker):self.calls.append('deployment_GET');return NEW_DEPLOYMENT
 def startup(self,deployment,instance):
  self.calls.append('startup_GET')
  if self.fail_startup:raise ValueError('PRIVATE log payload')
  return {'complete_window':True,'events':{'worker_started':1,'worker_unconfirmed':0,'worker_paused':0,'pilot_expired':0}}
 def image_ready(self):return {'repository':{'id':d.r.DAEMON_REPO,'public':False},'image':{'runtime_digest':d.DAEMON,'status':'ready'}}
 def save(self,action,value):self.reports.append((action,value));return {'result':value['result'],'receipt':'synthetic-'+action+'.json'}

class Tests(unittest.TestCase):
 def setUp(self):
  flag=patch.object(d,'DEPLOY_ENABLED',True);flag.start();self.addCleanup(flag.stop)

 def test_inert_import_and_false_gate_before_any_runtime_port(self):
  with patch.object(subprocess,'Popen',side_effect=AssertionError('NO_PROCESS')),patch.object(subprocess,'run',side_effect=AssertionError('NO_PROCESS')):
   spec=importlib.util.spec_from_file_location('daemon38_import_again',HERE/'deploy.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  self.assertIs(type(m.DEPLOY_ENABLED),bool);p=FakePorts()
  with patch.object(d,'DEPLOY_ENABLED',False),patch.object(d,'Ports')as ports,patch.object(sys,'argv',['deploy.py','prepare']):
   with self.assertRaises(ValueError):d.main()
   for fn in [d.observe_image,d.prepare,d.dispatch,d.readback]:
    with self.assertRaises(ValueError):fn(p)
  ports.assert_not_called();self.assertFalse(p.calls)

 def test_actual_public_image_proofs_are_bound_and_future_pause_refs_are_null(self):
  v,docs=public_inputs();export=d.image_proofs(v,docs)
  self.assertEqual(export['runtime_digest'],d.DAEMON);self.assertEqual(export['archive']['archive_bytes'],111132672)
  self.assertTrue(all(v['references'][key]is None for key in d.LATE))
  original=d.load
  with patch.object(d,'load',side_effect=lambda path,maximum=16*1024**2:json.dumps(v).encode()if path==d.INPUTS else original(path,maximum)):
   self.assertEqual(d.inputs('image')[0],v)
   with self.assertRaises(ValueError):d.inputs('rollout')

 def test_ready_image_requires_exact_private_daemon_repository_and_ce23_once(self):
  repo={'repository':{'id':d.r.DAEMON_REPO,'projectId':d.PROJECT,'name':'daemon','public':False}}
  row={'repositoryId':d.r.DAEMON_REPO,'manifestDigest':d.DAEMON,'kind':'manifest','status':'ready','arch':'amd64','platform':'linux'}
  self.assertEqual(d.ready_image_projection(repo,{'images':[row]})['image']['runtime_digest'],d.DAEMON)
  for key,value in [('manifestDigest',d.NATIVE),('status','preparing'),('arch','arm64'),('repositoryId',d.r.REPO)]:
   bad=dict(row);bad[key]=value
   with self.assertRaises(ValueError):d.ready_image_projection(repo,{'images':[bad]})
  with self.assertRaises(ValueError):d.ready_image_projection(repo,{'images':[row,row]})
  bad=copy.deepcopy(repo);bad['repository']['public']=True
  with self.assertRaises(ValueError):d.ready_image_projection(bad,{'images':[row]})

 def test_image_ready_is_separate_from_pause_and_deployed_daemon_acceptance(self):
  p=FakePorts()
  with patch.object(d,'inputs',return_value=public_inputs()):out=d.observe_image(p)
  self.assertEqual(out['result'],'ready_image_and_import_gate_observed');self.assertFalse(p.claims)
  value=p.reports[-1][1];self.assertFalse(value['deployed']);self.assertFalse(value['provider_mutations']);self.assertEqual(value['daemon_runtime_digest'],d.DAEMON)

 def test_sparse_descriptor_and_cli_scope_have_no_source_build_or_env_transfer(self):
  out=d.descriptor();self.assertEqual(out['config'],{'version':3,'daemons':{'worker':{}}})
  self.assertEqual(out['daemon']['image'],d.r.b.PREFIX+'daemon@'+d.DAEMON);self.assertEqual(out['daemon']['instances'],{'dub1':1});self.assertEqual(out['daemon']['terminationGracePeriodSeconds'],300)
  command=d.deploy_command('11111111-1111-4111-8111-111111111111')
  self.assertIn('--prebuilt',command);self.assertIn('--prod',command);self.assertIn('--no-wait',command);self.assertIn(d.PROJECT,command);self.assertIn(d.SLUG,command)
  for bad in ['--build-env','--env','--token','--public']:self.assertNotIn(bad,command)

 def test_prepare_and_dispatch_have_separate_claims_with_current_gate_checks(self):
  p=FakePorts();self.assertEqual(d.prepare(p)['result'],'prepared');self.assertEqual(d.dispatch(p)['result'],'submitted')
  self.assertEqual(set(p.claims),{'prepare','deploy'});self.assertEqual(p.calls.count('deploy_call'),1)
  self.assertLess(p.calls.index('claim:prepare'),p.calls.index('synthetic_output'));self.assertLess(p.calls.index('claim:deploy'),p.calls.index('deploy_call'))
  with self.assertRaises(ValueError):d.dispatch(p)
  self.assertEqual(p.calls.count('deploy_call'),1)

 def test_missing_or_changed_paused_gate_blocks_before_dispatch(self):
  p=FakePorts();d.prepare(p);p.gates_value['paused_state']['frame_pin']='new500-too-soon'
  with self.assertRaises(ValueError):d.dispatch(p)
  self.assertNotIn('deploy',p.claims);self.assertNotIn('deploy_call',p.calls)

 def test_unknown_create_keeps_claim_and_cannot_redeploy_or_invent_normal_return(self):
  p=FakePorts();d.prepare(p);p.fail_deploy=True;out=d.dispatch(p)
  self.assertEqual(out['result'],'unconfirmed');self.assertIsNone(p.returned_value);self.assertNotIn('PRIVATE',json.dumps(p.reports))
  with self.assertRaises(ValueError):d.dispatch(p)
  with self.assertRaises(ValueError):d.readback(p)
  self.assertEqual(p.calls.count('deploy_call'),1)

 def test_readback_needs_new_ready_two_complete_old_free_inventories_and_startup(self):
  p=FakePorts();d.prepare(p);d.dispatch(p);out=d.readback(p);self.assertEqual(out['result'],'passed')
  value=p.reports[-1][1];self.assertTrue(value['old_instances_absent']);self.assertEqual(value['current_instance_ids'],[NEW_ID]);self.assertIn('no physical deletion',value['old_instance_absence_scope'])
  self.assertTrue(value['db_native_pin_still_old']);self.assertTrue(value['paused38_full_preservation_verified']);self.assertEqual(p.calls.count('deploy_call'),1)

 def test_new_ready_cannot_hide_old_instance_or_missing_startup_or_db_pin_change(self):
  for failure in ['old_remains','fail_startup','db_pin']:
   p=FakePorts();d.prepare(p);d.dispatch(p)
   if failure=='db_pin':p.gates_value['paused_state']['frame_pin']='changed'
   else:setattr(p,failure,True)
   with self.assertRaises(ValueError):d.readback(p)
   self.assertFalse(any(action=='ready'for action,value in p.reports))

 def test_healthy_observation_requires_known_start_and_fresh_instance_health(self):
  value=packet(NEW_DEPLOYMENT,d.DAEMON,NEW_ID)
  self.assertEqual(d.healthy(value,NEW_DEPLOYMENT,d.DAEMON,INSTANT)['instance_id'],NEW_ID)
  for key,changed in [('started_at_ms',None),('last_checked_at_ms',None),('last_checked_at_ms',INSTANT-60001),('last_checked_at_ms',INSTANT+60001)]:
   bad=copy.deepcopy(value);bad['instances'][0][key]=changed
   with self.assertRaises(ValueError):d.healthy(bad,NEW_DEPLOYMENT,d.DAEMON,INSTANT)

 def test_runtime_projector_and_emitter_are_source_pinned_without_old_mains(self):
  self.assertEqual(d.sha(d.load(d.RUNTIME)),d.RUNTIME_SHA);self.assertEqual(d.sha(d.load(d.EMITTER)),d.EMITTER_SHA)
  for relative,digest in d.CLI_PINS.items():self.assertEqual(d.sha(d.load(d.CLI.parent/relative)),digest)
  source=(HERE/'deploy.py').read_text()
  for item in ['m.projectDaemon(p.value,p.deployment)','m.projectRuntimeLogs(p.text,p.scope)','m.workerDaemonOutput(p.image)']:self.assertIn(item,source)
  for forbidden in ['worker-v2.py','worker-forward31.py','rollback-transport','m.main(']:self.assertNotIn(forbidden,source)

 def test_startup_uses_bound_production_query_and_rejects_unbound_or_truncated_logs(self):
  p=d.Ports();commands=[]
  value={'complete_window':True,'unbound_records':0,'truncated_records':0,'last_startup_at_ms':1793556000001,
   'events':{'worker_started':1,'worker_unconfirmed':0,'worker_paused':0,'pilot_expired':0}}
  p.run=lambda command:commands.append(command)or'synthetic logs'
  p.project_js=lambda kind,payload:copy.deepcopy(value)
  instance=packet(NEW_DEPLOYMENT,d.DAEMON,NEW_ID)['instances'][0]
  self.assertEqual(p.startup(NEW_DEPLOYMENT,instance),value)
  command=commands[0];query=command[command.index('--query')+1]
  self.assertIn('daemonName:"worker"',query);self.assertIn("attributes/'daemonInstanceId'",query);self.assertIn('environment:"production"',query)
  self.assertTrue(command[command.index('--since')+1].endswith('Z'));self.assertTrue(command[command.index('--until')+1].endswith('Z'))
  for key in ['unbound_records','truncated_records']:
   value[key]=1
   with self.assertRaises(ValueError):p.startup(NEW_DEPLOYMENT,instance)
   value[key]=0

 def test_inventory_and_deployment_identity_reject_ambiguous_or_foreign_values(self):
  self.assertEqual(d.inventory_ids({'instances':[{'id':NEW_ID,'daemon':'worker'}]}),[NEW_ID])
  for value in [{'instances':[{'id':NEW_ID,'daemon':'other'}]},{'instances':[{'id':NEW_ID,'daemon':'worker'}]*2},{'instances':[],'unexpected':True}]:
   with self.assertRaises(ValueError):d.inventory_ids(value)
  self.assertEqual(d.deployment_url('https://everyone-presentation-worker-pilot-example.vercel.app\n'),'https://everyone-presentation-worker-pilot-example.vercel.app')
  with self.assertRaises(ValueError):d.deployment_url('https://other-project.vercel.app')

 def test_image_proofs_reject_lost_original_copy_return_and_native_cleanup_failure(self):
  v,docs=public_inputs()
  for key in ['normal_copy_return_observed','two_remote_reads_equal']:
   bad=copy.deepcopy(docs);bad['daemon_transfer'][key]=False
   with self.assertRaises(ValueError):d.image_proofs(v,bad)
  bad=copy.deepcopy(docs);bad['native_admitted']['admitted']['cleanup_confirmed']=False
  with self.assertRaises(ValueError):d.image_proofs(v,bad)

 def test_paused_gate_requires_raw_original_markers_and_same_id_manifest_chain(self):
  v,docs=public_inputs();pins={'synthetic-source':'c'*64};current={'synthetic':'paused38'}
  accepted={'source_sha256':d.SOURCE,'new_native_image_id':d.NATIVE,'new_daemon_image_id':d.DAEMON,'new_manifest_sha256':d.MANIFEST}
  pause_claim={'phase':'pause','source_pins':pins,'before':{'synthetic':'enabled38'}}
  manifest_claim={'paused':current,'admission':accepted,'source_pins':pins,'before':{'synthetic':'old-environment'}}
  pause_path=Path('synthetic-pause')/'pause.claim.json';manifest_path=Path('synthetic-manifest.claim.json');returns={}
  raw={pause_path:json.dumps(pause_claim).encode(),manifest_path:json.dumps(manifest_claim).encode()}
  returns[Path('synthetic-pause')/'pause.returned.json']={'claim_sha256':d.sha(raw[pause_path]),'normal_return_marker_observed':True}
  returns[Path('synthetic-manifest.returned.json')]={'claim_sha256':d.sha(raw[manifest_path]),'normal_return_observed':True}
  def private_read(path):
   if path==pause_path:return copy.deepcopy(pause_claim)
   if path==manifest_path:return copy.deepcopy(manifest_claim)
   return copy.deepcopy(returns[path])
  a=types.SimpleNamespace(PRIVATE=Path('synthetic-pause'),admission=lambda phase:accepted,read_snapshot=lambda:current,prior_phase=Mock(),private_read=private_read,source_pins=lambda:pins,
   s=types.SimpleNamespace(TARGET='synthetic-central',ENVIRONMENT_ID='same-environment-id',phase_before=Mock(),transition=Mock()))
  m=types.SimpleNamespace(CLAIM=manifest_path,RETURNED=Path('synthetic-manifest.returned.json'),observe=lambda:{'environment_id':'same-environment-id','manifest_sha256':d.MANIFEST},preserved=Mock(return_value=True))
  docs['daemon_image_ready']={'result':'ready_image_and_import_gate_observed','source_sha256':d.SOURCE,'daemon_runtime_digest':d.DAEMON,'native_runtime_digest':d.NATIVE,'baked_manifest_sha256':d.MANIFEST}
  docs['pause']={'result':'passed','phase':'pause','target':'synthetic-central','normal_return_marker_observed':True,'independent_readback_verified':True,'first':current,'second':current,'source_pins':pins}
  docs['pause_readback']={'result':'observed_applied','phase':'pause','first':current,'second':current,'normal_return_not_inferred':True,'source_pins':pins}
  docs['manifest_adoption']={'result':'passed','phase':'manifest','project_id':d.PROJECT,'target':'synthetic-central','new_manifest_sha256':d.MANIFEST,
   'same_environment_id_preserved':True,'other_environment_metadata_preserved':True,'normal_return_observed':True,'two_readbacks_equal':True}
  with patch.object(d,'inputs',return_value=(v,docs)),patch.object(d,'adoption',return_value=(a,m)),patch.object(d,'load',side_effect=lambda path:raw[path]if path in raw else json.dumps(returns[path]).encode()):
   self.assertEqual(d.Ports().gates()['paused_state'],current);a.s.phase_before.assert_called_with(current,'pin',d.NATIVE)
   for path,key in [(a.PRIVATE/'pause.returned.json','normal_return_marker_observed'),(m.RETURNED,'normal_return_observed')]:
    returns[path][key]=False
    with self.assertRaises(ValueError):d.Ports().gates()
    returns[path][key]=True
   docs['pause']['normal_return_marker_observed']=False
   with self.assertRaises(ValueError):d.Ports().gates()
   docs['pause']['normal_return_marker_observed']=True;manifest_claim['source_pins']={'different':'d'*64}
   with self.assertRaises(ValueError):d.Ports().gates()

if __name__=='__main__':unittest.main()
