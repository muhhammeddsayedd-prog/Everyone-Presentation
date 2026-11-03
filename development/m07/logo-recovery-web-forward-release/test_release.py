"""Pure finite-source and fake-port tests; no real CLI/private/DB/provider calls."""
from pathlib import Path
import ast,copy,importlib.util,json,subprocess,unittest
HERE=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('logo_recovery_pure_projection',HERE/'projection.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
exec(compile(p.projected_tests(),__file__,'exec'),globals())

class ProjectionTests(unittest.TestCase):
 def test_exact_source_namespace_and_all_raw_predecessor_pins(self):
  for name in('release.py','gates.py','stage.py','preflight.py'):ast.parse(p.project(name))
  for name,digest in p.FROZEN.items():self.assertEqual(p.sha((p.PREDECESSOR/name).read_bytes()),digest)
  self.assertIn("for name,expected in _projection.FROZEN.items()",p.project('release.py'))
  self.assertIn("'--archive=tgz'",p.project('release.py'));self.assertNotIn("'--prebuilt'",p.project('release.py'))
  self.assertIn("'projection.py'",p.project('release.py'))
 def test_exact_1019_tested_commit_and_three_selected_logo_changes(self):
  self.assertEqual(g.TESTED_COMMIT,p.TESTED);self.assertEqual(g.QUALITY_RECEIPT,p.QUALITY);self.assertEqual(g.REASON_FILES,p.DELTA)
  self.assertEqual(len(p.DELTA),3);self.assertFalse(any(x.startswith('apps/worker/')for x in p.DELTA))
  for source,ref in[({'source_commit':'f'*40},p.QUALITY),({'source_commit':p.TESTED},{**p.QUALITY,'sha256':'0'*64})]:
   with unittest.mock.patch.object(g,'reference',return_value={}):
    with self.assertRaises(ValueError):g.quality(Path('synthetic'),source,ref)
  self.assertIn("need(changed&{x['path']for x in source['files']}==REASON_FILES)",p.project('gates.py'))
 def test_preflight_keeps_SQL_bytes_and_adds_fixed_Fxd_GETs_not_database_daemon_claims(self):
  old={'__file__':str(HERE/'preflight.py'),'__name__':'inert'};exec(compile(p.previous.project('preflight.py'),'inert-old-preflight','exec'),old)
  new=r.module('logo_recovery_pure_preflight',HERE/'preflight.py');self.assertEqual(old['query_sql'](),new.query_sql());self.assertEqual(g.NATIVE,p.NATIVE)
  text=p.project('preflight.py');self.assertIn("operator.api('/v13/deployments/'+_projection.WORKER['deployment_id']",text)
  self.assertLess(text.index('_projection.worker_anchor()'),text.index('observations=[]'));self.assertLess(text.index('_projection.worker_projection(operator.api('),text.index('observations.append(value)'))
  with unittest.mock.patch.object(g,'reference',side_effect=AssertionError('No pending reads')):
   with self.assertRaises(ValueError):g.canonical(Path('synthetic'),'schema41',{},lambda _:None)
 def test_actual_dated_worker_anchor_and_closed_live_worker_projection(self):
  self.assertTrue(p.worker_anchor()['historical_startup_only'])
  mapping={'epsWorkerIdentityDaemonSource':'daemon_source_sha256','epsWorkerIdentityNativeSource':'native_source_sha256','epsWorkerIdentityNativeGraph':'native_graph_sha256','epsWorkerIdentityDaemonGraph':'daemon_graph_sha256','epsWorkerIdentityManifest':'native_manifest_sha256','epsWorkerIdentityCompatibility':'native_compatibility_sha256','epsWorkerIdentityNative':'native_digest','epsWorkerIdentityDaemon':'daemon_digest'}
  raw={'id':p.WORKER['deployment_id'],'project':{'id':p.WORKER['project_id']},'team':{'id':p.WORKER['team_id']},'name':'everyone-presentation-worker-pilot','target':'production','readyState':'READY','meta':{**{key:p.WORKER[field]for key,field in mapping.items()},'epsWorkerIdentityRun':RUN},'private_environment':'SYNTHETIC_PRIVATE'}
  self.assertEqual(p.worker_projection(raw),p.WORKER);self.assertNotIn('SYNTHETIC_PRIVATE',json.dumps(p.worker_projection(raw)))
  for mutate in[lambda x:x.update(id='dpl_6oA1iaHte26KG1DEkBEJ9KU3ahS7'),lambda x:x.update(readyState='BUILDING'),lambda x:x['meta'].update(epsWorkerIdentityNative='sha256:'+'4'*64),lambda x:x['meta'].update(epsWorkerIdentityDaemonSource='f'*64),lambda x:x['project'].update(id='prj_other')]:
   bad=copy.deepcopy(raw);mutate(bad)
   with self.assertRaises(ValueError):p.worker_projection(bad)
 def test_defaultoff_stage_preflight_release_scanner_before_private_ports(self):
  python=str(p.MAIN/'.venv-skills/Scripts/python.exe')
  for name,args in[('release.py',[RUN,'prepare']),('stage.py',[RUN,p.TESTED]),('preflight.py',[RUN,p.TESTED,'b'*64])]:
   result=subprocess.run([python,'-X','utf8','-B',str(HERE/name),*args],capture_output=True,timeout=10);self.assertEqual(result.returncode,1);self.assertNotIn(b'Traceback',result.stderr);self.assertEqual(result.stdout,b'')
  result=subprocess.run(['C:/Program Files/nodejs/node.exe',str(HERE/'scan-stage.mjs')],capture_output=True,timeout=10);self.assertEqual(result.returncode,1)
 def test_one_fake_source_archive_submission_and_no_second_dispatch(self):
  op,memory,calls=fake();plan={'run_id':RUN,'gates':op.gates(),'before':snapshot()};memory[op.plan]=plan;memory[op.build_file]={'quality_only':True};memory[op.private/'deploy-inputs.json']={'preflight_receipt':{'path':'tracking/evidence/m07/synthetic.json','sha256':'c'*64}}
  with unittest.mock.patch.object(r,'RELEASE_ENABLED',True),unittest.mock.patch.object(g,'preflight'):
   self.assertEqual(op.deploy()['result'],'submitted');self.assertEqual(len(calls),1);argv=calls[0][0][0];self.assertEqual(argv.count('--archive=tgz'),1);self.assertNotIn('--prebuilt',argv);self.assertEqual(memory[op.returned]['meta'],op.metadata(plan))
   with self.assertRaises(ValueError):op.deploy()
   self.assertEqual(len(calls),1)
if __name__=='__main__':unittest.main()
