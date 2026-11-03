"""Exact two raw CRLF preimages over the sealed seven-target Context."""
from pathlib import Path
import json
import re
import types
import importlib.util

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parents[2]
MAIN = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
PARENT = MAIN / 'development/m07/presentation-generation-canonical-release/state.py'
PARENT_SHA = 'b750905718decdcdaa3d2ab554370fd07e1de49bf5c4e5a9bb88823a566e50aa'


def module(name, file, expected=None):
    file = Path(file)
    stat = file.lstat()
    if not (file.is_file() and not file.is_symlink() and file.resolve() == file and stat.st_nlink == 1 and 0 < stat.st_size <= 16 * 1024**2):
        raise ValueError('GENERATION42_RAW_SOURCE_UNCONFIRMED')
    raw = file.read_bytes()
    if expected is not None:
        import hashlib
        if hashlib.sha256(raw).hexdigest() != expected:
            raise ValueError('GENERATION42_RAW_SOURCE_UNCONFIRMED')
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


parent = module('generation42_frozen_LF_context', PARENT, PARENT_SHA)
for _name in ('TARGET', 'MAXIMUM', 'VERSION', 'MIGRATION', 'MIGRATION_SHA', 'MIGRATION_NAME', 'REMAINING_PROOF_REF', 'REMAINING_AUDIT_REF', 'READY', 'FIXED', 'uuid', 'need', 'sha', 'load', 'literal', 'json_sql', 'digest', 'parts'):
    globals()[_name] = getattr(parent, _name)
RAW = {
    'eps.presentation_lock_sources(uuid,text,text)': ('dc398779de1d2d6d997d4f40fff99b5c840f2c7ca1b780e26ee28027aad83fff', '4107c87b1a51d2c5ed506a64c81378026068406a5136b202779767efb30264e7', 20),
    'eps.review_snapshot(uuid,uuid,text)': ('27a9e0738186c7df7f8df842ccd21a66d3fd84cda5c203e87e87ef2c9efd3d85', 'f0815e014144f1345b4679d96114aab6b358d95df317e3cfe6ac6b59989813cb', 2),
}
TARGETS = tuple((name, RAW[name][0] if name in RAW else before, after, path) for name, before, after, path in parent.TARGETS)
FRESH = {'path': 'tracking/evidence/m07/completion-release/canonical-generation42-preimages-e0515159-b9d7-4460-9bf9-859a31e40b3a.json', 'sha256': 'bd4e8d3943685c9160eb326118da32223de424abe367b5756c4fb6721c7a8e41'}
RETAINED_APPLY = {'path': 'tracking/evidence/m07/logo-info-canonical-alias-release/2026-11-03T05-04-20-894321Z-apply.json', 'sha256': 'df25b8371bf5359e41f30d93164316853e14da1b278c66c62c0a8af1a790cec9'}
RETAINED_CHECKPOINT = {'path': '.local/logo-info-canonical-alias-release/4b2bfc38-0948-4c84-ae42-6ec88b40fd3b/after-checkpoint.json', 'sha256': '900f1bf209cb08f112ac182fae051ccd4ccfdb1406198a20a1ac1b0400d8b79d'}


def raw_manifest():
    rows = parent.manifest()
    raw = load(parent.METADATA)
    need(sha(raw) == parent.METADATA_SHA)
    text = raw.decode('utf8')  # No universal-newline decoding or broad tolerance.
    for signature, (raw_sha, LF_sha, count) in RAW.items():
        name = signature.split('(')[0]
        matches = list(re.finditer(r'CREATE FUNCTION ' + re.escape(name) + r'\([^\n]*\) RETURNS [^\n]+\n.*? AS (\$[a-zA-Z0-9_]*\$).*?\1;', text, re.S))
        need(len(matches) == 1)
        definition = matches[0][0].replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION', 1)
        match = parts(definition)
        body = match[2]
        need(sha(body.encode()) == raw_sha and sha(body.replace('\r\n', '\n').encode()) == LF_sha)
        need(body.count('\r\n') == count and body.count('\r') == count and body.replace('\r\n', '\n') == rows[signature]['before_body'])
        rows[signature].update(before_sha256=raw_sha, before_body=body, before_definition=definition,
                               before_header=definition[:match.start(2)], tested_LF_before_sha256=LF_sha)
    need(sha(('\n\n'.join(row['definition'] for row in rows.values()) + '\n').encode()) == MIGRATION_SHA == '685010d2130a83cf4fcd8f11184b4faf1384d1ddc34436d33d458d8987744b78')
    return rows


