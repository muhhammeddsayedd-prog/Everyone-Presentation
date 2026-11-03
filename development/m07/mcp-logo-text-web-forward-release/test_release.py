"""Pure source/fake-port checks; no stage, private scan, CLI, SQL or provider."""
from pathlib import Path
import ast,copy,importlib.util,json,subprocess,unittest
HERE=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('mcp_logo_text_pure_projection',HERE/'projection.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
exec(compile(p.projected_tests(),__file__,'exec'),globals())

class ProjectionTests(unittest.TestCase):
 def test_all_raw_ancestors_and_finite_new_source(self):
  for name in('release.py','gates.py','preflight.py','stage.py'):ast.parse(p.project(name))
  for name,digest in p.APPROVED_PREDECESSOR.items():self.assertEqual(p.sha((p.PREDECESSOR/name).read_bytes()),digest)
  self.assertIs(p.PINS,p.previous.PINS);self.assertIs(p.FROZEN,p.previous.FROZEN)
  release=p.project('release.py')
  for marker in('_projection.PINS.items()','_projection.FROZEN.items()','_projection.APPROVED_PREDECESSOR.items()'):self.assertIn(marker,release)
  self.assertIn("'--archive=tgz'",release);self.assertNotIn("'--prebuilt'",release)
 def test_exact_source_quality_and_two_product_delta(self):
  self.assertEqual(g.TESTED_COMMIT,p.TESTED);self.assertEqual(g.QUALITY_RECEIPT,p.QUALITY)
  self.assertEqual(g.REASON_FILES,{'apps/web/lib/logo-error-log.ts','apps/web/lib/mcp-error-text.ts'})
  self.assertIn("need(changed&{x['path']for x in source['files']}==REASON_FILES)",p.project('gates.py'))
  self.assertIn("test['tests']>=1023",p.project('gates.py'))
  for source,ref in[({'source_commit':p.previous.TESTED},p.QUALITY),({'source_commit':p.TESTED},{**p.QUALITY,'sha256':'0'*64})]:
   with unittest.mock.patch.object(g,'reference',return_value={}):
    with self.assertRaises(ValueError):g.quality(Path('synthetic'),source,ref)
 def test_current_normal_G14_baseline_and_old_9mi_rejected(self):
  self.assertEqual(g.BASELINE,'dpl_G14dY1CobuaDg37rxPMoqZ6X3Uo9');self.assertEqual(g.BASE_COMMIT,p.previous.TESTED)
  self.assertEqual(g.BASE_MANIFEST,'d4d8739099ccc7da746351dabb8b79ec38d96fe80568ae8768a13c42ddebb620')
  op=object.__new__(r.Operator);op.root=p.MAIN;good=g.reference(p.MAIN,p.BASELINE)['deployment'];r.Operator.baseline(op,good)
  bad=copy.deepcopy(good);bad['id']='dpl_9miSRSQgzwycmN6Ut5sRmeF3x5WF'
  with self.assertRaises(ValueError):r.Operator.baseline(op,bad)
 def test_database_SQL_and_worker_projection_are_unchanged(self):
  before={'__file__':str(HERE/'preflight.py'),'__name__':'inert_before_preflight'};exec(compile(p.previous.project('preflight.py'),'before-preflight','exec'),before)
  after=r.module('mcp_logo_text_pure_preflight',HERE/'preflight.py');self.assertEqual(before['query_sql'](),after.query_sql())
  self.assertEqual(p.WORKER,p.previous.WORKER);self.assertEqual(g.NATIVE,p.previous.NATIVE)
  self.assertIs(p.worker_anchor,p.previous.worker_anchor);self.assertIs(p.worker_projection,p.previous.worker_projection)
  self.assertIn("operator.api('/v13/deployments/'+_projection.WORKER['deployment_id']",p.project('preflight.py'))
  with unittest.mock.patch.object(g,'reference',side_effect=AssertionError('Must refuse before any read')):
   with self.assertRaises(ValueError):g.canonical(Path('synthetic'),'schema41',{},lambda _:None)
 def test_defaultoff_entries_refuse_before_private_ports(self):
  python=str(p.MAIN/'.venv-skills/Scripts/python.exe')
  for name,args in[('release.py',[RUN,'prepare']),('stage.py',[RUN,p.TESTED]),('preflight.py',[RUN,p.TESTED,'b'*64])]:
   result=subprocess.run([python,'-X','utf8','-B',str(HERE/name),*args],capture_output=True,timeout=10);self.assertEqual(result.returncode,1);self.assertNotIn(b'Traceback',result.stderr);self.assertEqual(result.stdout,b'')
  scan=subprocess.run(['C:/Program Files/nodejs/node.exe',str(HERE/'scan-stage.mjs')],capture_output=True,timeout=10);self.assertEqual(scan.returncode,1)
 def test_one_fake_archive_dispatch_and_permanent_claim_no_resubmit(self):
  op,memory,calls=fake();plan={'run_id':RUN,'gates':op.gates(),'before':snapshot()};memory[op.plan]=plan;memory[op.build_file]={'quality_only':True};memory[op.private/'deploy-inputs.json']={'preflight_receipt':{'path':'tracking/evidence/m07/synthetic.json','sha256':'c'*64}}
  with unittest.mock.patch.object(r,'RELEASE_ENABLED',True),unittest.mock.patch.object(g,'preflight'):
   self.assertEqual(op.deploy()['result'],'submitted');self.assertEqual(len(calls),1);self.assertEqual(calls[0][0][0].count('--archive=tgz'),1)
   with self.assertRaises(ValueError):op.deploy()
   self.assertEqual(len(calls),1)
 def test_actual_root_quality_and_baseline_refs_remain_exact(self):
  quality=g.reference(p.MAIN,p.QUALITY);self.assertEqual(quality['result'],'passed');self.assertEqual(quality['source_head_before'],p.TESTED);self.assertEqual(quality['source_head_after'],p.TESTED)
  test=next(c for c in quality['checks']if c['name']=='test');self.assertEqual(test['pass'],1023)
  baseline=g.reference(p.MAIN,p.BASELINE);self.assertEqual(baseline['result'],'passed');self.assertTrue(baseline['normal_process_return_observed']);self.assertTrue(baseline['stable_alias_matches'])

if __name__=='__main__':unittest.main()
