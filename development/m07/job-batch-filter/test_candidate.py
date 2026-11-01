"""Inert source/AST proof only. No native SQL, role, process or provider action."""
import hashlib
import re
from pathlib import Path
import unittest
from pglast import ast,parse_sql,parse_plpgsql,visitors
from pglast.stream import RawStream
import build_candidate as b

HERE=Path(__file__).resolve().parent

class Calls(visitors.Visitor):
    def __init__(self):super().__init__();self.calls=[];self.controlled=[]
    def visit_FuncCall(self,_a,node):
        name='.'.join(v.sval for v in node.funcname)
        self.calls.append((name,len(node.args or ())))
        if name=='pg_temp.jbf_error'and node.args and isinstance(node.args[0],ast.A_Const):self.controlled.append(node.args[0].val.sval)

def plpgsql_queries(value):
    if isinstance(value,list):
        for child in value:yield from plpgsql_queries(child)
    elif isinstance(value,dict):
        if 'PLpgSQL_expr'in value:
            query=value['PLpgSQL_expr']['query'];query=re.sub(r'^[a-z_][a-z_0-9]*\s*:=','',query,flags=re.I)
            yield query if re.match(r'^\s*select\b',query,re.I)else'SELECT '+query
        else:
            for child in value.values():yield from plpgsql_queries(child)

class CandidateTests(unittest.TestCase):
    def test_current37_body_includes_applied_m03_frame_and_cast_authority(self):
        old,new=b.bodies()
        self.assertEqual(hashlib.sha256(old.encode()).hexdigest(),'a2239225b995673e9ab432ac63014f742b25032cc586c790535db260c551d241')
        for sql in [old,new]:
            self.assertIn("or eps.has_capability('cast.read')",sql)
            self.assertIn("kind='frame_extract' and eps.frame_user_can_read(jobs)",sql)
            self.assertIn("kind<>'frame_extract' and eps.jobs_can_access(workspace_id,'read')",sql)

    def test_only_batch_predicate_and_required_null_guard_extend_the_known_body(self):
        old,new=b.bodies();self.assertEqual(hashlib.sha256(old.encode()).hexdigest(),b.OLD_BODY_SHA)
        self.assertEqual(new,old.replace('if p_limit is null or p_limit not between 1 and 100','if p_batch_id is null or p_limit is null or p_limit not between 1 and 100')
            .replace('where (p_workspace_id is null or workspace_id=p_workspace_id)','where batch_id=p_batch_id and (p_workspace_id is null or workspace_id=p_workspace_id)'))
        for invariant in ['eps.jobs_can_access(workspace_id,\'read\')','eps.frame_user_can_read(jobs)','p_cursor is null or id>p_cursor','order by id limit p_limit+1','items[p_limit]->>\'id\'','eps.has_capability(\'workspaces.read\') or eps.has_capability(\'operations.read\')']:
            self.assertIn(invariant,new)

    def test_distinct_rpc_has_five_required_parameters_and_does_not_replace_old_port(self):
        nodes=parse_sql(b.render());funcs=[n.stmt for n in nodes if isinstance(n.stmt,ast.CreateFunctionStmt)]
        self.assertEqual(len(funcs),1);f=funcs[0]
        self.assertEqual('.'.join(v.sval for v in f.funcname),'public.eps_list_jobs_by_batch')
        self.assertEqual(len(f.parameters),5);self.assertTrue(all(p.defexpr is None for p in f.parameters));self.assertFalse(f.replace)
        self.assertNotIn('create function public.eps_list_jobs(',b.render())
        self.assertNotIn('alter function public.eps_list_jobs(',b.render())
        self.assertNotIn('drop function',b.render().lower())

    def test_complete_sql_draft_and_every_fixture_block_parse_without_running(self):
        self.assertEqual((HERE/'candidate.sql.txt').read_bytes(),b.render().encode())
        for path in ['candidate.sql.txt','fixture.sql']:
            source=(HERE/path).read_text();nodes=parse_sql(source)
            for node in nodes:
                if isinstance(node.stmt,(ast.CreateFunctionStmt,ast.DoStmt)):parse_plpgsql(RawStream()(node.stmt))
        sql=b.render();self.assertIsInstance(parse_sql(sql)[0].stmt,ast.TransactionStmt)
        self.assertTrue(sql.endswith('commit;\n'));self.assertIn("'owned-local-rollback-v1'",sql)
        self.assertIn("is distinct from array[",sql);self.assertIn("'20261101042702'",sql)

    def test_grants_are_new_function_only_and_schema_create_drift_is_refused(self):
        sql=b.render();self.assertLess(sql.index("has_schema_privilege('eps_jobs_owner','public','CREATE')"),sql.index('grant create on schema'))
        self.assertIn('revoke create on schema public from eps_jobs_owner;',sql)
        self.assertIn('grant execute on function '+b.NEW_SIGNATURE+'to authenticated;',sql)
        self.assertIn("coalesce(q.proacl,acldefault('f',q.proowner))",sql)
        self.assertIn("a.grantee not in('eps_jobs_owner'::regrole,'authenticated'::regrole)",sql)
        self.assertIn("to_jsonb(p)is distinct from current_setting('eps.job_batch_filter.old_port')::jsonb",sql)
        self.assertNotRegex(sql.lower(),r'grant\s+(select|insert|update|delete)|create\s+(table|role|policy)|alter\s+(table|role|policy)')

    def test_fixture_function_resolution_uses_real_arity_including_controlled_error_calls(self):
        nodes=parse_sql((HERE/'fixture.sql').read_text());calls=Calls();calls(nodes)
        for raw in nodes:
            if isinstance(raw.stmt,(ast.CreateFunctionStmt,ast.DoStmt)):
                for query in plpgsql_queries(parse_plpgsql(RawStream()(raw.stmt))):calls(parse_sql(query))
        for sql in calls.controlled:
            nested=Calls();nested(parse_sql(sql));calls.calls.extend(nested.calls)
        new=[n for name,n in calls.calls if name=='public.eps_list_jobs_by_batch'];self.assertGreaterEqual(len(new),12)
        self.assertEqual(set(new),{5})
        old=[n for name,n in calls.calls if name=='public.eps_list_jobs'];self.assertEqual(old,[4])
        get=[n for name,n in calls.calls if name=='public.eps_get_job'];self.assertGreaterEqual(len(get),5);self.assertEqual(set(get),{1})

    def test_fixture_covers_native_scope_pagination_and_no_execution_or_restore_credit(self):
        fixture=(HERE/'fixture.sql').read_text()
        for label in ['stable filtered pages have no skip or duplicate','operations.read is still limited to current project membership',
            'known foreign workspace and batch grant no access','revoked current membership immediately filters batch rows',
            'old four-argument RPC retains unfiltered behavior','status and batch intersect','CAPABILITY_REQUIRED','42501']:
            self.assertIn(label,fixture)
        for label in ['cast.read-only requester sees own frame without origin membership','origin project operator with cast.read still cannot list another requester frame','jbf_cast_revocation','second cast requester sees only their own frame']:
            self.assertIn(label,fixture)
        self.assertIn('if value is distinct from true',fixture)
        self.assertNotIn('commit;',fixture.lower());self.assertNotIn('claim_job_stage',fixture)
        self.assertFalse(list((b.ROOT/'supabase/migrations').glob('*job_batch_filter*')))

if __name__=='__main__':unittest.main()
