"""Pure SQL rendering/parsing only; no database, CLI or provider."""
from pathlib import Path
import importlib.util, unittest
from pglast import parse_sql

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('diagnostic',HERE/'catalogue_diagnostic.py')
d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)

class CatalogueDiagnostics(unittest.TestCase):
 def test_union_is_byte_exact_to_failed_release(self):
  self.assertEqual(d.release().catalogue_sql(),"(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(k||':'||"+d.release().digest_sql('v')+",E'\\n'order by k collate \"C\"),''),'UTF8')),'hex'))from("+d.union_sql()+')catalogue)')
 def test_all_levels_parse_and_preserve_all_fields(self):
  for sql in [d.groups_sql(),d.keys_sql('pg_class'),d.keys_sql('pg_attribute','pg_attribute:123:-1',25),d.fields_sql('pg_class','pg_class:123')]:
   parse_sql(sql);self.assertIn('read only;',sql);self.assertTrue(sql.endswith('rollback;'))
   self.assertIn(d.union_sql(),sql);self.assertIn('metadata_hashes_only',sql)
   self.assertNotIn('jsonb_build_object(\'value\'',sql);self.assertNotIn('commit;',sql)
 def test_key_group_and_limit_are_closed(self):
  for group in ['auth.users',"x');delete from eps.jobs;--",'',None]:
   with self.assertRaises(ValueError):d.keys_sql(group)
  for key in ["pg_class:1';drop",'procedure:1','pg_class:',{},None]:
   with self.assertRaises(ValueError):d.fields_sql('pg_class',key)
  for limit in [0,1001,True,'10']:
   with self.assertRaises(ValueError):d.keys_sql('pg_class',limit=limit)
 def test_key_pages_are_bounded_and_continuation_is_explicit(self):
  sql=d.keys_sql('pg_attribute','pg_attribute:123:4',100)
  self.assertIn('limit 101',sql);self.assertIn('limit 100',sql);self.assertIn("'next_key'",sql)
 def test_fields_return_only_name_and_digest(self):
  sql=d.fields_sql('pg_class','pg_class:123')
  self.assertIn("jsonb_build_object('field',field,'sha256',h)",sql)
  self.assertIn("'matched',(select count(*)from chosen)",sql)

if __name__=='__main__':unittest.main()
