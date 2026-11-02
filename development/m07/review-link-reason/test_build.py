"""Pure source gates. No SQL/Docker/provider execution."""
from pathlib import Path
import importlib.util,json,re,unittest
from unittest.mock import patch
from pglast import parse_sql
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('reason40_builder',HERE/'build.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)

class Tests(unittest.TestCase):
 def test_committed_candidate_is_exact_finite_output_and_parses(self):
  text=b.build();self.assertEqual(text,b.MIGRATION.read_text(encoding='utf-8'));nodes=parse_sql(text);self.assertEqual(len(nodes),10)
  names=[type(node.stmt).__name__ for node in nodes];self.assertEqual(names.count('CreateFunctionStmt'),4);self.assertEqual(names.count('AlterTableStmt'),1)
  change=next(node.stmt for node in nodes if type(node.stmt).__name__=='AlterTableStmt');self.assertEqual(change.relation.schemaname,'eps');self.assertEqual(change.relation.relname,'audit_events');self.assertEqual(len(change.cmds),1);self.assertEqual(change.cmds[0].def_.colname,'reason');self.assertIsNone(change.cmds[0].def_.constraints)
 def test_baseline_function_drift_refuses_before_output(self):
  with patch.object(b,'SOURCE_HASHES',('0'*64,*b.SOURCE_HASHES[1:])):
   with self.assertRaises(ValueError):b.build()
 def test_four_function_outer_definitions_keep_signatures_and_security_attributes(self):
  before=json.loads(b.BASE.read_text(encoding='utf-8'));after=parse_sql(b.build());created=[node.stmt for node in after if type(node.stmt).__name__=='CreateFunctionStmt']
  self.assertEqual(len(created),4)
  for signature,new in zip(b.NAMES,created):
   old=parse_sql(next(row['definition']for row in before['routines']if row['signature']==signature))[0].stmt
   self.assertEqual(new.funcname,old.funcname);self.assertEqual(new.parameters,old.parameters);self.assertEqual(new.returnType,old.returnType)
   self.assertEqual([value for value in new.options if value.defname!='as'],[value for value in old.options if value.defname!='as'])
 def test_replay_hashes_mac_and_rotation_credential_gate_are_preserved(self):
  text=b.build()
  self.assertIn("encode(sha256(convert_to(p_input::text,'UTF8')),'hex'),p_result",text)
  self.assertIn("eps.presentation_hash(jsonb_build_object('id',p_review_link_id,'input',p_input))",text)
  rotate=next(node.stmt for node in parse_sql(text)if type(node.stmt).__name__=='CreateFunctionStmt'and node.stmt.funcname[-1].sval=='eps_rotate_review_link')
  body=next(option.arg[0].sval for option in rotate.options if option.defname=='as')
  self.assertLess(body.index('eps.review_link_require(item.series_id,true)'),body.index('eps.review_credential_admit'))
  self.assertLess(body.index('eps.review_credential_admit'),body.index('eps.review_token_replay'))
  self.assertNotIn('eps.review_remember(',body)
  before=json.loads(b.BASE.read_text(encoding='utf-8'));old=b.source(next(row['definition']for row in before['routines']if row['signature']==b.NAMES[3])).replace('\r\n','\n')
  for line in old.splitlines():
   if any(term in line for term in ['extensions.hmac','for index_value','issued:','delete from eps.review_gateway_nonces','insert into eps.review_gateway_nonces']):self.assertIn(line,text)
 def test_trace_is_closed_and_reason_storage_is_action_specific(self):
  text=b.build();self.assertEqual(text.count(b.TRACE),2)
  self.assertIn("if p_operation in('revoke_link','rotate_link')then audit_reason:=p_input#>>'{input,reason}';end if",text)
  self.assertNotIn("insert into eps.audit_events(principal_id,action,resource_id,request_id,client_type,reason)values(auth.uid(),'review.'||p_operation,p_resource,request_id,client_type,p_input)",text)
  for word in ['authorization','service_role','grant ','create policy','disable row level','drop table','drop function']:
   self.assertNotIn(word,text.lower())
 def test_gateway_bound_is_closed_operation_specific_and_derived(self):
  text=b.build();self.assertIn('payload_limit integer:=65536',text);self.assertIn("if p_operation='rotate_review_link'and jsonb_typeof(p_input)='object'then",text)
  self.assertFalse("perform eps.review_body(p_input,array['actor_id'"in text,'shared review_body caps the full envelope and defeats the reason allowance')
  self.assertIn('65536+3+6*(200+16384)+36*2+64',text);self.assertIn("octet_length((p_input->'input')::text)>65536+3",text)
  for fields in ["array['actor_id','subject_id','input','idempotency_key','token_digest','response_encrypted']","array['row_version','reason']"]:self.assertIn(fields,text)
  near={'row_version':1,'reason':''};empty=json.dumps(near,separators=(',',':'));near['reason']='x'*(65536-len(empty.encode()));self.assertEqual(len(json.dumps(near,separators=(',',':')).encode()),65536)
  self.assertEqual(len(json.dumps(near,separators=(', ',': ')).encode()),65539)

if __name__=='__main__':unittest.main()
