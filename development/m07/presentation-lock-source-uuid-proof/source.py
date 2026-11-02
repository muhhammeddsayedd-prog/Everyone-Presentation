"""Finite continuation: carry completed edge/FK; unchanged RC functions only."""
from pathlib import Path
import hashlib
import importlib.util
import re

HERE = Path(__file__).resolve().parent
OLD = HERE.parent / 'presentation-lock-source-edge-rls-proof'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('UUID_PROOF_SOURCE_UNCONFIRMED')


def original():
    need(sha((OLD / 'source.py').read_bytes()) == '94926dbff61a32458434cd700fc203ca427d6f029dba1478fbd2f57c0607979a')
    spec = importlib.util.spec_from_file_location('uuid_frozen_edge_source', OLD / 'source.py')
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def project_cases():
    before, _ = original().project_cases()
    a = ' await edgeCounterfactual(ctx);\n await crossWorkspaceKeys(ctx);'
    b = ' ctx.report.pool_helper_proof.completed_RLS_and_cross_FK_carried_not_replayed=true;'
    need(before.count(a) == 1)
    source = before.replace(a, b)
    need(source.replace(b, a) == before)
    funcs = {}
    for name in ['crossWorkspaceKeys', 'workspaceFenceRace', 'authorityCases']:
        pattern = r'async function ' + name + r'\(ctx\)\{.*?(?=\n(?:async|export) )'
        old = re.search(pattern, before, re.S)[0]
        need(re.search(pattern, source, re.S)[0] == old)
        funcs[name] = sha(old.encode())
    return source, {'inverse_byte_equal': True, 'actual_RC_function_sha256': funcs, 'only_completed_RLS_and_cross_FK_invocations_omitted': True, 'unchanged_fence_pair_query_and_mutation_body': True}


def project_callback(file):
    return original().project_callback(file)


def project_entry():
    old = (OLD / 'entry.mjs').read_text(encoding='utf8')
    need(sha(old.encode()) == '3a372cbdb8f38b87bb86e11ba5d24194de8bb39c5aa08a20fd8b585d0acc1a47')
    source = old.replace('presentation-lock-source-edge-rls-proof', 'presentation-lock-source-uuid-proof').replace('EDGE_RLS_PROOF_', 'UUID_PROOF_')
    a = 'focused same-holder asset RLS oldWHERE/newIDs counterfactual; dated393 partial all12/150+8 and first3RR cases; fresh unchangedRC fence/live-authority/expiry; no generation/provider/production acceptance'
    b = 'canonical-public-UUID-qualified fixture namespace; dated393 and278 completed scopes carried only; fresh unchangedRC workspace-fence/membership/capability/expiry plus restoration; no generation/provider/production acceptance'
    need(source.count(a) == 1)
    return source.replace(a, b)
