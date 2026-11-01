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

class QualifiedRelations(visitors.Visitor):
    def __init__(self):super().__init__();self.aliases={};self.qualifiers=set()
    def visit_RangeVar(self,_a,node):
        if node.alias:self.aliases[node.alias.aliasname]=node.relname
    def visit_ColumnRef(self,_a,node):
        if len(node.fields or())>1 and isinstance(node.fields[0],ast.String):self.qualifiers.add(node.fields[0].sval)

def record_alias_collisions(source):
    """Find SQL-qualified aliases also naming a declared matching row/record.

    This is a source regression for the native42702 failure, not a replacement
    for PostgreSQL's resolver. It handles identifiers/types generically.
    """
    collisions=set()
    for raw in parse_sql(source):
        if not isinstance(raw.stmt,(ast.DoStmt,ast.CreateFunctionStmt)):continue
        functions=parse_plpgsql(RawStream()(raw.stmt))
        for function in functions:
            variables={}
            for datum in function['PLpgSQL_function']['datums']:
                var=datum.get('PLpgSQL_var',{})
                if 'refname'in var and 'datatype'in var:
                    variables[var['refname']]=var['datatype']['PLpgSQL_type']['typname'].split('.')[-1].replace('"','')
            for query in plpgsql_queries([function]):
                relations=QualifiedRelations();relations(parse_sql(query))
                for alias,table in relations.aliases.items():
                    if alias in relations.qualifiers and variables.get(alias)in(table,'record',table+'%ROWTYPE'):
                        collisions.add((alias,table))
    return sorted(collisions)

class CandidateTests(unittest.TestCase):
    def test_declared_record_names_never_collide_with_qualified_sql_relation_aliases(self):
        counterexample="do $$declare row_candidate pg_namespace;begin perform 1 from pg_namespace row_candidate where row_candidate.nspname='public';end$$;"
        self.assertEqual(record_alias_collisions(counterexample),[('row_candidate','pg_namespace')])
        corrected=counterexample.replace('from pg_namespace row_candidate where row_candidate.','from pg_namespace namespace_candidate where namespace_candidate.')
        self.assertEqual(record_alias_collisions(corrected),[])
        self.assertEqual(record_alias_collisions(b.render()),[])

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

    def test_fixture_requires_more_than_one_maximum_page_with_interleaved_exclusions(self):
        fixture=(HERE/'fixture.sql').read_text()
        block=re.search(r'do \$jbf_large_pages\$(.*?)end\$jbf_large_pages\$;',fixture,re.S)
        self.assertIsNotNone(block,'the original three-row case does not prove >100-row pagination')
        source=block.group(1)
        for assertion in ['100 + 100 + 5 accessible rows across maximum pages',
            'all 205 expected IDs exactly once in ascending order; foreign workspace and other batch excluded',
            'maximum-page cursors advance and the third page is terminal']:
            self.assertIn(assertion,source)
        self.assertIn("pg_temp.jbf_actor(pg_temp.jbf_id('b8380001',7))",fixture[:block.start()].split('set local role authenticated;')[-1])
        for series in ['generate_series(1,205)','generate_series(1,7)','generate_series(1,8)']:
            self.assertIn(series,fixture)
        calls=Calls()
        statement=parse_sql('do $jbf_large_pages$'+source+'end$jbf_large_pages$;')[0].stmt
        for query in plpgsql_queries(parse_plpgsql(RawStream()(statement))):calls(parse_sql(query))
        self.assertEqual([arity for name,arity in calls.calls if name=='public.eps_list_jobs_by_batch'],[5,5,5])
        self.assertEqual(source.count('null,100,pg_temp.jbf_id(\'b8380005\',3)'),1)
        self.assertEqual(source.count("::uuid,100,pg_temp.jbf_id('b8380005',3)"),2)
        self.assertIn('actual_ids=expected_ids',source)
        self.assertIn("third#>'{page,next_cursor}'='null'::jsonb",source)

if __name__=='__main__':unittest.main()
