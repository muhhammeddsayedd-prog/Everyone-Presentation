"""Finite local NOTICE instrumentation; business SQL and line counts invert exactly."""
from pathlib import Path
import hashlib
import importlib.util
import re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ENTRY_ENABLED = False
CURRENT_DATA = '0dba1d407199191d3bbb4d84ddab94d9f4e33da6a0172738b86133e8c7bf61fd'
CURRENT_GENERATE = 'a5e5c60d3f94d9e05c62fc1cfc76ac4552713000b72b1efe4eac028da15c0d40'
PHASES = [
    'measure_enter', 'gen_enter', 'gen_sources_enter', 'gen_sources_exit',
    'gen_review_enter', 'data_enter', 'data_assignments_enter',
    'data_assignments_exit', 'data_return', 'gen_review_exit',
    'gen_capture_enter', 'gen_capture_exit', 'gen_finalize_enter', 'measure_exit',
]


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('STAGE_DIAGNOSTIC_INSTRUMENTATION_UNCONFIRMED')


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def notice(stage):
    need(stage in PHASES or stage == 'measure_cancel')
    return " raise notice 'EPS_STAGE_V1|%|" + stage + "|%',current_setting('eps.locksource41.run'),extract(epoch from clock_timestamp());"


def data_edits():
    return [
        ('begin\n select * into workspace', 'begin' + notice('data_enter') + '\n select * into workspace'),
        ('    for assignment_row in select * from eps.assignments', '    ' + notice('data_assignments_enter') + 'for assignment_row in select * from eps.assignments'),
        ('    end loop;\n   end if;\n   for assignment in', '    end loop;' + notice('data_assignments_exit') + '\n   end if;\n   for assignment in'),
        (' return jsonb_build_object(', ' ' + notice('data_return') + 'return jsonb_build_object('),
    ]


def generate_edits():
    locks = ' perform eps.presentation_lock_sources(series.workspace_id,series.template_key,series.template_version);'
    review = ' review:=public.eps_get_workspace_review(workspace.id,series.id,null);'
    capture = ' perform eps.capture_presentation_video_transcripts(version_id);'
    finalize = ' update eps.presentation_series set next_version_number='
    return [
        ('input_hash text;begin', 'input_hash text;begin' + notice('gen_enter')),
        (locks, ' ' + notice('gen_sources_enter') + locks.lstrip() + notice('gen_sources_exit')),
        (review, ' ' + notice('gen_review_enter') + review.lstrip() + notice('gen_review_exit')),
        (capture, ' ' + notice('gen_capture_enter') + capture.lstrip() + notice('gen_capture_exit')),
        (finalize, ' ' + notice('gen_finalize_enter') + finalize.lstrip()),
    ]


def transform(body, expected, edits):
    need(sha(body.encode()) == expected)
    before = body
    for a, b in edits:
        need(body.count(a) == 1)
        body = body.replace(a, b, 1)
    inverse = body
    for a, b in reversed(edits):
        need(inverse.count(b) == 1)
        inverse = inverse.replace(b, a, 1)
    need(inverse == before and body.count('\n') == before.count('\n'))
    return body


def build():
    base_file = HERE.parent / 'presentation-generation-data-reuse/build.py'
    candidate_file = HERE.parent / 'presentation-generation-assignment-reuse/candidate.py'
    need(sha(base_file.read_bytes()) == 'cda17a14ead6d7ee8aa225d04b5026c9998e5fc67efbaf3472bb108e6e3fadbd')
    need(sha(candidate_file.read_bytes()) == '0e62792bce8230a9b98bc11f387cf781ddf4095afaa09b37798331809d11c864')
    rows = load('stage_frozen_four_body', base_file).build()
    assignment = load('stage_current_assignment_body', candidate_file).build()
    result = []
    for record in rows:
        current = assignment['after'] if record['name'] == 'eps.review_snapshot_data' else record['after']
        match = re.search(r' AS (\$[a-zA-Z0-9_]*\$)(.*?)\1;$', current, re.S)
        need(match is not None)
        body = match[2]
        if record['name'] == 'eps.review_snapshot_data':
            changed = transform(body, CURRENT_DATA, data_edits())
        elif record['name'] == 'public.eps_generate_version':
            changed = transform(body, CURRENT_GENERATE, generate_edits())
        else:
            changed = body
        after = current[:match.start(2)] + changed + current[match.end(2):]
        result.append({**record, 'current_candidate_body_sha256': sha(body.encode()),
                       'after': after, 'after_body_sha256': sha(changed.encode()),
                       'instrumented': changed != body, 'line_count_equal': True,
                       'business_SQL_inverse_byte_equal': True})
    return result


