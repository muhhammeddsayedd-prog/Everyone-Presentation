"""ID-only raw companion INSERT candidate; no database/process/provider transport."""
from pathlib import Path
import hashlib
import importlib.util
import re

HERE = Path(__file__).resolve().parent
BASE = HERE.parent / 'presentation-generation-data-reuse/build.py'
BASE_SHA = 'cda17a14ead6d7ee8aa225d04b5026c9998e5fc67efbaf3472bb108e6e3fadbd'
BEFORE_BODY_SHA = 'afe33691e2bb1dad42999b49c8c5ba9d583d68bfc6cced60bfbea0adadc37dd7'
AFTER_BODY_SHA = 'f2229b303a83d7c9ca053e3c0f7e65ec3472b0cbe3b624aad4ff1a1e4af1c4d5'
ENTRY_ENABLED = False
DECLARATION = "capture_slide_media_ids text[]:='{}'::text[];"
BATCH_DECLARATION = DECLARATION + "capture_video_ids uuid[]:='{}'::uuid[];capture_media_ids uuid[]:='{}'::uuid[];capture_inserted integer:=0;"
OLD_INSERT = """  insert into eps.presentation_video_transcripts(version_id,video_asset_id,candidate_media_id,source_media_row_version,status,original_text,source_sha256,languages,captured_at)
   values(version.id,pin.asset_id,media.id,media.row_version,value_status,value_text,value_hash,value_languages,version.created_at);"""
ID_APPEND = """  capture_video_ids:=array_append(capture_video_ids,pin.asset_id);
  capture_media_ids:=array_append(capture_media_ids,media.id);"""
ABSENT = "m.original_transcript is null or m.original_transcript!~U&'[^\\0009\\000A\\000D\\0020\\00A0\\1680\\2000-\\200A\\2028\\2029\\202F\\205F\\3000\\FEFF]'"
INSERT = """  insert into eps.presentation_video_transcripts(version_id,video_asset_id,candidate_media_id,source_media_row_version,status,original_text,source_sha256,languages,captured_at)
   select version.id,d.video_asset_id,m.id,m.row_version,
    case when ABSENT then 'not_provided'else 'available'end,
    case when ABSENT then null else m.original_transcript end,
    case when ABSENT then null else encode(sha256(convert_to(m.original_transcript,'UTF8')),'hex')end,
    case when ABSENT then '{}'::text[]else m.languages end,version.created_at
   from unnest(capture_video_ids,capture_media_ids)with ordinality d(video_asset_id,candidate_media_id,ordinal)
   join eps.candidate_media m on m.id=d.candidate_media_id and m.source_asset_id=d.video_asset_id order by d.ordinal;""".replace('ABSENT', ABSENT)
COUNT_ANCHOR = " if captured<>(select count(*)from eps.presentation_version_assets where version_id=version.id and asset_kind='candidate_video')"
FRESH_SCOPE = """ if not eps.presentation_scope(version.workspace_id,true)
 then perform eps.fail('IMMUTABLE_VERSION','Source companions are captured only by a fresh authorized generation.',409);end if;"""
BATCH = """ if captured>0 then
INSERT
  get diagnostics capture_inserted=row_count;
 end if;
FRESH
 if capture_inserted<>captured then perform eps.fail('SNAPSHOT_INVALID','The selected source transcript capture is incomplete.',503);end if;
""".replace('INSERT', INSERT).replace('FRESH', FRESH_SCOPE) + COUNT_ANCHOR
EDITS = [(DECLARATION, BATCH_DECLARATION), (OLD_INSERT, ID_APPEND), (COUNT_ANCHOR, BATCH)]


def need(ok):
    if not ok:
        raise ValueError('RAW_COMPANION_BATCH_SOURCE_UNCONFIRMED')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def parts(definition):
    found = re.search(r' AS (\$[a-zA-Z0-9_]*\$)(.*?)\1;$', definition, re.S)
    need(found is not None)
    return found


def baseline():
    info = BASE.lstat()
    need(BASE.is_file() and not BASE.is_symlink() and info.st_nlink == 1 and sha(BASE.read_bytes()) == BASE_SHA)
    spec = importlib.util.spec_from_file_location('raw_batch_current_four_source', BASE)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    definition = next(x for x in value.build() if x['name'] == 'eps.capture_presentation_video_transcripts')['after']
    need(sha(parts(definition)[2].encode()) == BEFORE_BODY_SHA)
    return definition


def inverse(body):
    for a, b in reversed(EDITS):
        need(body.count(b) == 1)
        body = body.replace(b, a, 1)
    need(sha(body.encode()) == BEFORE_BODY_SHA)
    return body


def patch_body(body):
    need(sha(body.encode()) == BEFORE_BODY_SHA)
    before = body
    for a, b in EDITS:
        need(body.count(a) == 1)
        body = body.replace(a, b, 1)
    need(inverse(body) == before and sha(body.encode()) == AFTER_BODY_SHA)
    return body


def build():
    before = baseline()
    match = parts(before)
    body = patch_body(match[2])
    after = before[:match.start(2)] + body + before[match.end(2):]
    need(after[:match.start(2)] == before[:match.start(2)] and after.endswith(before[match.end(2):]))
    return {'name': 'eps.capture_presentation_video_transcripts', 'before': before, 'after': after,
            'before_body_sha256': BEFORE_BODY_SHA, 'after_body_sha256': sha(body.encode()),
            'before_definition_sha256': sha(before.encode()), 'after_definition_sha256': sha(after.encode()),
            'finite_inverse_byte_equal': True, 'only_private_ID_arrays_no_text_row_cache': True,
            'fresh_return_scope_intentionally_strengthened': True,
            'error_and_statement_visibility_timing_not_claimed_identical': True,
            'function_authority_policy_clock_and_time_limit_unchanged': True}


if __name__ == '__main__':
    need(ENTRY_ENABLED)