def evidence(root=MAIN):
    root = Path(root)
    fresh_raw, retained_raw = load(root / FRESH['path']), load(root / RETAINED_APPLY['path'])
    need(sha(fresh_raw) == FRESH['sha256'] and sha(retained_raw) == RETAINED_APPLY['sha256'])
    fresh, retained = json.loads(fresh_raw), json.loads(retained_raw)
    need(fresh['normal_process_exit'] == 0 and fresh['read_only'] is True and fresh['canonical_change_executed'] is False and fresh['database'] == fresh['operator'] == 'postgres' and fresh['history_count'] == 41)
    need(retained['result'] == 'passed' and retained['normal_return_marker_observed'] is True)
    need({key: retained['checkpoint'][key] for key in ('path', 'sha256')} == RETAINED_CHECKPOINT)
    need(set(fresh['functions']) == {name for name, *_ in TARGETS} | set(FIXED))
    old = parent.manifest()
    for name, row in fresh['functions'].items():
        before = old[name]['before_sha256'] if name in old else FIXED[name]
        raw_expected, LF_expected, count = RAW.get(name, (before, before, 0))
        need(row['raw_source_sha256'] == raw_expected and row['LF_source_sha256'] == LF_expected and row['CRLF_count'] == count)
    return {'fresh_normal_read': FRESH, 'retained_actual_apply': RETAINED_APPLY,
            'retained_actual_after_checkpoint': RETAINED_CHECKPOINT,
            'exact_two_raw_to_tested_LF_relations': {name: {'raw_sha256': raw, 'tested_LF_sha256': LF, 'CRLF_count': n} for name, (raw, LF, n) in RAW.items()},
            'other_five_and_both_fixed_sources_unchanged': True}


class Context(parent.Context):
    def __init__(self, root=MAIN, source=SOURCE):
        super().__init__(root=root, source=source)
        self.targets = raw_manifest()

    def require_ready(self):
        migration = super().require_ready()
        evidence(self.root)
        need(sha(self.definitions_sql().encode()) == MIGRATION_SHA)
        return migration

    def helper_records(self, proof, audit):
        # ec5 actually restored the LF4107 comparison helper. That is retained
        # as LF evidence, never relabeled as restoration of raw canonical dc39.
        view = types.SimpleNamespace(targets=parent.manifest())
        parent.Context.helper_records(view, proof, audit)
        relation = RAW['eps.presentation_lock_sources(uuid,text,text)']
        need(self.targets['eps.presentation_lock_sources(uuid,text,text)']['before_sha256'] == relation[0])
        need(sha(self.targets['eps.presentation_lock_sources(uuid,text,text)']['before_body'].replace('\r\n', '\n').encode()) == relation[1])
        evidence(self.root)
        return True

    def admission(self):
        # All ec5 installations are the sealed LF comparison graph, including
        # wrapperf081. Validate that graph exactly instead of relabeling its
        # preimages as raw canonical bytes or tolerating two hashes in check().
        view = types.SimpleNamespace(root=self.root, targets=parent.manifest(),
                                     require_ready=self.require_ready, helper_records=self.helper_records)
        value = parent.Context.admission(view)
        value['raw_preimage_binding'] = evidence(self.root)
        value['local_performance_restore_is_tested_LF4107_not_raw_dc39'] = True
        value['local_wrapper_restore_is_tested_LFf081_not_raw_27a9'] = True
        value['candidate_seven_definitions_unchanged'] = True
        return value

    def source_pins(self):
        pins = super().source_pins()
        pins[str(PARENT)] = PARENT_SHA
        for reference in (FRESH, RETAINED_APPLY):
            file = self.root / reference['path']
            need(sha(load(file)) == reference['sha256'])
            pins[str(file)] = reference['sha256']
        for file in sorted(HERE.iterdir()):
            if file.is_file():
                pins[str(file)] = sha(load(file))
        return dict(sorted(pins.items()))
