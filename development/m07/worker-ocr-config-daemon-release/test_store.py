"""Real synthetic files, actual State without.load, fake guard; no live ACL/ports."""
from pathlib import Path
import hashlib,importlib.util,json,tempfile,unittest
HERE=Path(__file__).resolve().parent
def module(name,p):
 s=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
p=module('ocr_real_store_provider',HERE/'provider.py');states=module('ocr_real_store_state_fixture',HERE/'test_state.py')
class Guard:
 def create(self,p):return p.open('xb')
 def verify(self,p):assert p.is_file()
 def verify_open(self,f):assert f.writable()
class Tests(unittest.TestCase):
 def test_actual_module_loader_handles_owner_claim_response_normal_and_hash_with_State_no_load(self):
  state,_,_,_=states.Tests().fixture();self.assertFalse(hasattr(state,'load'));self.assertIs(p.s,p.old.old.s)
  with tempfile.TemporaryDirectory()as root:
   port=p.Provider.__new__(p.Provider);port.s=state;port.e=p.env;port.private=Path(root)/'owned';port.inputs={'run':'00000000-0000-4000-8000-000000000001'};port.guard=Guard();port.bindings=lambda:{'synthetic_source':'bound'}
   action={'method':'PATCH','key':'EPS_DAEMON_SOURCE_SHA256','id':'synthetic-row','body':{'value':'a'*64}}
   port.write('env-0.claim.json',{'action':action});port.write('env-0.response.json',{'claim_sha256':port.hash('env-0.claim.json'),'response':{'id':action['id'],'key':action['key'],'value':'a'*64}})
   port.write('env-0.normal.json',{'claim_sha256':port.hash('env-0.claim.json'),'normal_return_observed':True});value=port.read('env-0.normal.json')
   self.assertEqual(value['response_sha256'],port.hash('env-0.response.json'));self.assertEqual(port.hash('env-0.claim.json'),hashlib.sha256((port.private/'env-0.claim.json').read_bytes()).hexdigest());self.assertEqual(port.read('owner.json')['owner'],p.a.PURPOSE)
   with self.assertRaises(ValueError):port.write('env-0.claim.json',{'action':action})
   response=json.loads((port.private/'env-0.response.json').read_text());response['response']['value']='PRIVATE_SYNTHETIC_TAMPER';(port.private/'env-0.response.json').write_text(json.dumps(response))
   with self.assertRaises(ValueError):port.read('env-0.normal.json')
if __name__=='__main__':unittest.main()
