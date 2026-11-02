from pathlib import Path
import importlib.util,json,re,subprocess,unittest
from pglast import ast,enums,parse_sql,parser
HERE=Path(__file__).resolve().parent
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
c=module('owner_candidate_compiler_test',HERE/'compiler.py');fix=module('owner_candidate_fixture_fix_test',HERE/'fixture-correction.py')
NODE='C:/Program Files/nodejs/node.exe'
def parsed(sql):return parse_sql(sql.replace('__FORWARD_SYSTEM_SQL__',"'99000000000000001'").replace('__FORWARD_RUN_SQL__',"'4219ebad-e1f3-42b5-9a66-11d32b33c215'"))
def require_actors(sql):
 session='postgres';role=None;initial_assert=False;returned_assert=False;owned_guard=False;ledger=False
 for item in parsed(sql):
  stmt=item.stmt
  if isinstance(stmt,ast.VariableSetStmt):
   if stmt.name=='session_authorization':
    session='supabase_admin'if stmt.kind==enums.VariableSetKind.VAR_RESET else stmt.args[0].val.sval;role=None
    if session=='supabase_admin'and not owned_guard:raise ValueError('admin before owned guard')
   elif stmt.name=='role':
    if stmt.kind==enums.VariableSetKind.VAR_RESET:role=None
    else:
     if session!='supabase_admin'or not initial_assert:raise ValueError('nonadmin cannot set StorageAdmin')
     role=stmt.args[0].val.sval
  elif isinstance(stmt,ast.DoStmt):
   body=next(arg.arg.sval for arg in stmt.args if arg.defname=='as')
   if 'FORWARD_EXACT_OWNED39_FIXTURE_REQUIRED'in body:owned_guard=True
   if 'FORWARD_EXACT_INITIAL_OWNED_ADMIN_REQUIRED'in body:
    if session!='supabase_admin'or role is not None or"session_user<>'supabase_admin'"not in body or"current_user<>'supabase_admin'"not in body or'rolsuper'not in body:raise ValueError('missing exact initialadmin')
    initial_assert=True
   if 'insert into eps.oauth_consent_claims'in body:
    if session!='supabase_admin'or role is not None:raise ValueError('synthetic ledger fixture must use original owned admin')
    ledger=True
   if 'FORWARD_POSTGRES_ACTOR_RETURN_REQUIRED'in body:
    if session!='postgres'or role is not None:raise ValueError('missing postgres return')
    returned_assert=True
  elif isinstance(stmt,(ast.AlterTableStmt,ast.CreateFunctionStmt,ast.CreateTrigStmt)):
   if session!='supabase_admin'or role!='supabase_storage_admin':raise ValueError('managed DDL actor')
  elif isinstance(stmt,ast.SelectStmt):
   if not ledger or not returned_assert or session!='postgres'or role is not None:raise ValueError('fixture result actor')
 if not all((owned_guard,initial_assert,ledger,returned_assert)):raise ValueError('incomplete actor sequence')
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.source,cls.cfg,cls.library,cls.cases=c.compile_source('.local/reason40-forward-owner-source/offline-not-written.mjs');_,cls.oldcfg,_,cls.oldcases=c.old.compile_source('.local/reason40-forward-owner-source/offline-not-written.mjs')
 def test_real_failing_fixture_actor_sequence_RED_then_corrected_GREEN(self):
  with self.assertRaisesRegex(ValueError,'nonadmin'):require_actors(self.oldcfg['forward_fixture_sql'])
  require_actors(self.cfg['forward_fixture_sql']);self.assertEqual(fix.correct(self.oldcfg['forward_fixture_sql']),self.cfg['forward_fixture_sql'])
 def test_only_two_exact_fixture_insertions_and_no_additional_runtime_layer(self):
  new=self.cfg['forward_fixture_sql'];inverse=fix.replace_once(fix.replace_once(new,fix.NEW_RETURN,fix.OLD_RETURN),fix.NEW_SWITCH,fix.OLD_SWITCH);self.assertEqual(inverse,self.oldcfg['forward_fixture_sql']);self.assertEqual(self.cases,self.oldcases)
  for key in('state_sql','checkpoint_sql','qualification_sql','config_setup_sql'):self.assertEqual(self.cfg[key],self.oldcfg[key])
  self.assertEqual((HERE/'cases.mjs').read_bytes().replace(b'export const EXECUTION_ENABLED=false;',b'export const EXECUTION_ENABLED=true;'),(c.PRIOR/'cases.mjs').read_bytes());self.assertFalse(self.library.exists())
  for forbidden in('grant ','revoke ','alter role','create role','add member','set_config('):
   self.assertNotIn(forbidden,(fix.NEW_SWITCH+fix.NEW_RETURN).lower())
 def test_generated_SQL_PLpgSQL_and_Node_parse(self):
  parsed(self.cfg['forward_fixture_sql'])
  for block in re.finditer(r'do \$([a-z_]+)\$.*?\$\1\$;',self.cfg['forward_fixture_sql'],re.S):parser.parse_plpgsql_json(block[0].replace('__FORWARD_SYSTEM_SQL__',"'99000000000000001'").replace('__FORWARD_RUN_SQL__',"'4219ebad-e1f3-42b5-9a66-11d32b33c215'"))
  for text in(self.source,self.cases):self.assertEqual(subprocess.run([NODE,'--check','--input-type=module'],input=text.encode(),capture_output=True,timeout=10).returncode,0)
 def test_missing_assert_reset_or_return_refuses_and_extra_source_edit_refuses(self):
  sql=self.cfg['forward_fixture_sql']
  for altered in(sql.replace(fix.NEW_SWITCH,fix.OLD_SWITCH),sql.replace('reset role;\ndo $forward_ledger$','do $forward_ledger$'),sql.replace(fix.NEW_RETURN,fix.OLD_RETURN)):
   with self.assertRaises(ValueError):require_actors(altered)
  with self.assertRaises(ValueError):fix.correct(self.oldcfg['forward_fixture_sql']+'-- source drift')
 def test_new_default_off_before_target(self):
  script='const m=await import('+json.dumps((HERE/'cases.mjs').as_uri())+');if(m.EXECUTION_ENABLED)process.exit(8);try{await m.runCases({get system(){throw Error("target touched");}},{});process.exit(9);}catch(e){if(e.code!=="ERR_ASSERTION"||!e.message.includes("DISABLED"))process.exit(7);}'
  self.assertEqual(subprocess.run([NODE,'--input-type=module','-e',script],capture_output=True,timeout=10).returncode,0)
if __name__=='__main__':unittest.main()
