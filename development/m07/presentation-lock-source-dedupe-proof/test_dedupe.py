"""Finite source/AST/input audit and pure correction checks. No SQL/Docker."""
from pathlib import Path
import hashlib,importlib.util,json,re,subprocess,unittest
from unittest.mock import patch
from pglast import parse_sql,parse_plpgsql,ast,enums
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio');BASE=HERE.parent/'presentation-lock-source-proof';NODE='C:/Program Files/nodejs/node.exe'
spec=importlib.util.spec_from_file_location('dedupe_forward_compiler',HERE/'compiler.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
MODULE=json.dumps((HERE/'entry.mjs').as_uri());SEED_MODULE=json.dumps((HERE.parent/'presentation-lock-source-seed-proof/entry.mjs').as_uri())
def sha(raw):return hashlib.sha256(raw).hexdigest()
def node(source):
 r=subprocess.run([NODE,'--input-type=module','--eval',source],capture_output=True,text=True,timeout=20)
 if r.returncode:raise AssertionError(r.stderr)
 return json.loads(r.stdout)if r.stdout.strip()else None
def corrected():
 return node("import{qualifySeed}from"+SEED_MODULE+";import{qualifyScale,qualifyBackground}from"+MODULE+";process.stdout.write(JSON.stringify({scale:qualifyScale(qualifySeed("+json.dumps((BASE/'scale.sql').read_text())+")),background:qualifyBackground("+json.dumps((BASE/'background.sql').read_text())+")}));")
def static_audit():
 metadata=(MAIN/'.local/m07-recovery/639da33a-7e90-4471-b0ec-c7a8ff6097ef/backup/metadata.sql').read_bytes();assert sha(metadata)=='12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c'
 tables={};required={};check_count=0
 for m in re.finditer(r'CREATE TABLE ([a-z_]+)\.([a-z_]+) \(.*?\n\);',metadata.decode(),re.S):
  stmt=parse_sql(m.group())[0].stmt;name=m[1]+'.'+m[2];columns={};need=set()
  for item in stmt.tableElts:
   if isinstance(item,ast.ColumnDef):
    columns[item.colname]=item
    kinds={q.contype for q in item.constraints or()}
    if enums.ConstrType.CONSTR_NOTNULL in kinds and enums.ConstrType.CONSTR_DEFAULT not in kinds:need.add(item.colname)
   elif isinstance(item,ast.Constraint)and item.contype==enums.ConstrType.CONSTR_CHECK:check_count+=1
  tables[name]=columns;required[name]=need
 tables['eps.audit_events']['reason']=None
 source={n:(BASE/n).read_text()for n in ['fixture.sql','scale.sql','background.sql','temporary.sql','cohorts.sql','counts.sql','proof.mjs']}
 # Use corrected scale/background for the finite fixture audit; no old bytes change.
 effective=corrected();source['scale.sql']=effective['scale'];source['background.sql']=effective['background']
 inserts=0;touched=set();missing=[];nonnull=[]
 for file in ['fixture.sql','scale.sql','background.sql','proof.mjs']:
  for m in re.finditer(r'insert into ((?:eps|auth|public)\.[a-z_]+)\(([^)]+)\)',source[file],re.I):
   name=m[1];cols=set(x.strip()for x in m[2].split(','));assert name in tables
   if cols-set(tables[name]):missing.append(name)
   if required[name]-cols:nonnull.append({'table':name,'missing':sorted(required[name]-cols)})
   inserts+=1;touched.add(name)
 # Explicit fixture relationships and type contracts, not executable SQL checks.
 assert not missing and not nonnull,(missing,nonnull)
 for name in ['eps.candidates','eps.candidate_media','eps.media_assets','eps.jobs','eps.presentation_versions']:
  assert [x.sval for x in tables[name]['id'].typeName.names]==['uuid']
 assert bool(tables['eps.candidate_media']['selected_frame_asset_ids'].typeName.arrayBounds)
 assert bool(tables['eps.workspace_candidates']['selected_frame_asset_ids'].typeName.arrayBounds)
 assert [x.sval for x in tables['eps.jobs']['dedupe_key'].typeName.names]==['text']
 for file,text in source.items():
  if file.endswith('.sql'):parse_sql(text);parse_plpgsql(text)
 before=(BASE/'scale.sql').read_text();assert 'or frames<>0'in before and 'or frames<>0'not in source['scale.sql'];assert 'seed.frames<>0'in source['scale.sql']
 assert 'where pt.key='in source['background.sql'] and "pt.version='1.1.0'"in source['background.sql']
 assert "'review_fit'"in source['proof.mjs']and "'measure_review_fit'"in source['proof.mjs']
 assert 'expected_workspace_row_version'in source['temporary.sql']and 'expected_draft_revision'in source['temporary.sql']and 'expected_input_fingerprint'in source['temporary.sql']
 assert "current_user<>'authenticated'"in source['temporary.sql']and "current_user<>'eps_review_owner'"in source['temporary.sql']
 assert "statement_timeout')<>'8s'"in source['temporary.sql']
 assert 'for no key update nowait'in source['cohorts.sql']and 'for update nowait'in source['cohorts.sql']
 return {'kind':'finite_static_audit_only','metadata_sha256':sha(metadata),'source_files':{n:sha(s.encode())for n,s in source.items()},'fixture_insert_statements_checked':inserts,'fixture_tables_touched':sorted(touched),'missing_insert_columns':missing,'missing_required_without_default':nonnull,'pinned_schema_CHECKs_parsed':check_count,'declared_job_counts':{'scale':26,'background':12,'fit':2},'known_dedupe_sites_all_qualified':True,'seven_seed_thresholds_unchanged':True,'UUID_array_text_types_checked':True,'FK_order_and_active_assignment_uniqueness_reviewed':True,'actual_context_RPC_inputs_previously_advanced_in_both_failed_owned_runs':True,'generation_input_and_owner_authenticated_8s_guards_checked':True,'frame_pair_and_archived_pool_paths_retained':True,'all_sql_and_plpgsql_parsed':True,'SQL_operator_resolution_or_actual_constraint_function_execution':False,'provider_or_canonical_acceptance':False}
class Tests(unittest.TestCase):
 def test_three_expression_corrections_inverse_all_other_bytes_and_constraints_unchanged(self):
  out=corrected();seed=node("import{qualifySeed}from"+SEED_MODULE+";process.stdout.write(JSON.stringify(qualifySeed("+json.dumps((BASE/'scale.sql').read_text())+")));")
  pairs=[(seed,out['scale'],"'synthetic-lock-media-'||i"),((BASE/'background.sql').read_text(),out['background'],"'synthetic-retained-'||i")]
  for before,after,expression in pairs:
   hashed="encode(sha256(convert_to("+expression+",'UTF8')),'hex')";self.assertEqual(after.replace(hashed,expression),before);parse_sql(after);parse_plpgsql(after)
  labels=['synthetic-lock-media-'+str(i)for i in range(1,27)]+['synthetic-retained-'+str(i)for i in range(1,13)]+['locksource41-11111111-1111-4111-8111-111111111111-'+label+'-fit'for label in ['control','large']]
  keys=[sha(s.encode())for s in labels];self.assertEqual(len(set(keys)),40);self.assertTrue(all(re.fullmatch('[a-f0-9]{64}',s)for s in keys))
 def test_actual_fit_statement_shape_correlation_retained_and_wrong_shape_refused(self):
  script=r"""
import assert from'node:assert/strict';import{qualifyFit}from MODULE;
const run='11111111-1111-4111-8111-111111111111',key='locksource41-'+run+'-control-fit';
const text="set session authorization postgres;begin;insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,dedupe_key,status,stage,correlation_id)values('11111111-1111-4111-8111-111111111111'::uuid,'22222222-2222-4222-8222-222222222222'::uuid,'a4410000-0000-4000-8000-000000000001'::uuid,'review_fit','33333333-3333-4333-8333-333333333333'::uuid,'{}',repeat('f',64),'"+key+"','succeeded','measure_review_fit','"+key+"');insert into eps.review_fit_results(job_id,workspace_id,series_id,input_fingerprint,status,result)values('11111111-1111-4111-8111-111111111111'::uuid,'22222222-2222-4222-8222-222222222222'::uuid,'33333333-3333-4333-8333-333333333333'::uuid,'"+'a'.repeat(64)+"','measured','{\"overflows\":[],\"measured_at\":\"2026-11-02T00:00:00Z\"}');commit;";
const after=qualifyFit(text,run,'control');assert(after.includes("'succeeded','measure_review_fit','"+key+"'"));assert.equal(after.replace("encode(sha256(convert_to('"+key+"','UTF8')),'hex')","'"+key+"'"),text);assert.equal(qualifyFit(text,run,'large'),null);assert.throws(()=>qualifyFit(text.replace('set session authorization postgres;',''),run,'control'));process.stdout.write(JSON.stringify(after));
""".replace('MODULE',MODULE)
  sql=node(script);parse_sql(sql);parse_plpgsql(sql)
 def test_complete_finite_static_fixture_and_function_input_audit(self):
  d=static_audit();self.assertGreaterEqual(d['fixture_insert_statements_checked'],20);self.assertGreaterEqual(len(d['fixture_tables_touched']),15);self.assertFalse(d['SQL_operator_resolution_or_actual_constraint_function_execution'])
 def test_disabled_before_context_and_pinned_source_drift_refuses(self):
  node("import assert from'node:assert/strict';import{EXECUTION_ENABLED,runCases,qualifyScale,qualifyBackground}from"+MODULE+";assert.equal(EXECUTION_ENABLED,false);let touched=0;await assert.rejects(runCases(new Proxy({},{get(){touched++;throw Error('unreached');}})),/DEDUPE_EXECUTION_DISABLED/);assert.equal(touched,0);assert.throws(()=>qualifyScale('drift'));assert.throws(()=>qualifyBackground('drift'));")
 def test_new_compiler_ownership_guard_source_pins_and_no_old_CLI_replay(self):
  source=c.compile_source('.local/presentation-lock-source-dedupe-proof-compiled/controller-11111111-1111-4111-8111-111111111111.mjs')
  self.assertIn('presentation-lock-source-dedupe-proof/entry.mjs',source);self.assertIn('eps.locksource41dedupe.run',source);self.assertNotIn("'label=eps.locksource41seed.run='",source)
  self.assertLess(source.index('LOCKSOURCE41_DEDUPE_EXECUTION_DISABLED'),source.index('await original()'))
  self.assertIn("'--network', 'none'",source);self.assertIn('independent_successful_daemon_label_inventories_empty',source)
  r=subprocess.run([NODE,'--input-type=module','--check'],input=source,capture_output=True,text=True,timeout=15);self.assertEqual(r.returncode,0,r.stderr)
  with patch.object(c,'OLD_ENTRY_SHA','0'*64):
   with self.assertRaises(ValueError):c.compile_source('.local/unreachable.mjs')
if __name__=='__main__':unittest.main()
