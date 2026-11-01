"""Compile a new owned-local guard proof from the immutable sequential runner.

No execution on import. The new controller has a fresh purpose, claim and receipt;
the already executed source, fixtures and historical claims remain unchanged.
"""
from pathlib import Path
import importlib.util,json,sys,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
spec=importlib.util.spec_from_file_location('project39_guard_validation_state',HERE/'state.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)

def compile_controller(primary,relative):
 c=s.Context(primary,HERE);old=ROOT/'development/m07/project-creation39-proof/run.mjs';raw=s.load(old)
 s.need(s.sha(raw)=='be0987779cac7758419cd73122a61a32824f53515bcf3d93afdaa3e8c024afcf');source=raw.decode('utf8')
 before=c.state_sql();after=c.state_sql(True)
 capture="grant usage on schema public to public;create temporary table project39_guard_input(value jsonb);insert into project39_guard_input "+before+';'
 capture+="do $canonical_acl_before$begin if(select value#>'{project39,delta,schemas|public|acl}'from project39_guard_input)is distinct from "+c.b.old.json_sql(c.project(False)[s.PUBLIC_ACL_KEY])+" then raise exception 'PROJECT39_CANONICAL_ACL_BEFORE_MISMATCH';end if;end$canonical_acl_before$;"
 updates=[]
 for bootstrap in(True,False):
  meta={'delta':c.project(True,bootstrap),'creator_direct_grants':c.inventory,'creator_owners':[{'kind':'function','identity':'public.eps_create_project(jsonb,text)'}],'new_function_metadata':c.expected_functions(True),'intent_rows':0}
  updates.append("jsonb_set(jsonb_set(jsonb_set(prior,'{base,history}',(prior#>'{base,history}')||'[\""+s.VERSION+"\"]'::jsonb),'{base,eps_tables}',(select jsonb_agg(item order by item)from jsonb_array_elements_text((prior#>'{base,eps_tables}')||'[\"project_creation_intents\"]'::jsonb)item)),'{project39}',(prior->'project39')||"+c.b.old.json_sql(meta)+')')
 check="insert into supabase_migrations.schema_migrations(version,statements,name)values('"+s.VERSION+"',array[]::text[],'m07_project_creation');do $guard_local$declare prior jsonb;observed jsonb;expected jsonb;begin select value into prior from project39_guard_input;"+after+" into observed;expected:="+updates[0]+";if observed is distinct from expected and observed is distinct from "+updates[1]+" then raise exception using message='PROJECT39_LOCAL_GUARD_MISMATCH',detail=(select jsonb_agg(key)::text from jsonb_each(observed)where value is distinct from expected->key);end if;end$guard_local$;delete from supabase_migrations.schema_migrations where version='"+s.VERSION+"';select jsonb_build_object('release39_guard_query_passed',true);"
 def replace(old,new):
  nonlocal source
  s.need(source.count(old)==1);source=source.replace(old,new)
 replace("const ROOT = path.resolve(import.meta.dirname, '../../..');","const ROOT = "+json.dumps(str(ROOT).replace('\\','/'))+';')
 replace("path.join(ROOT, '.local/project-creation39-proof', runId)","path.join(ROOT, '.local/project39-canonical-guard-validation', runId)")
 replace("'tracking/evidence/m07/project-creation39-proof'","'tracking/evidence/m07/project39-canonical-guard-validation'")
 replace("'development/m07/project-creation39-proof/run.mjs': sha(await readFile(import.meta.filename))",json.dumps(relative)+": sha(await readFile(import.meta.filename))")
 replace("'\\nset local role postgres;\\n' + functional + '\\nreset role;\\n'","'\\nset local role postgres;\\n' + "+json.dumps(capture)+" + functional + "+json.dumps(check)+" + '\\nreset role;\\n'")
 replace("const results = rows(result.stdout); const restored = results.find(r => r['supabase_migrations.schema_migrations']);","const results = rows(result.stdout); assert.equal(results.find(r=>r.release39_guard_query_passed)?.release39_guard_query_passed,true); report.release39_guard_query_passed=true; report.canonical_public_usage_preserved=true; report.guard_source_pins="+json.dumps(c.source_pins(),sort_keys=True)+"; report.canonical_acl_anchor="+json.dumps(c.canonical_acl_anchor,sort_keys=True)+"; const restored = results.find(r => r['supabase_migrations.schema_migrations']);")
 replace("synthetic current38 metadata restored into owned disposable local database; byte-exact39 functional DDL and sequential permissions/replay tests in one ROLLBACK; no cloud, concurrent-session race, provider or hosted acceptance","new local validation of exact release39 metadata/OAuth/raw-catalogue/grant queries before/after exact39 functional DDL plus retained32 SQL assertions; owned disposable local DB and full ROLLBACK; no canonical prefix/CLI/cloud acceptance")
 return source

if __name__=='__main__':
 if len(sys.argv)!=2:raise ValueError('Supply the original owned workspace root.')
 relative='.local/project39-canonical-guard-validator-source/controller-'+str(uuid.uuid4())+'.mjs';text=compile_controller(Path(sys.argv[1]).resolve(),relative);file=ROOT/relative;file.parent.mkdir(parents=True,exist_ok=True)
 with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(text)
 print(json.dumps({'controller':str(file),'sha256':s.sha(text.encode()),'database_executed':False,'cloud_called':False}))
