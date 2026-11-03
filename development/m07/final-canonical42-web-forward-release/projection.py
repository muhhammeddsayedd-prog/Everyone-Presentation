"""Fresh quality-unbound web purpose; actual42 bindings, frozen CLI mechanics."""
from pathlib import Path
import copy
import datetime
import hashlib
import importlib.util
import json
import re
import types

MAIN = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
HERE = Path(__file__).resolve().parent
PREDECESSOR = MAIN / 'development/m07/mcp-logo-text-web-forward-release'
NAMESPACE = 'final-canonical42-web-forward-release'
APPROVED = {
    'gates.py': '8cd42e026b46a9f45bfa106052a15bedc5308413b11c5e40dbd8f7a13bec6e56',
    'inputs.template.json': '431246c7f60779217dc9222713b3009a039228337f86ff04ce0d68241cf6271c',
    'preflight.py': 'ddcbb7674d36a58c60a31548d7243644f404c506b44e6771b630092c29783f72',
    'projection.py': '99eb139094a34f24fb65894d6a037c183763641103eb52bb70badbf0dca72002',
    'README.md': 'af3caf5bd736e18cada9cbf1298288241faa099de1d6e34139e2febcdcca350f',
    'release.py': '10ced7245bc58085f4ef7006714af0ef5538a17e737d66acecdd11929f427f86',
    'scan-stage.mjs': 'babaec86e121ca6ae8c9609552ea45074a267826ab41913025c31581cafc6670',
    'stage.py': '71902e53a30d7f0c9dc9191ec5fa6771a04bca76ac2cd9ca613f9616493253a9',
    'test_release.py': '7cc658f6714ac30ff18d946d8c5a76e74a2b4bdada916302ea58daabd6d4bb1d',
}
CONTEXT = MAIN / 'development/m07/presentation-generation-compact-release/state.py'
CONTEXT_SHA = '2cda8d4cdb34fec14be322713e978be71ecbbc13d1d14c667568d4770092b5b4'
# Root supplies exact final Main quality after owner results, before arming.
TESTED = None
QUALITY = None
MIN_TESTS = None
CANONICAL42 = {
    'ref': {'path': 'tracking/evidence/m07/presentation-generation-compact-release/2026-11-03T13-18-27-651163Z-apply.json', 'sha256': '43ad177660d5951e32d9549394cac6265ae8c97014861585d25535724c220301'},
    'proof': {'path': 'tracking/evidence/m07/presentation-generation-compact-collector-proof/2026-11-03T13-08-43.574Z-144d063a.json', 'sha256': 'ef98a232507f809a80faaa82f0942d445f8bc2468d7364168a94eedc6aa8e446'},
    'checkpoint': {'path': '.local/presentation-generation-compact-release/2244e718-fe3a-415f-b85a-b5cbfad5cb99/after-checkpoint.json', 'sha256': '69a70cc1074640742436869c0570d48264d4025c7a8862195a813cbe30b55ad7', 'history_path': ['state', 'history', 'versions'], 'tables': 76, 'scope': 'after_apply', 'restore_verified': False},
}
BASELINE = {'path': 'tracking/evidence/m07/mcp-logo-text-web-forward-release/2026-11-03T03-33-59-832114Z-cfd646be-5d85-4ff3-95f2-15259aa94afd-readback.json', 'sha256': '53a77277d96ca926b3cd7e23dbe9776270af0ef513110b08e15e51ae57da053d'}
BASE_DEPLOYMENT = 'dpl_Gp3KFYuNET9hTJeGngNKs7xGmoYu'
BASE_COMMIT = 'e259b81cd96e49e95004d9847384773f544c3d62'
BASE_MANIFEST = 'f8521eb97165f66ebb0c2e6096849fd6fa211182c2a9808187c5f98521753999'


def need(ok):
    if not ok:
        raise ValueError('FINAL_CANONICAL42_WEB_UNCONFIRMED')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def load(file):
    stat = file.lstat()
    need(file.is_file() and not file.is_symlink() and file.resolve() == file and stat.st_nlink == 1 and 0 < stat.st_size <= 16 * 1024**2)
    return file.read_bytes()


def frozen():
    for name, digest in APPROVED.items():
        need(sha(load(PREDECESSOR / name)) == digest)


frozen()
_spec = importlib.util.spec_from_file_location('final42_frozen_web_projection', PREDECESSOR / 'projection.py')
previous = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(previous)
PINS, FROZEN, OLD = previous.PINS, previous.FROZEN, previous.OLD
APPROVED_PREDECESSOR = previous.APPROVED_PREDECESSOR
NATIVE, WORKER = previous.NATIVE, copy.deepcopy(previous.WORKER)
worker_anchor, worker_projection = previous.worker_anchor, previous.worker_projection


