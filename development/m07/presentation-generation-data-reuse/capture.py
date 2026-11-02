"""Finite body-only private source materialization. No SQL/file/provider transport."""
import hashlib

GENERATE_SHA = 'b20fef7adc8dee0da91db1508b30d4116855bb3e9be9e881072a7e8d55fcee08'
RAW_SHA = 'ed4a3469971fa410078b546b13aa0a875b4867efdda4b134dc729563dd887187'


def need(value):
    if not value:
        raise ValueError('GENERATION_CAPTURE_REUSE_UNCONFIRMED')


def sha(body):
    return hashlib.sha256(body.encode()).hexdigest()


ASSET_PREDICATE = "a.id=any(assets)and a.status='ready'and a.sha256 is not null and a.size_bytes>0 and a.purpose in('client_logo','candidate_frame','candidate_video')and a.bucket in('eps-brand-assets','eps-candidate-assets','eps-candidate-outputs')"
INVENTORY_FIELDS = "jsonb_build_object('asset_id',a.id,'sha256',a.sha256,'asset_kind',a.purpose,'mime_type',a.mime_type,'byte_size',a.size_bytes,'bucket',a.bucket,'object_key',a.object_key,'width',a.width,'height',a.height,'duration_ms',a.duration_ms,'source_asset_id',a.source_asset_id,'timestamp_ms',a.source_timestamp_ms)"
INVENTORY_SELECT = " select coalesce(jsonb_agg(" + INVENTORY_FIELDS + "order by a.id),'[]'::jsonb)into inventory\n"
INVENTORY_OLD = INVENTORY_SELECT + ' from eps.media_assets a where ' + ASSET_PREDICATE + ';'
INVENTORY_NEW = " select coalesce(array_agg(a order by a.id),'{}'::eps.media_assets[])into capture_assets\n" + ' from eps.media_assets a where ' + ASSET_PREDICATE + ';\n' + INVENTORY_SELECT + ' from unnest(capture_assets)a;'

GENERATE_EDITS = (
    ('assets uuid[];source eps.media_assets;item jsonb;', "assets uuid[];capture_assets eps.media_assets[]:='{}'::eps.media_assets[];source eps.media_assets;item jsonb;"),
    (INVENTORY_OLD, INVENTORY_NEW),
    (' for source in select * from eps.media_assets where id=any(assets)order by id loop',
     ' for source in select * from unnest(capture_assets)order by id loop'),
)

RAW_DECLARE = 'value_languages text[];captured integer:=0;prior_context text;'
RAW_DECLARE_NEW = RAW_DECLARE + "capture_slide_video_ids text[]:='{}'::text[];capture_slide_media_ids text[]:='{}'::text[];"
RAW_CONTEXT = " perform set_config('eps.presentation.transcript_capture_version',version.id::text,true);"
RAW_PRELOAD = """
 if exists(select 1 from eps.presentation_version_assets p where p.version_id=version.id and p.asset_kind='candidate_video')then
  select coalesce(array_agg(d.snapshot->>'video_asset_id'order by d.ordinal,d.id),'{}'::text[]),
   coalesce(array_agg(d.snapshot->>'candidate_media_id'order by d.ordinal,d.id),'{}'::text[])
  into capture_slide_video_ids,capture_slide_media_ids
  from eps.version_slides d where d.version_id=version.id and d.kind='candidate';
 end if;"""
RAW_ASSOCIATION_OLD = """  select array_agg(distinct(d.snapshot->>'candidate_media_id')::uuid)into source_ids from eps.version_slides d
   where d.version_id=version.id and d.kind='candidate'and d.snapshot->>'video_asset_id'=pin.asset_id::text and d.snapshot->>'candidate_media_id'is not null;"""
RAW_ASSOCIATION_NEW = """  select array_agg(distinct(d.candidate_media_id)::uuid)into source_ids from unnest(capture_slide_video_ids,capture_slide_media_ids)d(video_asset_id,candidate_media_id)
   where d.video_asset_id=pin.asset_id::text and d.candidate_media_id is not null;"""
RAW_EDITS = (
    (RAW_DECLARE, RAW_DECLARE_NEW),
    (RAW_CONTEXT, RAW_CONTEXT + RAW_PRELOAD),
    (RAW_ASSOCIATION_OLD, RAW_ASSOCIATION_NEW),
)


def replace_once(text, before, after):
    need(text.count(before) == 1)
    return text.replace(before, after)


def patch(body, expected, edits):
    need(type(body) is str and sha(body) == expected)
    result = body
    for before, after in edits:
        result = replace_once(result, before, after)
    inverse = result
    for before, after in reversed(edits):
        inverse = replace_once(inverse, after, before)
    need(inverse == body)
    return result


def unpatch(body, expected, edits):
    result = body
    for before, after in reversed(edits):
        result = replace_once(result, after, before)
    need(sha(result) == expected)
    return result


def patch_generate_body(body: str) -> str:
    # The original distinct asset set/page limits bound this private typed array.
    # Its full records never enter the public inventory or immutable snapshot.
    return patch(body, GENERATE_SHA, GENERATE_EDITS)


def patch_raw_body(body: str) -> str:
    # Text-only paired arrays defer every UUID cast to the original per-pin step.
    return patch(body, RAW_SHA, RAW_EDITS)


def unpatch_generate_body(body: str) -> str:
    return unpatch(body, GENERATE_SHA, GENERATE_EDITS)


def unpatch_raw_body(body: str) -> str:
    return unpatch(body, RAW_SHA, RAW_EDITS)
