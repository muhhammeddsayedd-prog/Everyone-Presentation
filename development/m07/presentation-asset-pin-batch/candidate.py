"""One-block data INSERT candidate. No database/process/provider transport."""
from pathlib import Path
import hashlib
import importlib.util
import re

HERE = Path(__file__).resolve().parent
BASE = HERE.parent / 'presentation-generation-data-reuse/build.py'
BASE_SHA = 'cda17a14ead6d7ee8aa225d04b5026c9998e5fc67efbaf3472bb108e6e3fadbd'
BEFORE_BODY_SHA = 'a5e5c60d3f94d9e05c62fc1cfc76ac4552713000b72b1efe4eac028da15c0d40'
AFTER_BODY_SHA = '41fe515f53fdc411b7fc2485c402d9d06241f8e23b7224aaaea3d5330544bf7d'
ENTRY_ENABLED = False
OLD = """ for source in select * from unnest(capture_assets)order by id loop
  insert into eps.presentation_version_assets(version_id,asset_id,asset_kind,bucket,object_key,mime_type,byte_size,sha256,width,height,duration_ms,source_asset_id,timestamp_ms,filename,asset_created_at)
  values(version_id,source.id,source.purpose,source.bucket,source.object_key,source.mime_type,source.size_bytes,source.sha256,source.width,source.height,source.duration_ms,source.source_asset_id,source.source_timestamp_ms,source.filename,source.created_at);
 end loop;"""
NEW = """ if coalesce(cardinality(capture_assets),0)>0 then
  insert into eps.presentation_version_assets(version_id,asset_id,asset_kind,bucket,object_key,mime_type,byte_size,sha256,width,height,duration_ms,source_asset_id,timestamp_ms,filename,asset_created_at)
  select version_id,a.id,a.purpose,a.bucket,a.object_key,a.mime_type,a.size_bytes,a.sha256,a.width,a.height,a.duration_ms,a.source_asset_id,a.source_timestamp_ms,a.filename,a.created_at from unnest(capture_assets)a order by a.id;
 end if;"""


def need(ok):
    if not ok:
        raise ValueError('ASSET_PIN_BATCH_SOURCE_UNCONFIRMED')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def parts(definition):
    found = re.search(r' AS (\$[a-zA-Z0-9_]*\$)(.*?)\1;$', definition, re.S)
    need(found is not None)
    return found


def baseline():
    info = BASE.lstat()
    need(BASE.is_file() and not BASE.is_symlink() and info.st_nlink == 1 and sha(BASE.read_bytes()) == BASE_SHA)
    spec = importlib.util.spec_from_file_location('pin_batch_current_four_source', BASE)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    current = next(x for x in value.build() if x['name'] == 'public.eps_generate_version')['after']
    need(sha(parts(current)[2].encode()) == BEFORE_BODY_SHA)
    return current


def patch_body(value):
    need(sha(value.encode()) == BEFORE_BODY_SHA and value.count(OLD) == 1 and NEW not in value)
    result = value.replace(OLD, NEW, 1)
    need(sha(result.encode()) == AFTER_BODY_SHA and result.replace(NEW, OLD, 1) == value)
    need(result.count('\n') == value.count('\n'))
    return result


def build():
    before = baseline()
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
