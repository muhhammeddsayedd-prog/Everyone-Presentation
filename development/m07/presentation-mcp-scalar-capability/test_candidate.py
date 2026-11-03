"""Exact source, PL/SQL parsers and negative witnesses only; no database."""
from pathlib import Path
import ast
import difflib
import importlib.util
import re
import subprocess
import unittest
from pglast import parse_plpgsql,parse_sql

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('mcp_scalar_candidate',HERE/'candidate.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)


def assert_scalar_shape(test,body):
    test.assertNotIn('state:=public.eps_validate_own_oauth_session(',body)
    test.assertNotIn('jsonb_agg(',body);test.assertNotIn('jsonb_build_object(',body)
    resource="p_resource text:=scalar_token.claims#>>'{eps_delegation,resource}';"
    test.assertLess(body.index(c.BYPASS),body.index(resource))
    test.assertLess(body.index(resource),body.index('principal uuid:=auth.uid();'))
    test.assertLess(body.index(c.BYPASS),body.index('now_epoch numeric:=extract(epoch from clock_timestamp());'))
    test.assertIn(c.SCALAR_GRANTS,body)
    test.assertLess(body.index('not_after>clock_timestamp()'),body.index(c.SCALAR_GRANTS))
    test.assertLess(body.index('))into permitted;'),body.index('if p_capability is null then return null;'))
    test.assertIn('and(p_capability is null or g.capability=p_capability)',body)
    test.assertEqual(body.count('return false;'),10)


class Tests(unittest.TestCase):
    def test_two_edits_inverse_definition_attributes_and_actual_PL_parse(self):
        row=c.build();a,b=c.parts(row['before']),c.parts(row['after'])
        self.assertEqual(c.inverse(b[2]),a[2]);self.assertEqual(len(c.edits()[0]),2)
        self.assertEqual(row['before'][:a.start(2)],row['after'][:b.start(2)])
        self.assertEqual(row['before'][a.end(2):],row['after'][b.end(2):])
        self.assertEqual(len(parse_plpgsql(row['before'])),1);self.assertEqual(len(parse_plpgsql(row['after'])),1)
        old,new=parse_sql(row['before'])[0].stmt,parse_sql(row['after'])[0].stmt
        for key in ['funcname','parameters','returnType']:self.assertEqual(getattr(old,key),getattr(new,key))
        self.assertEqual([x for x in old.options if x.defname!='as'],[x for x in new.options if x.defname!='as'])
        self.assertEqual(c.sha(b[2].encode()),c.AFTER_BODY_SHA)
        for bad in [a[2]+'\n',a[2].replace('return true;','return false;',1)]:
            with self.assertRaises(ValueError):c.patch_body(bad)

    def test_outer_bypass_and_post_bypass_initializers_preserve_argument_and_clock_order(self):
        row=c.build();old,new=c.parts(row['before'])[2],c.parts(row['after'])[2]
        self.assertIn(c.OUTER_DECLARE,new);self.assertEqual(new.count(c.BYPASS),1)
        self.assertEqual(old[:old.index(c.CALL)],new[:new.index("declare p_resource")].replace('<<scalar_token>>\n','').rstrip('\n')+'\n')
        validator=c.parts(c.definitions()[1])[2];nested,_=c.nested_validator(validator)
        declaration=dict(c.nested_edits())[c.VALIDATOR_DECLARE]
        self.assertIn(declaration,nested)
        self.assertEqual(declaration.replace("p_resource text:=scalar_token.claims#>>'{eps_delegation,resource}';",'').replace('permitted boolean;',''),c.VALIDATOR_DECLARE)
        self.assertEqual(new.count('now_epoch numeric:=extract(epoch from clock_timestamp());'),1)
        self.assertEqual(new.count('not_after>clock_timestamp()'),1)
        self.assertNotIn('statement_timestamp(',new);self.assertNotIn('transaction_timestamp(',new)

    def test_complete_guards_and_resource_session_queries_remain_exact_and_public_DTO_unmodified(self):
        before,validator=c.definitions();body=c.parts(validator)[2];new=c.parts(c.build()['after'])[2]
        guards=body[body.index(c.INACTIVE)+len(c.INACTIVE):body.index(c.GRANTS)]
        self.assertIn(guards.replace('return inactive;','return false;'),new)
        for text in ["claims->'is_anonymous'is distinct from'false'::jsonb",'jsonb_object_keys(delegation)',
                     "jsonb_array_length(delegation->'capabilities')not between 1 and 32",'resource=p_resource and client_id=cid and enabled',
                     'where id=sid and user_id=principal and oauth_client_id=cid',"delegation->>'client_id'is distinct from cid::text"]:
            self.assertIn(text,new)
        self.assertEqual(c.sha(body.encode()),c.VALIDATOR_BODY_SHA)
        self.assertEqual(c.sha(c.parts(c.definitions()[0])[2].encode()),c.BEFORE_BODY_SHA)
        self.assertIn("return jsonb_build_object('active',true",body)
        self.assertNotIn('CREATE OR REPLACE FUNCTION public.eps_validate',c.build()['after'])

    def test_fresh_scalar_grant_query_runs_before_NULL_return_and_rejects_old_DTO_shape(self):
        row=c.build();old,new=c.parts(row['before'])[2],c.parts(row['after'])[2]
        with self.assertRaises(AssertionError):assert_scalar_shape(self,old)
        assert_scalar_shape(self,new)
        sql=c.SCALAR_GRANTS.split('into permitted;',1)[0]+';'
        query=parse_sql(sql)[0].stmt;self.assertEqual(len(query.targetList),1)
        self.assertNotIn('jsonb_agg',sql);self.assertNotIn('order by',sql)
        self.assertIn("where g.principal_id=principal and g.active and delegation->'capabilities'?g.capability",sql)
        early=new.replace(' if p_capability is null then return null;end if;\n','',1).replace(' select exists(', ' if p_capability is null then return null;end if;\n select exists(',1)
        with self.assertRaises(AssertionError):assert_scalar_shape(self,early)
        missingNullRead=new.replace('p_capability is null or ','',1)
        with self.assertRaises(AssertionError):assert_scalar_shape(self,missingNullRead)

    def test_frozen_owner_role_RLS_and_column_grants_need_no_change(self):
        text=c.METADATA.read_bytes().decode('utf8').replace('\r\n','\n')
        for token in [
            'ALTER FUNCTION eps.mcp_token_permits_capability(p_capability text) OWNER TO eps_mcp_session_owner;',
            'ALTER FUNCTION public.eps_validate_own_oauth_session(p_resource text) OWNER TO eps_mcp_session_owner;',
            'CREATE POLICY eps_mcp_own_session ON auth.sessions FOR SELECT TO eps_mcp_session_owner',
            'GRANT SELECT ON TABLE eps.mcp_oauth_resources TO eps_mcp_session_owner;',
            'GRANT SELECT(not_after) ON TABLE auth.sessions TO eps_mcp_session_owner;',
            'GRANT SELECT(scopes) ON TABLE auth.sessions TO eps_mcp_session_owner;']:
            self.assertIn(token,text)
        after=c.build()['after'];self.assertEqual(len(parse_sql(after)),1)
        self.assertNotIn('ALTER ',after);self.assertNotIn('GRANT ',after);self.assertNotIn('set_config(',after)

    def test_source_artifacts_default_OFF_and_no_transport(self):
        self.assertFalse(c.ENTRY_ENABLED);source=(HERE/'candidate.py').read_text(encoding='utf8');tree=ast.parse(source)
        self.assertEqual(ast.unparse(tree.body[-1].body[0]),'need(ENTRY_ENABLED)')
        for name in ['subprocess','psycopg','requests','urllib']:self.assertNotIn(name,source)
        result=subprocess.run(['D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe','-B',str(HERE/'candidate.py')],capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0);self.assertIn('MCP_SCALAR_CAPABILITY_SOURCE_UNCONFIRMED',result.stderr);self.assertEqual(result.stdout,'')
        row=c.build();before,after=c.parts(row['before'])[2],c.parts(row['after'])[2]
        self.assertEqual((HERE/'before-body.sql').read_bytes(),before.encode());self.assertEqual((HERE/'candidate-body.sql').read_bytes(),after.encode())
        diff=''.join(difflib.unified_diff(before.splitlines(keepends=True),after.splitlines(keepends=True),fromfile='MCP-token-permits-5eb6c127',tofile='scalar-8455eeb4'))
        self.assertEqual((HERE/'body.diff').read_bytes(),diff.encode())


if __name__=='__main__':unittest.main()
