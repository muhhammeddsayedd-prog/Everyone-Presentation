"""Synthetic, offline guard/protocol regressions; never loads a credential."""
import copy
import importlib.util
from pathlib import Path
import unittest
from unittest import mock

FILE = Path(__file__).with_name('hosted-provider.py')
SPEC = importlib.util.spec_from_file_location('hosted_provider', FILE)
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)


def core():
    return {'schema_version': '1.0', 'result': 'passed', 'target': M.TARGET, 'origin': M.HOST,
            'web_project_id': M.WEB_PROJECT, 'web_deployment_id': 'dpl_SYNTHETIC12345',
            'acting_user_id': '11111111-1111-4111-8111-111111111111',
            'core_checks': dict.fromkeys(M.CORE_CHECKS, 'passed'),
            'evidence_receipts': ['tracking/evidence/m07/controlled-pilot/SYNTHETIC-core.json']}


def before():
    selected = dict(M.DESIRED)
    selected.update(site_url='http://localhost:3000', oauth_server_enabled=False,
                    oauth_server_authorization_path=None, oauth_server_allow_dynamic_registration=None,
                    hook_custom_access_token_enabled=False, hook_custom_access_token_uri=None)
    return {'selected': selected, 'other_remote': {M.REDIRECT_PATH: list(M.REDIRECTS), ('auth', 'jwt_expiry'): 3600}}


def after():
    value = before(); value['selected'] = dict(M.DESIRED); return value


def diff(state):
    rows = []
    for path, key in M.SELECTED.items():
        old = state['selected'][key]
        if old != M.DESIRED[key]:
            rows.append({'path': list(path), 'class': 'local_only' if old is None else 'update',
                         'declared': True, 'local': M.DESIRED[key], 'remote': old})
    for path, value in state['other_remote'].items():
        rows.append({'path': list(path), 'class': 'remote_only', 'declared': False, 'local': None, 'remote': value})
    return {'target': {'project_ref': M.TARGET}, 'changes': rows}


class IO:
    def __init__(self, states=None):
        self.states = iter(states or [before(), before(), after(), after()])
        self.pushes = 0; self.claims = 0; self.verifies = 0; self.raise_push = False; self.claim_exists = False
    def read(self):
        value = next(self.states)
        if isinstance(value, Exception): raise value
        return copy.deepcopy(value)
    def difference(self): return diff(before())
    def verify(self): self.verifies += 1; return {'public': 'pinned'}
    def claim(self, value):
        self.claims += 1
        if self.claim_exists: raise FileExistsError()
    def push(self):
        self.pushes += 1
        if self.raise_push: raise TimeoutError('SYNTHETIC private diagnostic MUST NOT escape')


