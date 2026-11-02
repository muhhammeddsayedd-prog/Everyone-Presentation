"""Pure query/projection checks. No provider, SQL execution or private reads."""
from pathlib import Path
import unittest
from pglast import ast, parse_sql

HERE=Path(__file__).resolve().parent

class Tests(unittest.TestCase):
 def test_readonly_transaction_one_select_no_actor_or_mutation(self):
  sql=(HERE/'inspect.sql').read_text(encoding='utf8')
  statements=[item.stmt for item in parse_sql(sql)]
  self.assertEqual([type(item) for item in statements],[ast.TransactionStmt,ast.VariableSetStmt,ast.VariableSetStmt,ast.VariableSetStmt,ast.SelectStmt,ast.TransactionStmt])
  self.assertIn('read only',sql)
  self.assertIn('rollback;',sql)
  for forbidden in ['auth.users','auth.sessions','set role','set session authorization','set_config(',"request.jwt",'create function','insert into','delete from','update public','update eps']:
   self.assertNotIn(forbidden,sql.lower())
 def test_narrow_ids_and_private_inputs_stay_inside_boolean_checks(self):
  sql=(HERE/'inspect.sql').read_text(encoding='utf8')
  self.assertIn("'original_create_audit_bound',exists(",sql)
  self.assertIn("a.request_id='5cf2962f-5b7e-46fc-90ef-36980f15dd68'",sql)
  self.assertIn("'canonical_body_hash_and_receipt_match',exists(",sql)
  self.assertIn("'storyboard_intent',exists(",sql)
  for forbidden in ["'name',p.name,'project_count'", "'key',r.key", "'request_hash',r.request_hash", "'principal_id'", "'response',r.response", "'created_by'"]:
   self.assertNotIn(forbidden,sql)
  self.assertEqual(sql.count('as owner_project39_observation'),1)
  self.assertEqual(sql.count('09f4286a-d46d-4245-9255-67a6ee8e54f5'),3)

if __name__=='__main__':unittest.main()