def ready():
    need(type(TESTED) is str and re.fullmatch('[a-f0-9]{40}', TESTED) is not None)
    need(type(QUALITY) is dict and set(QUALITY) == {'path', 'sha256'} and type(MIN_TESTS) is int and MIN_TESTS >= 1023)
    need(type(CANONICAL42) is dict and set(CANONICAL42) == {'ref', 'proof', 'checkpoint'})
    need(isinstance(CONTEXT, Path) and CONTEXT.is_relative_to(MAIN / 'development/m07') and CONTEXT.name == 'state.py' and type(CONTEXT_SHA) is str and re.fullmatch('[a-f0-9]{64}', CONTEXT_SHA) is not None)
    return True


def context():
    ready()
    need(sha(load(CONTEXT)) == CONTEXT_SHA)
    spec = importlib.util.spec_from_file_location('final42_pinned_read_only_Context', CONTEXT)
    state = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(state)
    value = state.Context(root=MAIN, source=MAIN)
    value.require_ready()
    need(value.version() == '20261103104337' and len(value.targets) == 7 and len(value.tables) == 76)
    return value


def stable_scope(value):
    # Business rows may grow after the apply. Full target attributes, all-function
    # catalogue/dependency scope, exact history and fixed functions must not.
    scope = {key: value[key] for key in ('history', 'targets', 'fixed_functions', 'full_scope')}
    scope['processing_config'] = value['canonical41']['compatibility']['schema40']['canonical']['processing_config']
    return scope


def canonical(g, root, key, ref, private_verify):
    ready()
    need(key == 'schema42' and ref == CANONICAL42['ref'])
    value = g.reference(root, ref)
    need(value['result'] == 'passed' and value['target'] == g.TARGET and value['version'] == '20261103104337')
    need(value['migration_sha256'] == '685010d2130a83cf4fcd8f11184b4faf1384d1ddc34436d33d458d8987744b78')
    need(value['normal_return_marker_observed'] is True and value['two_independent_readbacks_equal'] is True and value['first'] == value['second'])
    need(value['admission']['collector_validation'] == CANONICAL42['proof'] and value['checkpoint'] == CANONICAL42['checkpoint'])
    proof = g.reference(root, CANONICAL42['proof'])
    need(proof['result'] == 'passed' and proof['collector_validation']['result'] == 'passed')
    need(proof['cloud_called'] is False and proof['provider_called'] is False)
    need(all(proof[k] is True for k in ('all_owned_resources_absent', 'original_data_catalogue_and_global_roles_unchanged', 'shared_lock_released')))
    preservation = value['preservation']
    need(preservation == {'all76_full_rows_including_reason_unchanged': True, 'all_function_metadata_OIDs_ACLs_policies_roles_dependencies_unchanged': True, 'only_exact_seven_prosrc_and_one_history_row_changed': True})
    c = context()
    c.check(value['first'], True)
    history = value['first']['history']['versions']
    need(len(history) == 42 and history[-1] == c.version())
    checkpoint = CANONICAL42['checkpoint']
    need(set(checkpoint) == {'path', 'sha256', 'history_path', 'tables', 'scope', 'restore_verified'} and checkpoint['history_path'] == ['state', 'history', 'versions'] and checkpoint['tables'] == 76 and checkpoint['scope'] == 'after_apply' and checkpoint['restore_verified'] is False)
    relative = Path(checkpoint['path'])
    need(not relative.is_absolute() and '..' not in relative.parts and relative.parts[:1] == ('.local',) and relative.suffix == '.json')
    file = root / relative
    private_verify(file)
    raw = g.load(file)
    need(g.sha(raw) == checkpoint['sha256'])
    payload = json.loads(raw)
    c.checkpoint_check({k: payload[k] for k in ('state', 'application_tables', 'catalogue', 'function_rows', 'history_rows')}, True)
    need(payload['target'] == g.TARGET and payload['state'] == value['first'])
    return {'key': key, 'ref': ref, 'proof': CANONICAL42['proof'], 'checkpoint': checkpoint, 'version': c.version(), 'history': history, 'stable_scope_sha256': g.digest(stable_scope(value['first']))}


def snapshot_projection(g, c, value, approved):
    c.check(value, True)
    need(g.digest(stable_scope(value)) == approved['stable_scope_sha256'])
    return {'stable_scope_sha256': approved['stable_scope_sha256'], 'state_sha256': g.digest(value), 'seven_sources_full_attributes_fixed_functions_catalogue_dependencies_verified': True, 'full76_current_state_checked': True}


