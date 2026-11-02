"""Default-off one-fragment data-query candidate; no SQL client or runner."""
from pathlib import Path
import hashlib
import importlib.util
import json

HERE = Path(__file__).resolve().parent
PRIOR = HERE.parent / 'presentation-lock-source-optimization/candidate.py'
PRIOR_SHA = '0639ade8dd50a6f3bb2c95f1739dd52e633af9a1e66d1cd92910f1bc87acbdb7'
BEFORE_BODY_SHA = '1ff8ce429ec61785c1e1037da8de5d2a4b9426789074a64eab0f6f89241c48e4'
ENTRY_ENABLED = False

OLD = """   from eps.workspace_candidates p join eps.assignments a on a.workspace_candidate_id=p.id
   where a.workspace_id=p_workspace and a.archived_at is null"""
NEW = """   from eps.workspace_candidates p
   where p.workspace_id=p_workspace and p.id=any(v_pool_ids)"""


def need(ok):
    if not ok:
        raise ValueError('LOCK_SOURCE_POOL_REUSE_UNCONFIRMED')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def body(definition):
    return definition.split('as $$', 1)[1].rsplit('$$;', 1)[0]


def patch_body(value):
    need(sha(value.encode()) == BEFORE_BODY_SHA and value.count(OLD) == 1)
    result = value.replace(OLD, NEW)
    need(result.replace(NEW, OLD) == value)
    return result


def build():
    need(PRIOR.is_file() and not PRIOR.is_symlink() and PRIOR.stat().st_nlink == 1)
    need(sha(PRIOR.read_bytes()) == PRIOR_SHA)
    spec = importlib.util.spec_from_file_location('pinned_lock1ff_candidate_source', PRIOR)
    prior = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(prior)
    _, before = prior.build()
    original = body(before)
    after = before.replace(original, patch_body(original))
    need(after.replace(NEW, OLD) == before)
    return before, after


if __name__ == '__main__':
    need(ENTRY_ENABLED)
    before, after = build()
    print(json.dumps({'source_only': True, 'SQL_executed': False, 'before_body_sha256': sha(body(before).encode()), 'after_body_sha256': sha(body(after).encode())}))