class ProviderTests(unittest.TestCase):
    def test_environment_injection_denied_before_core_or_private_access(self):
        for key in ('NODE_OPTIONS','NODE_TLS_REJECT_UNAUTHORIZED','NODE_EXTRA_CA_CERTS','SUPABASE_API_URL',
                    'SSL_CERT_FILE','npm_config_node_options','SUPABASE_WORKDIR'):
            with self.assertRaises(ValueError):M.validate_environment({key:'SYNTHETIC_OVERRIDE'})
        with mock.patch.dict(M.os.environ,{'NODE_OPTIONS':'--require=SYNTHETIC'},clear=True), \
             mock.patch.object(M.sys,'argv',['hosted-provider.py','inspect']), \
             mock.patch.object(M,'inputs',side_effect=AssertionError('core/private access reached')):
            with self.assertRaises(ValueError):M.main()
    def test_core_exact_and_unmodified(self):
        value = core(); original = copy.deepcopy(value); M.validate_core(value); self.assertEqual(value, original)
    def test_core_denials(self):
        for mutate in [lambda v:v.update(result='implemented_unverified'),
                       lambda v:v['core_checks'].update(native_frames='pending'),
                       lambda v:v.update(acting_user_id='00000000-0000-0000-0000-000000000000'),
                       lambda v:v.update(access_token='SYNTHETIC_PRIVATE'),
                       lambda v:v.update(evidence_receipts=['C:/outside.json']),
                       lambda v:v.update(evidence_receipts=['tracking/evidence/m07/controlled-pilot/../outside.json'])]:
            value=core(); mutate(value)
            with self.assertRaises(ValueError): M.validate_core(value)
    def test_exact_disabled_prunes_form_one_auth_patch(self):
        self.assertEqual(M.validate_diff(diff(before()), before()), M.DESIRED)
    def test_enabled_unrelated_hook_denied(self):
        value=after(); value['selected']['hook_custom_access_token_uri']='pg-functions://postgres/public/unrelated'
        with self.assertRaises(ValueError): M.validate_state(value)
    def test_missing_active_child_denied(self):
        for key in ('oauth_server_authorization_path','oauth_server_allow_dynamic_registration','hook_custom_access_token_uri'):
            value=after(); value['selected'][key]=None
            with self.assertRaises(ValueError): M.validate_state(value)
    def test_diff_missing_or_extra_or_unknown_field_denied(self):
        for mutation in ('missing', 'extra', 'prune', 'redirect'):
            value=diff(before())
            if mutation=='missing': value['changes'].pop(0)
            elif mutation=='extra': value['changes'].append({'path':['auth','jwt_expiry'],'class':'update','declared':True,'local':7200,'remote':3600})
            elif mutation=='prune': value['changes'][0]['class']='local_only'
            else:
                next(row for row in value['changes'] if tuple(row['path'])==M.REDIRECT_PATH)['remote'].append('https://unrelated.invalid')
            with self.assertRaises(ValueError): M.validate_diff(value,before())
    def test_already_correct_fields_do_not_get_toggled_for_diff(self):
        value=after(); value['selected']['site_url']='http://localhost:3000'
        self.assertEqual(M.validate_diff(diff(value),value),{'site_url':M.HOST})
    def test_unknown_push_uses_two_readbacks_without_retry(self):
        io=IO();io.raise_push=True;report=M.apply_once(io)
        self.assertEqual((io.pushes,io.claims),(1,1));self.assertEqual(report['result'],'passed')
        self.assertEqual(report['push_outcome'],'unknown');self.assertNotIn('diagnostic',str(report))
    def test_cli_process_timeout_cannot_pass_even_when_both_readbacks_match(self):
        io=IO()
        def push():
            io.pushes+=1;M.cli('push',Path('SYNTHETIC'))
        io.push=push
        with mock.patch.dict(M.os.environ,{},clear=True), \
             mock.patch.object(M.subprocess,'run',side_effect=M.subprocess.TimeoutExpired(['npx.cmd'],60)):
            report=M.apply_once(io)
        self.assertEqual(io.pushes,1);self.assertTrue(report['provider_configuration_observed'])
        self.assertTrue(report['process_cleanup_unconfirmed']);self.assertEqual(report['result'],'unconfirmed')
        self.assertFalse(report['application_verified_by_readback']);self.assertTrue(report['claim_retained'])
    def test_first_readback_error_still_attempts_second(self):
        io=IO([before(),before(),ValueError('SYNTHETIC_PRIVATE'),after()]);report=M.apply_once(io)
        self.assertEqual(io.pushes,1);self.assertEqual(report['result'],'unconfirmed')
        self.assertTrue(report['provider_configuration_observed']);self.assertFalse(report['application_verified_by_readback'])
    def test_other_config_drift_is_not_published_or_accepted(self):
        changed=after();changed['other_remote'][('auth','jwt_expiry')]='SYNTHETIC_PRIVATE'
        io=IO([before(),before(),changed,changed]);report=M.apply_once(io)
        self.assertEqual(report['result'],'unconfirmed');self.assertNotIn('SYNTHETIC_PRIVATE',str(report))
    def test_reused_claim_does_not_push_or_claim_baseline_preservation(self):
        io=IO([before(),after(),after()]);io.claim_exists=True;report=M.apply_once(io)
        self.assertEqual(io.pushes,0);self.assertTrue(report['provider_configuration_observed'])
        self.assertEqual(report['result'],'unconfirmed');self.assertFalse(report['original_baseline_available'])
    def test_fresh_pre_dispatch_drift_prevents_push(self):
        changed=before();changed['other_remote'][('auth','jwt_expiry')]=7200
        io=IO([before(),changed])
        with self.assertRaises(ValueError): M.apply_once(io)
        self.assertEqual(io.pushes,0);self.assertEqual(io.claims,1)
    def test_readback_only_cannot_credit_lost_baseline(self):
        io=IO([after(),after()]);report=M.readback_only(io)
        self.assertEqual(report['result'],'unconfirmed');self.assertTrue(report['provider_configuration_observed'])
        self.assertFalse(report['original_baseline_available']);self.assertEqual(io.pushes,0)
    def test_final_source_failure_cannot_report_preservation(self):
        io=IO();report={'result':'passed','application_verified_by_readback':True}
        M.final_source_check(io,report);self.assertTrue(report['repository_link_and_config_preserved'])
        def fail():raise ValueError('SYNTHETIC_PRIVATE')
        io.verify=fail;M.final_source_check(io,report)
        self.assertFalse(report['repository_link_and_config_preserved']);self.assertEqual(report['result'],'unconfirmed')
        self.assertNotIn('SYNTHETIC_PRIVATE',str(report))
    def test_complementary_pulls_require_explicit_active_six(self):
        rows=[]
        for path,key in M.SELECTED.items():rows.append({'path':list(path),'remote':M.DESIRED[key],'written':False})
        rows.append({'path':list(M.REDIRECT_PATH),'remote':list(M.REDIRECTS),'written':False})
        values=[{'target':{'project_ref':M.TARGET},'dry_run':True,'wrote':False,'changes':copy.deepcopy(rows)} for _ in range(3)]
        self.assertEqual(M.parse_reads(values)['selected'],M.DESIRED)
        for value in values:value['changes']=[row for row in value['changes'] if row['path']!=['auth','site_url']]
        with self.assertRaises(ValueError): M.parse_reads(values)
    def test_conflicting_or_missing_nonselected_inventory_denied(self):
        rows=[{'path':list(path),'remote':value,'written':False} for path,value in
              [(path,M.DESIRED[key]) for path,key in M.SELECTED.items()]]
        rows.append({'path':list(M.REDIRECT_PATH),'remote':list(M.REDIRECTS),'written':False})
        values=[{'target':{'project_ref':M.TARGET},'dry_run':True,'wrote':False,'changes':copy.deepcopy(rows)} for _ in range(3)]
        values[1]['changes'].append({'path':['auth','jwt_expiry'],'remote':7200,'written':False})
        with self.assertRaises(ValueError): M.parse_reads(values)


if __name__=='__main__': unittest.main()
