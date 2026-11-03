"""Offline real parsers/finite composition/default refusal; no SQL/Docker."""
from pathlib import Path
import importlib.util
import json
import re
import subprocess
import unittest
from pglast import parse_sql,parse_plpgsql

HERE=Path(__file__).resolve().parent


def load(name,file):
    spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value


c=load('scalar_owned_compiler_test',HERE/'compiler.py')
p=load('scalar_owned_proof_test',HERE/'proof.py')
e=load('scalar_owned_entry_test',HERE/'projection.py')


class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.relative='.local/mcp-scalar-owned-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        cls.source,cls.projection=c.compile_source(cls.relative)
        start=cls.source.index('const cfg=')+len('const cfg=');cls.cfg=json.JSONDecoder().raw_decode(cls.source[start:])[0]
        cls.sql=cls.cfg['proof_sql'].replace('__OWNED_SYSTEM__','12345').replace('__ORIGINAL_SYSTEM__','67890')

    def test_actual_rendered_SQL_and_PL_blocks_guard_owned_roles_schema_collation_and_restore(self):
        self.assertGreater(len(parse_sql(self.sql)),120);self.assertGreater(len(parse_plpgsql(self.sql)),5)
        for token in ["current_database()<>'project39'","current_user<>'supabase_admin'","session_user<>'supabase_admin'",'pg_control_system()',
                      'pg_attribute','sessions\'::regclass','confrelid=\'auth.users\'::regclass','collisdeterministic',
                      'execute original','to_jsonb(p)=(select metadata from scalar_target_before)',
                      "replace(prosrc,E'\\r\\n',E'\\n')",'one_target_prosrc_only','public_validator_unchanged']:
            self.assertIn(token,self.sql)
        self.assertTrue(self.sql.rstrip().endswith('rollback;'));self.assertNotIn("select set_config('eps.scalar.base_claims'",self.sql)
        self.assertEqual(self.sql.count('CREATE OR REPLACE FUNCTION eps.mcp_token_permits_capability'),1)
        self.assertNotIn('CREATE OR REPLACE FUNCTION public.eps_validate_own_oauth_session',self.sql)

    def test_all_guard_classes_native_and_NULL_pairs_exact_122_and_actual_clock_passage(self):
        ids=self.cfg['expected_cases'];self.assertEqual(len(ids),122);self.assertEqual(len({(x['variant'],x['case'])for x in ids}),122)
        old=[x['case']for x in ids if x['variant']=='old'];new=[x['case']for x in ids if x['variant']=='candidate'];self.assertEqual(old,new)
        for label in ['valid-NULL','browser-NULL','expiry-inactive-NULL','capabilities-bad-item','capabilities-unknown-item','missing-anonymous',
                      'resource-disabled','session-expired','session-wrong-client','session-no-openid','grant-inactive','grant-deleted','session-deleted',
                      'requested-uppercase','requested-leading-space','requested-trailing-space','requested-Unicode-lookalike',
                      'native-invalid-principal','native-invalid-claims','anon-execute-denied','clock-before','clock-after']:
            self.assertIn(label,old)
        self.assertEqual(self.sql.count("perform pg_sleep(greatest(0,remaining)+0.025)"),2)
        self.assertEqual(self.sql.count("remaining<=2.1"),2);self.assertEqual(self.sql.count("clock_timestamp())>deadline"),2)
        self.assertIn("set local statement_timeout='8s';set local lock_timeout='2s';",self.sql)
        self.assertNotIn('eps_generate_version(',self.sql)

    def test_controller_inverse_pins_once_target_and_existing_cleanup_unchanged(self):
        self.assertTrue(self.projection['finite_controller_inverse_byte_equal_after_declared_cfg_replacement'])
        self.assertEqual(self.projection['case_count'],122)
        self.assertIn("'.local/mcp-scalar-owned-proof'",self.source);self.assertIn("'eps.scalarmcp.run'",self.source)
        self.assertIn("'tracking/evidence/m07/presentation-mcp-scalar-owned-proof'",self.source)
        self.assertLess(self.source.index('await logoInfo.claim('),self.source.index('before = await original()'))
        self.assertIn('report.original_data_catalogue_and_global_roles_unchanged = true',self.source)
        self.assertIn('report.shared_lock_released = true',self.source);self.assertIn('report.cleanup_inventories=await logoInfo.inventories',self.source)
        for file in ['candidate.py','proof.py','proof.sql','entry.mjs','projection.py','compiler.py']:
            self.assertTrue(any(Path(path).name==file for path in self.cfg['source_pins']))
        result=subprocess.run(['node','--check','--input-type=module'],input=self.source,capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)

    def test_exact_entry_projection_F_T_only_and_pre_port_OFF_refusal(self):
        closed=e.project_entry();self.assertEqual((HERE/'entry.mjs').read_bytes().decode(),closed)
        e.admit_entry(closed);e.admit_entry(closed.replace('export const EXECUTION_ENABLED = false;','export const EXECUTION_ENABLED = true;',1))
        for bad in [closed+'\n',closed.replace('\n','\r\n')]:
            with self.assertRaises(ValueError):e.admit_entry(bad)
        result=subprocess.run(['node','--input-type=module','-e','import{admit}from '+json.dumps((HERE/'entry.mjs').as_uri())+';await admit({},null,null);'],capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0);self.assertIn('MCP_SCALAR_OWNED_PROOF_DISABLED',result.stderr);self.assertEqual(result.stdout,'')


if __name__=='__main__':unittest.main()
