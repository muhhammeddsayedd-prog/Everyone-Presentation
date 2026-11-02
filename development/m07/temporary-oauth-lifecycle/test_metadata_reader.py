"""Offline SQL/disabled-entry assertions. Never invokes normal CLI or storage."""
from pathlib import Path
import importlib.util,json,subprocess,unittest
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('temporary_oauth_metadata_test',HERE/'metadata_reader.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class Tests(unittest.TestCase):
 def test_disabled_query_refuses_before_any_source_auth_or_private_file_read(self):
  self.assertIs(m.READ_ENABLED,False)
  with patch.object(Path,'read_text',side_effect=AssertionError('private read')):
   with self.assertRaisesRegex(ValueError,'TEMP_OAUTH_METADATA_REFUSED'):m.query('not-a-run','not-a-principal')
 def test_actual_python_wire_equals_node_builder_and_parses_read_only(self):
  from pglast import parse_sql
  principal='11111111-1111-4111-8111-111111111111';query=m.sql(principal);program="const m=await import("+json.dumps((HERE/'core.mjs').as_uri())+");process.stdout.write(m.inventorySql("+json.dumps(principal)+"));"
  done=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','-e',program],capture_output=True,timeout=10);self.assertEqual(done.returncode,0);self.assertEqual(query,done.stdout.decode());parse_sql(query)
  self.assertTrue(query.startswith('begin isolation level repeatable read read only;'));self.assertTrue(query.endswith('rollback;'));self.assertNotIn('refresh_tokens',query)
  with self.assertRaises(ValueError):m.sql("x';select 1;--")

if __name__=='__main__':unittest.main()
