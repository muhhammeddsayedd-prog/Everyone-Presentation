"""Pure synthetic envelope/role/error guards; no operator or database calls."""
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('specs_access_diagnostic', Path(__file__).with_name('specs-access.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AccessTests(unittest.TestCase):
    def test_transport_metadata_is_discarded_and_the_one_closed_row_is_required(self):
        value = {'rows': [{'specs_access_scope': {'role': 'authenticated'}}], 'warning': 'SYNTHETIC_PRIVATE'}
        self.assertEqual(module.row(value, 'specs_access_scope'), {'role': 'authenticated'})
        for change in [{'rows': []}, {'rows': [{'other': {}}]}, {'rows': [{'specs_access_scope': {}, 'extra': 'PRIVATE'}]}]:
            with self.assertRaises(ValueError):
                module.row(change, 'specs_access_scope')

    def test_scope_template_admits_only_two_fixed_roles_and_remains_read_only(self):
        template = (Path(__file__).with_name('SPECS_ACCESS_SCOPE.sql')).read_text()
        for role in ('authenticated', 'eps_specs_submit_owner'):
            rendered = module.render_scope(template, role)
            self.assertIn('begin read only;', rendered.lower())
            self.assertIn('set local role ' + role + ';', rendered)
            self.assertIn('rollback;', rendered.lower())
        for role in ('postgres', 'authenticated; SELECT private', '../escape'):
            with self.assertRaises(ValueError):
                module.render_scope(template, role)

    def test_error_projection_never_copies_arbitrary_cli_diagnostics(self):
        observed = module.safe_error('SQLSTATE 42501: permission denied for schema eps\nSYNTHETIC_PRIVATE_TOKEN')
        self.assertEqual(observed, {'sqlstate': '42501', 'permission_denied': True, 'permission_object': 'schema:eps'})
        unknown = module.safe_error('SYNTHETIC_PRIVATE_TOKEN permission denied for table secret_material')
        self.assertIsNone(unknown['permission_object'])
        self.assertNotIn('SYNTHETIC_PRIVATE', json.dumps(observed) + json.dumps(unknown))

    def test_scope_is_closed_and_binds_exact_actor_role_and_boolean_results(self):
        value = {'role': 'eps_specs_submit_owner', 'actor_id': module.ACTOR, 'projects_read': True,
                 'workspaces_write': True, 'project_write': True, 'workspace_read': True, 'workspace_write': True}
        self.assertEqual(module.scope(value, value['role']), value)
        for patch in ({'actor_id': module.PROJECT}, {'role': 'postgres'}, {'workspace_write': 1}, {'extra': 'PRIVATE'}):
            with self.assertRaises(ValueError):
                module.scope({**value, **patch}, value['role'])

    def test_metadata_covers_fresh_empty_workspace_without_source_or_jobs(self):
        value = {'database':'postgres','operator':'postgres','read_only':True,'history':list(module.origin.VERSIONS),
                 'actor_id':module.ACTOR,'actor_exists':True,'project_id':module.PROJECT,'workspace_id':module.WORKSPACE,
                 'project_exists':True,'project_archived':False,'workspace_project_id':module.PROJECT,'workspace_archived':False,
                 'membership_count':1,'active_write_membership_count':1,'projects_read':True,'workspaces_read':True,'workspaces_write':True,
                 'specs_count':1,'specs_ids':['11111111-2222-4333-8444-555555555555'],'specs_row_versions':[1],'specs_have_source':[False],
                 'workspace_jobs_count':0,'accepted_specs_idempotency_count':0,'workspace_initializer_enabled':True,
                 'submit_owner':'eps_specs_submit_owner','submit_security_definer':True,'submit_authenticated_execute':True,
                 'scope_security_definer':False,'scope_submit_owner_execute':True,'submit_inherits_authenticated':True,
                 'submit_eps_usage':True,'authenticated_eps_usage':False,'authenticated_scope_execute':False,
                 'submit_scope_select_privileges':True,'submit_workspace_lock_privilege':True}
        self.assertEqual(module.metadata(value), value)
        for patch in ({'specs_count':0}, {'projects_read':1}, {'history':list(module.origin.VERSIONS[:-1])}, {'private':'SYNTHETIC_PRIVATE'}):
            with self.assertRaises(ValueError):
                module.metadata({**value,**patch})

    def test_known_cli_preload_debug_flags_are_blocked_before_any_operator_call(self):
        for key in ('NODE_OPTIONS','NPM_CONFIG_NODE_OPTIONS','NODE_DEBUG','NODE_DEBUG_NATIVE','SUPABASE_DEBUG'):
            with self.assertRaises(ValueError):
                module.validate_environment({key.lower():'SYNTHETIC_PRIVATE'})
        module.validate_environment({'NODE_DEBUG':'','UNRELATED_CONFIG':'allowed'})


if __name__ == '__main__':
    unittest.main()
