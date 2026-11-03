"""Offline source, SQL-parser and default-off entry checks; no SQL/Docker."""
from pathlib import Path
import importlib.util,json,subprocess,tempfile,unittest
from pglast import parse_sql,parse_plpgsql

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('logo_owned_compiler',HERE/'compiler.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
RUN='8a100000-0000-4000-8000-000000000002'
REL='.local/logo-info-owned-compiled/controller-'+RUN+'.mjs'

class CompilerTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.cfg=c.configuration();cls.source,cls.proof=c.compile_source(REL)

 def test_sealed_candidate_only_owned_database_guard_changes(self):
  candidate=c.module('logo_candidate_compare',c.CANDIDATE/'candidate.py');original=candidate.proof(c.TEMPLATE_RUN)
  self.assertEqual(self.cfg['proof_sql'].replace("current_database()<>'project39'","current_database()<>'postgres'"),original)
  self.assertTrue(self.proof['all_edits_inverse_byte_equal']);self.assertEqual(len(self.cfg['history40']),40)
  self.assertEqual(self.cfg['history40'][-1],'20261102085405');self.assertGreater(self.proof['case_count'],30)

 def test_actual_rendered_SQL_and_function_definitions_parse(self):
  statements=parse_sql(self.cfg['proof_sql']);self.assertGreater(len(statements),70)
  self.assertTrue(self.cfg['proof_sql'].rstrip().endswith('rollback;'))
  definitions=[s for s in statements if type(s.stmt).__name__=='CreateFunctionStmt']
  self.assertEqual(len(definitions),7)
  for statement in definitions:
   # pglast's PL/pgSQL parser validates complete rendered SQL function declarations.
   from pglast.stream import RawStream
   text=RawStream()(statement)
   if 'LANGUAGE plpgsql' in text:self.assertEqual(len(parse_plpgsql(text)),1)

 def test_claim_precedes_original_target_and_cleanup_unchanged(self):
  source=self.source
  self.assertLess(source.index('await logoInfo.claim('),source.index('port = await import('))
  self.assertLess(source.index('await logoInfo.claim('),source.index("docker(['image', 'inspect'"))
  self.assertNotIn("const sameKey = 'project39-race-same-'",source)
  self.assertIn('assert.deepEqual(actualHistory.history,cfg.history40)',source)
  self.assertIn('await sql(snapshot)',source)
  for marker in ['report.restored38_all_table_hashes_exact = true','report.restored38_catalogue_exact = true','report.all_preexisting_rows_preserved = true','assert.deepEqual(await original(), before)','await logoInfo.inventories(docker,runId)','await unlink(lockPath)']:
   self.assertIn(marker,source)
  self.assertNotIn("(to_jsonb(t)-'reason')",source)

 def test_wrong_uuid_path_or_source_pin_refused(self):
  for path in ['.local/other/controller-'+RUN+'.mjs',REL.replace('4000','5000'),REL+'x']:
   with self.assertRaises(ValueError):c.compile_source(path)
  old=c.CANDIDATE_PINS['proof.sql']
  try:
   c.CANDIDATE_PINS['proof.sql']='0'*64
   with self.assertRaises(ValueError):c.configuration()
  finally:c.CANDIDATE_PINS['proof.sql']=old

 def test_actual_compiled_entry_default_off_before_any_ports(self):
  # A temporary source artifact is syntax-checked/imported, but never registered
  # in the real compiled namespace and cannot reach target/SQL/Docker while off.
  with tempfile.TemporaryDirectory()as directory:
   file=Path(directory)/'controller.mjs';file.write_text(self.source,encoding='utf8',newline='\n')
   syntax=subprocess.run(['node','--check',str(file)],capture_output=True,text=True,timeout=15)
   self.assertEqual(syntax.returncode,0,syntax.stderr)
   script="const m=await import("+json.dumps(file.as_uri())+");try{await m.runRace('D:/unreachable');process.exitCode=2}catch(e){if(e.message!=='LOGO_INFO_OWNED_PROOF_DISABLED')process.exitCode=3}"
   result=subprocess.run(['node','--input-type=module','-e',script],capture_output=True,text=True,timeout=15)
   self.assertEqual(result.returncode,0,result.stderr)

if __name__=='__main__':unittest.main()
