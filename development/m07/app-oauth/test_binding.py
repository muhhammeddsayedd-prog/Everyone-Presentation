"""Guard regressions only: no database, provider, credential or subprocess call."""
import copy,importlib.util,unittest
from pathlib import Path
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('m07_binding',HERE/'bind-client.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
CLIENT='dd850884-dce1-4aee-a178-1e90bda76ace'
def response():return {'resource':'http://127.0.0.1:3000/mcp','client_id':CLIENT,'enabled':True,'inserted_rows':1,'ready_settings_capabilities_unchanged':True}
class BindingGuards(unittest.TestCase):
 def test_ambient_target_overrides_rejected_before_any_dispatch(self):
  module.validate_environment({})
  for name in module.FORBIDDEN_ENV:
   with self.subTest(name=name),patch.dict(module.os.environ,{name:'synthetic-override'},clear=True),patch.object(module.subprocess,'run')as call:
    with self.assertRaisesRegex(ValueError,'MCP_BIND_AMBIENT_TARGET_OVERRIDE'):module.main()
    with self.assertRaisesRegex(ValueError,'MCP_BIND_AMBIENT_TARGET_OVERRIDE'):module.validate_environment({name:'synthetic-override'})
    call.assert_not_called()
 def test_booleans_and_integers_cannot_impersonate_confirmed_write(self):
  self.assertEqual(module.validate_binding(response(),CLIENT),response())
  for field,value in [('enabled',1),('inserted_rows',True),('ready_settings_capabilities_unchanged',1),('inserted_rows',0)]:
   changed=response();changed[field]=value
   with self.subTest(field=field,value=value),self.assertRaises(ValueError):module.validate_binding(changed,CLIENT)
 def test_closed_result_and_exact_resource_and_client_required(self):
  for changed in [dict(response(),access_token='synthetic-private-extra'),dict(response(),client_id='wrong'),dict(response(),resource='http://localhost:3000/mcp')]:
   with self.assertRaises(ValueError):module.validate_binding(changed,CLIENT)
 def test_inspection_private_fields_and_typed_settings_are_rejected(self):
  versions=['20261030154824']
  valid={'database':'postgres','operator':'postgres','history':versions,'bindings':[{'resource':response()['resource'],'client_id':CLIENT,'enabled':True}],'hook_present':True,'hook_security':dict.fromkeys(module.HOOK_CHECKS,True),'settings':{'timezone':'Africa/Cairo','template_version':'1.1.0','row_version':3}}
  self.assertEqual(module.validate_inspection(valid,versions),valid)
  for change in [lambda x:x['settings'].update(access_token='synthetic-private-extra'),lambda x:x['settings'].update(row_version=True),lambda x:x['bindings'][0].update(enabled=1),lambda x:x.update(hook_present=1),lambda x:x.update(history=['wrong']),lambda x:x['hook_security'].update(auth_admin_schema=1),lambda x:x['hook_security'].update(auth_admin_no_other_eps_execute=False)]:
   changed=copy.deepcopy(valid);change(changed)
   with self.assertRaises(ValueError):module.validate_inspection(changed,versions)
if __name__=='__main__':unittest.main()
