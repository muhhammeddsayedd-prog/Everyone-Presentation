"""Finite slide INSERT source candidate; no database or process transport."""
from pathlib import Path
import hashlib
import importlib.util
import re

HERE = Path(__file__).resolve().parent
BASE_SHA = 'e6c41fb88f2d665c9b1b41982915339dc598f75dc2e90ff50e745ea63faa8d5a'
BEFORE_BODY_SHA = '41fe515f53fdc411b7fc2485c402d9d06241f8e23b7224aaaea3d5330544bf7d'
AFTER_BODY_SHA = 'af486a7217ed5ddafea5d98dc2979d928a8e9ba675862ef0960c2930b362b198'
ENTRY_ENABLED = False
OLD = """ for item in select value from jsonb_array_elements(slides)loop
  insert into eps.version_slides(id,version_id,ordinal,kind,source_assignment_id,source_slot_id,snapshot,content_sha256)values((item->>'id')::uuid,version_id,(item->>'order')::integer,item->>'kind',(item->>'assignment_id')::uuid,(item->>'slot_id')::uuid,item,eps.presentation_hash(item));
 end loop;"""
NEW = """ if coalesce(jsonb_array_length(slides),0)>0 then
  insert into eps.version_slides(id,version_id,ordinal,kind,source_assignment_id,source_slot_id,snapshot,content_sha256)select(s.item->>'id')::uuid,version_id,(s.item->>'order')::integer,s.item->>'kind',(s.item->>'assignment_id')::uuid,(s.item->>'slot_id')::uuid,s.item,eps.presentation_hash(s.item)from jsonb_array_elements(slides)with ordinality s(item,slide_position)order by s.slide_position;
 end if;"""


def need(ok):
    if not ok:
        raise ValueError('SLIDE_INSERT_BATCH_SOURCE_UNCONFIRMED')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def parts(definition):
    match = re.search(r' AS (\$[a-zA-Z0-9_]*\$)(.*?)\1;$', definition, re.S)
    need(match is not None)
    return match


def baseline(source_root=None):
    # The optional checkout root is only an offline source-assembly seam. The
    # fixed predecessor path/raw SHA and its own frozen source chain still bind.
    root = Path(source_root) if source_root is not None else HERE.parents[2]
    path = root / 'development/m07/presentation-asset-pin-batch/candidate.py'
    info = path.lstat()
    need(path.is_file() and not path.is_symlink() and info.st_nlink == 1 and sha(path.read_bytes()) == BASE_SHA)
    spec = importlib.util.spec_from_file_location('slide_batch_frozen_pin_candidate', path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    definition = value.build()['after']
    need(sha(parts(definition)[2].encode()) == BEFORE_BODY_SHA)
    return definition


def patch_body(body):
    need(sha(body.encode()) == BEFORE_BODY_SHA and body.count(OLD) == 1 and NEW not in body)
    result = body.replace(OLD, NEW, 1)
    need(sha(result.encode()) == AFTER_BODY_SHA and result.replace(NEW, OLD, 1) == body)
    need(result.count('\n') == body.count('\n'))
    return result


def unpatch_body(body):
    need(sha(body.encode()) == AFTER_BODY_SHA and body.count(NEW) == 1 and OLD not in body)
    result = body.replace(NEW, OLD, 1)
    need(sha(result.encode()) == BEFORE_BODY_SHA)
    return result


def build(source_root=None):
    before = baseline(source_root)
    match = parts(before)
    after = before[:match.start(2)] + patch_body(match[2]) + before[match.end(2):]
    need(after.replace(NEW, OLD, 1) == before)
    return {'name': 'public.eps_generate_version', 'before': before, 'after': after,
            'before_body_sha256': BEFORE_BODY_SHA, 'after_body_sha256': AFTER_BODY_SHA,
            'before_definition_sha256': sha(before.encode()), 'after_definition_sha256': sha(after.encode()),
            'one_block_inverse_byte_equal': True, 'same_line_count': True,
            'no_authority_cache_policy_mode_or_timeout_change': True}


if __name__ == '__main__':
    need(ENTRY_ENABLED)
