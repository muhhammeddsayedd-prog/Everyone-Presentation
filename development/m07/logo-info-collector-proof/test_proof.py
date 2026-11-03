"""Offline compile/parser/default-off and finite fixture execution via fake sql."""
from pathlib import Path
import importlib.util,json,re,subprocess,tempfile,unittest
from pglast import parse_sql
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('collector41_test_compiler',HERE/'compiler.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
RUN='8a100000-0000-4000-8000-000000000001'

class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.source,cls.bridge,cls.proof=m.compile_source('.local/logo-info-collector-compiled/controller-'+RUN+'.mjs')
  begin=cls.source.index('const cfg=')+len('const cfg=');cls.cfg,_=json.JSONDecoder().raw_decode(cls.source[begin:])
 def test_inverse_new_namespaces_no_old_callback_or_matrix(self):
  self.assertTrue(self.proof['controller_inverse_byte_equal']);self.assertTrue(self.proof['bridge_inverse_byte_equal'])
  self.assertIn('.local/logo-info-collector-once',(HERE/'entry.mjs').read_text());self.assertIn('eps.logocollector.run',self.source)
  self.assertNotIn('expected_cases',self.cfg);self.assertNotIn('proof_sql',self.cfg)
  self.assertNotIn('await concurrency.runCases(',self.source);self.assertNotIn('create_presentation_series',self.source)
  self.assertIn('assert.deepEqual(await original(), before)',self.source)
  self.assertLess(self.source.index('await logoInfo.claim('),self.source.index('port = await import('))
 def test_actual_collector_and_checkpoint_SQL_with_only_count_qualification_parse(self):
  for name in('snapshot_sql','checkpoint_sql'):
   text=self.cfg[name];self.assertEqual(len(parse_sql(text)),1);self.assertIn('to_jsonb(2::bigint)',text);self.assertNotIn('to_jsonb(3::bigint)',text);self.assertNotIn("(to_jsonb(t)-'reason')",text)
  self.assertIn('const LOCAL=',self.bridge);self.assertIn('DEADLINE=30000',self.bridge);self.assertIn('LIMIT=32*1024**2',self.bridge)
 def test_actual_generated_scripts_syntax_and_default_off_before_ports(self):
  with tempfile.TemporaryDirectory()as directory:
   root=Path(directory)
   for name,text in [('controller.mjs',self.source),('bridge.mjs',self.bridge)]:
    file=root/name;file.write_text(text,encoding='utf8',newline='\n');result=subprocess.run(['node','--check',str(file)],capture_output=True,text=True,timeout=15);self.assertEqual(result.returncode,0,'syntax check failed')
   script='const m=await import('+json.dumps((root/'controller.mjs').as_uri())+");try{await m.runRace('D:/unreachable');process.exitCode=2}catch(e){if(e.message!=='LOGO_INFO_COLLECTOR_DISABLED')process.exitCode=3}"
   result=subprocess.run(['node','--input-type=module','-e',script],capture_output=True,text=True,timeout=15);self.assertEqual(result.returncode,0,result.stderr)
 def test_actual_setup_expressions_execute_only_fake_sql_and_parse(self):
  start=self.source.index('    await sql("set session authorization postgres;begin;set local row_security=on;"+functional+')
  end=self.source.index('\n    const after39 =',start);block=self.source[start:end]
  snapshot=re.search(r'const snapshot = `(.*?)`;',self.source,re.S)[1]
  with tempfile.TemporaryDirectory()as directory:
   file=Path(directory)/'setup.mjs'
   code="import assert from 'node:assert/strict';const collected=[];const sql=async value=>{collected.push(value)};const functional='';const identity={system_identifier:'123456789'};const runId="+json.dumps(RUN)+";const quote=value=>\"'\"+value.replaceAll(\"'\",\"''\")+\"'\";const snapshot="+json.dumps(snapshot)+";const report={};\n"+block+"\nprocess.stdout.write(JSON.stringify(collected));"
   file.write_text(code,encoding='utf8',newline='\n');result=subprocess.run(['node',str(file)],capture_output=True,text=True,timeout=15);self.assertEqual(result.returncode,0,result.stderr)
   calls=json.loads(result.stdout);self.assertEqual(len(calls),8)
   for text in calls:parse_sql(text)
   self.assertIn('supabase_admin',calls[2]);self.assertLess(calls[2].index('LOGO41_OWNED_ADMIN_REQUIRED'),calls[2].index('create table project39_proof.qualified_rows'))
   self.assertIn('E\'Owned collector Ω\nالعربية\'',calls[6]);self.assertIn('case n when 0 then',calls[6]);self.assertEqual(calls[-1],snapshot)
 def test_foreign_compile_namespace_refused(self):
  with self.assertRaises(ValueError):m.compile_source('.local/old/controller-'+RUN+'.mjs')

if __name__=='__main__':unittest.main()
