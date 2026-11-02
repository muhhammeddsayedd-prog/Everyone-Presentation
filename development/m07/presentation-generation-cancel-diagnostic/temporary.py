"""Instrument only the owned temporary QUERY_CANCELED handler, after failure."""
from pathlib import Path
import hashlib
import importlib.util
import re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OLD = ROOT / 'development/m07/presentation-lock-source-proof/temporary.sql'
OLD_SHA = '6c34eae348be361652b001cc1e14ea5e2d4bca16513eace77777592df924e33c'
DECL = 'v_response jsonb;v_hash text;v_code text;begin'
DECL_NEW = 'v_response jsonb;v_hash text;v_code text;v_cancel_context text;v_cancel_message text;v_cancel_state text;begin'
CATCH = "exception when query_canceled then return jsonb_build_object('ok',false,'code','57014','duration_ms',extract(epoch from(clock_timestamp()-v_started))*1000,'operation',p_operation);"
CATCH_NEW = """exception when query_canceled then
 get stacked diagnostics v_cancel_context=PG_EXCEPTION_CONTEXT,v_cancel_message=MESSAGE_TEXT,v_cancel_state=RETURNED_SQLSTATE;
 return jsonb_build_object('ok',false,'code','57014','duration_ms',extract(epoch from(clock_timestamp()-v_started))*1000,'operation',p_operation,
  '__owned_private_cancel',jsonb_build_object('context',v_cancel_context,'message',v_cancel_message,'sqlstate',v_cancel_state));"""


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def build():
    raw = OLD.read_bytes()
    if sha(raw) != OLD_SHA:
        raise ValueError('CANCEL_DIAGNOSTIC_TEMP_SOURCE_UNCONFIRMED')
    source = raw.decode()
    for a, b in [(DECL, DECL_NEW), (CATCH, CATCH_NEW)]:
        if source.count(a) != 1:
            raise ValueError('CANCEL_DIAGNOSTIC_TEMP_SHAPE_UNCONFIRMED')
        source = source.replace(a, b)
    inverse = source.replace(CATCH_NEW, CATCH).replace(DECL_NEW, DECL)
    assert inverse.encode() == raw
    assert 'track_functions' not in source
    return source, {'original_temp_sha256': OLD_SHA, 'patched_temp_sha256': sha(source.encode()), 'inverse_byte_equal': True, 'only_local_declarations_and_QUERY_CANCELED_capture': True, 'pre_error_application_work_or_bounds_changed': False, 'functionstats_or_session_config_added': False}


def stage_map():
    file = ROOT / 'development/m07/presentation-generation-data-reuse/build.py'
    assert sha(file.read_bytes()) == 'cda17a14ead6d7ee8aa225d04b5026c9998e5fc67efbaf3472bb108e6e3fadbd'
    spec = importlib.util.spec_from_file_location('cancel_diagnostic_fixed_bodies', file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    definition = next(x['after'] for x in module.build() if x['name'] == 'public.eps_generate_version')
    match = re.search(r' AS (\$[a-zA-Z0-9_]*\$)(.*?)\1;$', definition, re.S)
    assert match and sha(match[2].encode()) == 'a5e5c60d3f94d9e05c62fc1cfc76ac4552713000b72b1efe4eac028da15c0d40'
    lines = match[2].splitlines()
    markers = [
        ('source_locking', 'perform eps.presentation_lock_sources('),
        ('post_lock_revision', 'select * into workspace from eps.workspaces where id=series.workspace_id;'),
        ('review_and_fit', 'review:=public.eps_get_workspace_review('),
        ('template_validation', 'select * into template from eps.presentation_templates'),
        ('slide_data_assembly', 'slide_id:=gen_random_uuid();slides:=jsonb_build_array('),
        ('asset_inventory', 'into capture_assets'),
        ('payload_assembly', "snapshot:=jsonb_build_object("),
        ('job_and_version_rows', 'insert into eps.jobs('),
        ('slide_rows', 'for item in select value from jsonb_array_elements(slides)'),
        ('asset_pins', 'for source in select * from unnest(capture_assets)'),
        ('source_companions', 'perform eps.capture_presentation_video_transcripts('),
        ('finalize_and_remember', 'update eps.presentation_series set next_version_number='),
    ]
    result = [{'line': 1, 'stage': 'input_authority_and_series_fence'}]
    for stage, needle in markers:
        found = [i + 1 for i, line in enumerate(lines) if needle in line]
        assert len(found) == 1
        result.append({'line': found[0], 'stage': stage})
    assert [x['line'] for x in result] == sorted(x['line'] for x in result)
    return {'candidate_generate_body_sha256': sha(match[2].encode()), 'line_stages': result}