def temporary():
    file = HERE.parent / 'presentation-generation-cancel-diagnostic/temporary.py'
    need(sha(file.read_bytes()) == 'c1aac88ee826fd7827848fb188f367f1cac7a84a3c7fb12f9243ffb44fe5c9d7')
    # The reviewed original measurement + QUERY_CANCELED-only private context.
    module = load('stage_reviewed_cancel_temporary', file)
    body, proof = module.build()
    call = '  v_response:=public.eps_generate_version(p_series,p_input,p_key);'
    after = '  ' + notice('measure_enter') + call.lstrip() + notice('measure_exit')
    context = ' get stacked diagnostics v_cancel_context=PG_EXCEPTION_CONTEXT,v_cancel_message=MESSAGE_TEXT,v_cancel_state=RETURNED_SQLSTATE;'
    context_after = context + notice('measure_cancel')
    for a, b in [(call, after), (context, context_after)]:
        need(body.count(a) == 1)
        body = body.replace(a, b, 1)
    inverse = body.replace(context_after, context, 1).replace(after, call, 1)
    original, _ = module.build()
    need(inverse == original and body.count('\n') == original.count('\n'))
    return body, {'reviewed_context_projection': proof, 'reviewed_cancel_temporary_sha256': sha(original.encode()),
                  'phase_temporary_sha256': sha(body.encode()),
                  'only_fixed_measurement_enter_exit_cancel_notices_added': True,
                  'phase_inverse_byte_equal': True,
                  'business_queries_auth_and_bounds_unchanged': True,
                  'diagnostic_record_overhead_present': True}


def stage_map():
    file = HERE.parent / 'presentation-generation-cancel-diagnostic/temporary.py'
    need(sha(file.read_bytes()) == 'c1aac88ee826fd7827848fb188f367f1cac7a84a3c7fb12f9243ffb44fe5c9d7')
    original = load('stage_reviewed_coarse_map', file).stage_map()
    after = next(x for x in build() if x['name'] == 'public.eps_generate_version')
    return {**original, 'candidate_generate_body_sha256': after['after_body_sha256']}


def session_source():
    file = HERE.parent / 'presentation-lock-source-proof/session.mjs'
    raw = file.read_bytes()
    need(sha(raw) == 'ddb76b4db7bb578c2dfa2896fd59451037679c9a5fc2777a13412765c296e252')
    source = raw.decode()
    edits = [
        ("import { setTimeout,clearTimeout } from 'node:timers';", "import { setTimeout,clearTimeout } from 'node:timers';\nimport {projectStageLines}from './markers.mjs';"),
        ('const value={request,application,done,get pid()', 'const value={request,application,done,stageRecords:()=>projectStageLines(stderr,ctx.runId),get pid()'),
    ]
    for a, b in edits:
        need(source.count(a) == 1)
        source = source.replace(a, b, 1)
    inverse = source
    for a, b in reversed(edits):
        need(inverse.count(b) == 1)
        inverse = inverse.replace(b, a, 1)
    need(inverse.encode() == raw)
    return source


if __name__ == '__main__':
    raise SystemExit('STAGE_DIAGNOSTIC_ASSEMBLY_DISABLED')
