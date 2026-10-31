"""Synthetic rendering QA only; no DB, CLI or credential access."""
from pathlib import Path
import importlib.util
import unittest
spec=importlib.util.spec_from_file_location('canonical_sql',Path(__file__).with_name('canonical_sql.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class RenderTests(unittest.TestCase):
    def test_only_ack_migration_and_one_history_write_are_inside_one_transaction(self):
        here=Path(__file__).parent
        sql=m.render((here/'canonical-query.sql').read_text(),(here/'candidate.sql').read_text(),
          {'catalog':{'synthetic':"';COMMIT;PRIVATE"},'protected_data':{'counts':{'eps.jobs':0,'public.projects':1}}},'11111111-2222-4333-8444-555555555555')
        self.assertEqual(sql.lower().count('create or replace function eps.specs_submit_ack('),1)
        self.assertEqual(sql.lower().count('insert into supabase_migrations.schema_migrations('),1)
        self.assertNotIn("';COMMIT;PRIVATE",sql)
        self.assertIn('begin isolation level repeatable read;',sql)
        self.assertEqual(sql.lower().count('\ncommit;'),1)
        self.assertTrue(sql.rstrip().endswith('as specs_ack31_commit;'))

    def test_untrusted_table_names_and_marker_never_become_sql(self):
        here=Path(__file__).parent
        for table in ('auth.users','eps.jobs;COMMIT','eps../jobs'):
            with self.assertRaises(ValueError):m.render((here/'canonical-query.sql').read_text(),(here/'candidate.sql').read_text(),
              {'protected_data':{'counts':{table:1}}},'11111111-2222-4333-8444-555555555555')
        with self.assertRaises(ValueError):m.render('query','migration',{},"';COMMIT;--")

if __name__=='__main__':unittest.main()
