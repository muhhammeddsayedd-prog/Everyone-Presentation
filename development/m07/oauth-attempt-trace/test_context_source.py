"""Deterministic closure against the immutable migration32 wrapper bodies."""
from pathlib import Path
import re,unittest
ROOT=Path(__file__).resolve().parents[3]
OLD=ROOT/'supabase/migrations/20261031104603_m07_oauth_consent_binding_and_claims.sql'
NEW=ROOT/'supabase/migrations/20261031130207_m07_oauth_consent_browser_context.sql'

class ContextSourceTest(unittest.TestCase):
 def test_wrappers_change_only_the_reviewed_identity_prefix(self):
  for name in('public.eps_oauth_consent_claim','public.eps_oauth_consent_finish'):
   def body(text):return re.search(r'create(?: or replace)? function '+re.escape(name)+r'\([^\n]+?as \$\$(.*?)\$\$;',text,re.S)[1]
   expected=body(OLD.read_text()).replace('declare principal uuid:=auth.uid();sid uuid;','declare principal uuid;sid uuid;context jsonb;',1).replace(' sid:=eps.oauth_consent_browser_session();'," context:=eps.oauth_consent_browser_context();principal:=(context->>'principal_id')::uuid;sid:=(context->>'session_id')::uuid;",1)
   self.assertEqual(body(NEW.read_text()),expected,name)
 def test_no_managed_grant_membership_or_policy_change(self):
  source=NEW.read_text()
  self.assertNotRegex(source,r'(?im)^\s*(?:grant|revoke).*\bon\s+(?:schema\s+)?auth\b')
  self.assertNotRegex(source,r'(?im)^\s*(?:grant|revoke)\s+(?:authenticated|supabase_auth_admin|supabase_admin)\b')
  self.assertNotRegex(source,r'(?im)^\s*(?:alter|create|drop)\s+policy.*\bon\s+auth\.')
 def test_empty_search_path_and_private_bridge(self):
  source=NEW.read_text()
  self.assertIn("language plpgsql stable security definer set search_path=''set timezone='UTC'",source)
  self.assertIn('revoke all on function eps.oauth_consent_browser_context()from public,anon,authenticated,service_role;',source)
  self.assertIn('grant execute on function eps.oauth_consent_browser_context()to eps_oauth_consent_owner;',source)

if __name__=='__main__':unittest.main()
