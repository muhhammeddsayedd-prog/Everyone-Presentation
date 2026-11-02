"""Same12 original predicates, one bounded relation read per stable snapshot."""
from pathlib import Path
import hashlib
import re

HERE = Path(__file__).resolve().parent
BASE = HERE.parent / 'presentation-lock-source-proof/cohorts.sql'
BASE_SHA = '06d12e3c2b2ca36deb7831579a7ef55ec183cdd77b9e66515b18c3b0bbc953ef'
RELATIONS = ['public.projects', 'public.clients', 'eps.presentation_templates', 'eps.specs', 'eps.roles', 'eps.slots', 'eps.assignments', 'eps.workspace_candidates', 'eps.candidates', 'eps.candidate_media', 'eps.media_assets', 'eps.candidate_media_frames']


def build():
    raw = BASE.read_bytes()
    if hashlib.sha256(raw).hexdigest() != BASE_SHA:
        raise ValueError('POOL_PROOF_ORACLE_SOURCE_UNCONFIRMED')
    text = raw.decode().replace('\r\n', '\n')
    body = text.split("as $$\n", 1)[1].split('\nend$$;', 1)[0]
    begin = body.index(' -- cohort:')
    prefix = body[:begin].replace("v_result jsonb:='[]';", '')
    segments = re.findall(r' -- cohort:([^\n]+)\n(.*?)(?= -- cohort:|\n return v_result;)', body[begin:], re.S)
    if [name for name, _ in segments] != RELATIONS:
        raise ValueError('POOL_PROOF_ORACLE_RELATIONS_UNCONFIRMED')
    statements = []
    for name, chunk in segments:
        statement = chunk[:chunk.index('\n v_result:=')]
        statements.append((name, statement))
    result = "create function pg_temp.pool_proof_cohort(p_relation text,p_workspace uuid,p_series uuid)returns jsonb\nlanguage plpgsql stable security invoker set search_path=''as $$\n" + prefix + '\n case p_relation\n'
    for name, statement in statements:
        result += " when '" + name + "'then\n" + statement + '\n'
    result += " else raise exception'POOL_PROOF_CLOSED_RELATION_REQUIRED'using errcode='22023';\n end case;return v_keys;\nend$$;\n"
    return result, statements
