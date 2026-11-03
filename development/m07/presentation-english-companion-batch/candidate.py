"""English INSERT batching candidate; fixed source, ID arrays, no transport/cache."""
from pathlib import Path
import hashlib
import re

HERE=Path(__file__).resolve().parent
METADATA=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio/.local/m07-recovery/639da33a-7e90-4471-b0ec-c7a8ff6097ef/backup/metadata.sql')
METADATA_SHA='12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c'
BEFORE_BODY_SHA='c68de52a4ede0ec6401aa05e0f40b5932905dd8dc8c1c72149c9f95c51a23aeb'
AFTER_BODY_SHA='b763cd502ed70c49f7d9d07106397bd6c774a6c00d87322f7e0954f25f1ac4ad'
ENTRY_ENABLED=False
DECL='captured integer:=0;'
BATCH_DECL=DECL+"capture_video_ids uuid[]:='{}'::uuid[];capture_media_ids uuid[]:='{}'::uuid[];capture_inserted integer:=0;"
OLD_INSERT="""  insert into eps.presentation_video_english_transcripts(version_id,video_asset_id,candidate_media_id,source_media_row_version,status,english_text,source_sha256,english_sha256,captured_at)
   values(p_version,raw.video_asset_id,media.id,raw.source_media_row_version,media.english_transcript_status,media.english_transcript,
    media.english_transcript_source_sha256,case when media.english_transcript_status='available'then encode(sha256(convert_to(media.english_transcript,'UTF8')),'hex')end,version.created_at);"""
APPEND="""  capture_video_ids:=array_append(capture_video_ids,raw.video_asset_id);
  capture_media_ids:=array_append(capture_media_ids,media.id);"""
INSERT="""  insert into eps.presentation_video_english_transcripts(version_id,video_asset_id,candidate_media_id,source_media_row_version,status,english_text,source_sha256,english_sha256,captured_at)
   select p_version,r.video_asset_id,m.id,r.source_media_row_version,m.english_transcript_status,m.english_transcript,
    m.english_transcript_source_sha256,case when m.english_transcript_status='available'then encode(sha256(convert_to(m.english_transcript,'UTF8')),'hex')end,version.created_at
   from unnest(capture_video_ids,capture_media_ids)with ordinality d(video_asset_id,candidate_media_id,ordinal)
   join eps.presentation_video_transcripts r on r.version_id=p_version and r.video_asset_id=d.video_asset_id and r.candidate_media_id=d.candidate_media_id
   join eps.candidate_media m on m.id=d.candidate_media_id and m.source_asset_id=d.video_asset_id order by d.ordinal;"""
COUNT=" if captured<>(select count(*)from eps.presentation_version_assets where version_id=p_version and asset_kind='candidate_video')"
FRESH=""" if not eps.presentation_scope(version.workspace_id,true)
 then perform eps.fail('IMMUTABLE_VERSION','English companions require a fresh authorized generation.',409);end if;"""
BATCH=""" if captured>0 then
INSERT
  get diagnostics capture_inserted=row_count;
 end if;
FRESH
 if capture_inserted<>captured then perform eps.fail('SNAPSHOT_INVALID','English transcript capture is incomplete.',503);end if;
""".replace('INSERT',INSERT).replace('FRESH',FRESH)+COUNT
EDITS=[(DECL,BATCH_DECL),(OLD_INSERT,APPEND),(COUNT,BATCH)]


def sha(raw):return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:raise ValueError('ENGLISH_COMPANION_BATCH_SOURCE_UNCONFIRMED')


def parts(definition):
    found=re.search(r' AS (\$[a-zA-Z0-9_]*\$)(.*?)\1;$',definition,re.S);need(found is not None);return found


def baseline():
    info=METADATA.lstat();need(METADATA.is_file()and not METADATA.is_symlink()and info.st_nlink==1)
    raw=METADATA.read_bytes();need(sha(raw)==METADATA_SHA);text=raw.decode().replace('\r\n','\n')
    found=re.search(r'CREATE FUNCTION eps\.capture_presentation_video_english_transcripts\(p_version uuid\) RETURNS integer\n.*?AS (\$[a-zA-Z0-9_]*\$).*?\1;',text,re.S);need(found is not None)
    definition=found[0].replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION',1);need(sha(parts(definition)[2].encode())==BEFORE_BODY_SHA);return definition


def inverse(body):
    for a,b in reversed(EDITS):need(body.count(b)==1);body=body.replace(b,a,1)
    need(sha(body.encode())==BEFORE_BODY_SHA);return body


def patch_body(body):
    need(sha(body.encode())==BEFORE_BODY_SHA);before=body
    for a,b in EDITS:need(body.count(a)==1);body=body.replace(a,b,1)
    need(inverse(body)==before and sha(body.encode())==AFTER_BODY_SHA);return body


def build():
    before=baseline();match=parts(before);body=patch_body(match[2]);after=before[:match.start(2)]+body+before[match.end(2):]
    return{'name':'eps.capture_presentation_video_english_transcripts','before':before,'after':after,
           'before_body_sha256':BEFORE_BODY_SHA,'after_body_sha256':sha(body.encode()),
           'before_definition_sha256':sha(before.encode()),'after_definition_sha256':sha(after.encode()),
           'three_edit_inverse_byte_equal':True,'original_ordered_RLS_loop_query_unchanged':True,
           'no_private_text_cache_or_new_byte_limit':True,'fresh_return_scope_intentionally_strengthened':True,
           'error_precedence_statement_visibility_and_performance_not_claimed_equal':True}


if __name__=='__main__':need(ENTRY_ENABLED)
