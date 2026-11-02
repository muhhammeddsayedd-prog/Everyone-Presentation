"""Pure source/receipts and fake-port checks; no CLI, DB, auth or provider."""
from pathlib import Path
import ast,importlib.util,json,subprocess,unittest
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('forward_web_test_projection',HERE/'projection.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
# The old test main stays inert; its fake transport tests operate on the NEW module.
exec(compile(p.projected_tests(),__file__,'exec'),globals())

class ProjectionTests(unittest.TestCase):
 def test_all_finite_sources_parse_and_old_purpose_bytes_stay_exact(self):
  for name in('release.py','gates.py','stage.py','preflight.py'):ast.parse(p.project(name))
  for name in p.PINS:self.assertEqual(p.sha((p.OLD/name).read_bytes()),p.PINS[name])
  self.assertIn("'--archive=tgz'",p.project('release.py'));self.assertNotIn("'--prebuilt'",p.project('release.py'))
  self.assertIn("'projection.py'",p.project('release.py'));self.assertIn('for name,expected in _projection.PINS.items()',p.project('release.py'))
 def test_exact_tested_commit_quality_and_four_delta_only_are_required(self):
  self.assertEqual(g.TESTED_COMMIT,p.TESTED);self.assertEqual(g.QUALITY_RECEIPT,p.QUALITY);self.assertEqual(g.REASON_FILES,p.DELTA)
  self.assertIn('commit==g.TESTED_COMMIT',p.project('stage.py'))
  for source,ref in[({'source_commit':'f'*40},p.QUALITY),({'source_commit':p.TESTED},{**p.QUALITY,'sha256':'0'*64})]:
   with unittest.mock.patch.object(g,'reference',return_value={}):
    with self.assertRaises(ValueError):g.quality(Path('synthetic'),source,ref)
  self.assertIn("need(changed&{x['path']for x in source['files']}==REASON_FILES)",p.project('gates.py'))
 def test_defaultoff_stage_preflight_scanner_and_release_refuse_without_ports(self):
  python=str(p.MAIN/'.venv-skills/Scripts/python.exe')
  for name,args in [('release.py',[RUN,'prepare']),('stage.py',[RUN,p.TESTED]),('preflight.py',[RUN,p.TESTED,'b'*64])]:
   result=subprocess.run([python,'-X','utf8','-B',str(HERE/name),*args],capture_output=True,timeout=10)
   self.assertEqual(result.returncode,1);self.assertNotIn(b'Traceback',result.stderr);self.assertEqual(result.stdout,b'')
  result=subprocess.run(['C:/Program Files/nodejs/node.exe',str(HERE/'scan-stage.mjs')],capture_output=True,timeout=10);self.assertEqual(result.returncode,1)
 def test_preflight_keeps_exact_original_sql_and_native46_not_future_native3d(self):
  old={'__file__':str(HERE/'preflight.py'),'__name__':'inert'};exec(compile(p.original('preflight.py'),'inert-original-preflight.py','exec'),old)
  self.assertEqual(r.module('new_forward_pure_preflight',HERE/'preflight.py').query_sql(),old['query_sql']())
  self.assertEqual(g.NATIVE,'sha256:46de2f0c0772e10d712fba514788d24041d6741faa8966b6fe9c554fe47e4af4')
  with unittest.mock.patch.object(g,'reference',side_effect=AssertionError('Must refuse before reads')):
   with self.assertRaises(ValueError):g.canonical(Path('synthetic'),'schema41',{},lambda _:None)
 def test_normal_source_submission_uses_archive_exact_metadata_and_one_new_claim(self):
  op,memory,calls=fake();plan={'run_id':RUN,'gates':op.gates(),'before':snapshot()};memory[op.plan]=plan;memory[op.build_file]={'quality_only':True};memory[op.private/'deploy-inputs.json']={'preflight_receipt':{'path':'tracking/evidence/m07/synthetic.json','sha256':'c'*64}}
  with unittest.mock.patch.object(r,'RELEASE_ENABLED',True),unittest.mock.patch.object(g,'preflight'):
   self.assertEqual(op.deploy()['result'],'submitted');self.assertEqual(len(calls),1)
   argv=calls[0][0][0];self.assertEqual(argv.count('--archive=tgz'),1);self.assertNotIn('--prebuilt',argv);self.assertEqual(argv[argv.index('--project')+1],g.PROJECT);self.assertEqual(argv[argv.index('--scope')+1],g.SLUG)
   self.assertEqual(memory[op.returned]['meta'],op.metadata(plan));self.assertEqual(memory[op.returned]['claim_sha256'],op.file_sha(op.private/'deploy.claim.json'))
   with self.assertRaises(ValueError):op.deploy()
   self.assertEqual(len(calls),1)

if __name__=='__main__':unittest.main()