def preflight_gate(g, root, ref, plan, now, built_at):
    value = g.reference(root, ref)
    need(set(value) == {'schema_version', 'purpose', 'result', 'run_id', 'source_commit', 'source_manifest_sha256', 'target', 'canonical_receipt', 'recovery_checkpoint_sha256', 'observed_at', 'first', 'second', 'two_independent_readbacks_equal', 'cloud_mutations'})
    need(value['schema_version'] == '1.0' and value['purpose'] == 'final_canonical42_web_forward_canonical_preflight' and value['result'] == 'passed' and value['target'] == g.TARGET)
    need(value['run_id'] == plan['run_id'] and value['source_commit'] == plan['gates']['source_commit'] and value['source_manifest_sha256'] == plan['gates']['source_sha256'])
    need(value['canonical_receipt'] == plan['gates']['canonical']['ref'] and value['recovery_checkpoint_sha256'] == plan['gates']['canonical']['checkpoint']['sha256'] and value['two_independent_readbacks_equal'] is True and value['cloud_mutations'] is False and value['first'] == value['second'])
    observed, built = datetime.datetime.fromisoformat(value['observed_at']), datetime.datetime.fromisoformat(built_at)
    need(observed.tzinfo is not None and built.tzinfo is not None and now.tzinfo is not None and built < observed and -60 <= (now - observed).total_seconds() <= 900)
    current = value['first']
    need(set(current) == {'history', 'gates', 'native_image_id', 'english_transcript_version', 'lifecycle', 'worker', 'canonical42'})
    need(current['history'] == plan['gates']['canonical']['history'] and current['native_image_id'] == NATIVE and current['english_transcript_version'] == '1.0' and current['worker'] == WORKER)
    need(set(current['gates']) == {'specs', 'candidates', 'support', 'frames', 'presentations'} and all(x is True for x in current['gates'].values()))
    need(set(current['lifecycle']) == {'queued', 'running', 'waiting_for_input', 'generic_retry_lifecycle', 'presentation_retry_lifecycle', 'pending_outbox', 'leased_outbox'} and all(type(x) is int and x == 0 for x in current['lifecycle'].values()))
    scope = current['canonical42']
    need(set(scope) == {'stable_scope_sha256', 'state_sha256', 'seven_sources_full_attributes_fixed_functions_catalogue_dependencies_verified', 'full76_current_state_checked'})
    need(scope['stable_scope_sha256'] == plan['gates']['canonical']['stable_scope_sha256'] and re.fullmatch('[a-f0-9]{64}', scope['state_sha256']) and scope['seven_sources_full_attributes_fixed_functions_catalogue_dependencies_verified'] is True and scope['full76_current_state_checked'] is True)
    return {'ref': ref, 'run_id': plan['run_id'], 'observed_at': value['observed_at'], 'after_local_build': True, 'exact_history_and_production_gates': True, 'two_independent_readbacks_equal': True}


def project(name):
    frozen()
    before = previous.project(name)
    source, edits = before, []
    def edit(old, new, count=1):
        nonlocal source
        need(old != new and source.count(old) == count and new not in source)
        source = source.replace(old, new)
        edits.append((old, new, count))
    def assignment(key, value):
        old = re.search('^' + key + r'=.*$', source, re.M)
        need(old is not None)
        edit(old[0], key + '=' + repr(value))
    for old, new in [('mcp-logo-text-web-forward-release', NAMESPACE), ('MCP_LOGO_TEXT_WEB_FORWARD', 'FINAL_CANONICAL42_WEB_FORWARD'), ('mcp_logo_text_web_forward', 'final_canonical42_web_forward')]:
        if old in source:
            edit(old, new, source.count(old))
    if name == 'gates.py':
        for key, value in [('BASELINE', BASE_DEPLOYMENT), ('BASE_COMMIT', BASE_COMMIT), ('BASE_MANIFEST', BASE_MANIFEST), ('BASELINE_RECEIPT', BASELINE), ('REASON_FILES', set()), ('TESTED_COMMIT', TESTED), ('QUALITY_RECEIPT', QUALITY), ('CANONICAL', {'schema42': CANONICAL42})]:
            assignment(key, value)
        edit("test['tests']>=1023", "test['tests']>=_projection.MIN_TESTS")
        start, end = source.index('def canonical('), source.index('def quality(')
        old = source[start:end]
        edit(old, "def canonical(root,key,ref,private_verify):\n return _projection.canonical(_projection.types.SimpleNamespace(**globals()),root,key,ref,private_verify)\ndef preflight(root,ref,plan,now,built_at):\n return _projection.preflight_gate(_projection.types.SimpleNamespace(**globals()),root,ref,plan,now,built_at)\n")
    if name == 'release.py':
        edit('g.need(RELEASE_ENABLED);self.run_id=', 'g.need(RELEASE_ENABLED);_projection.ready();self.run_id=')
        marker = '  return dict(sorted(pins.items()))'
        edit(marker, "  for name,expected in _projection.APPROVED.items():\n   file='development/m07/mcp-logo-text-web-forward-release/'+name;g.need(g.sha(g.load(self.root/file))==expected);pins[file]=expected\n  context=_projection.context()\n  for file,expected in context.source_pins().items():\n   g.need(g.sha(g.load(Path(file)))==expected);pins[file]=expected\n" + marker)
    inverse = source
    for old, new, count in reversed(edits):
        need(inverse.count(new) == count)
        inverse = inverse.replace(new, old)
    need(inverse == before)
    return source
