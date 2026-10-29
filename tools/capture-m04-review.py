"""Fixed read-only M04 app observer; root executes after its actual app actions.

Imports do not read configuration, private files or cloud state. This observes
metadata and preservation, not independent speech accuracy or PDF acceptance.
"""
import datetime
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import uuid

from release_foundation import ROOT, TARGET
from release_m04_casting import call as cli_call

SQL = 'tools/sql/m04-review-capture.sql'
SQL_SHA = '8acbd0eb138847f42791c3ca716a7bfc514b34896197694320d73d14d58e20c1'
REGISTRY = 'packages/templates/registry.json'
REGISTRY_SHA = 'a4cee8acd9675c5038517ce48880350c7bd28f9d1971eef55ab846f0996db53d'
VISION = 'tracking/evidence/m03/frame-vision-app/2026-10-29T19-12-45-337511Z-5acae3bc.json'
VISION_SHA = 'd0cacb93b838d32e5b141668cc0182ba7cbd5c5f066322b2f0b1436240a1d6f7'
REVIEWED = 'tracking/evidence/m03/reviewed-source-readback/2026-10-29T20-17-30-125263Z-6afa02e0.json'
REVIEWED_SHA = '51b39670ff6493aa1e6efb1f357484e1083681d38a41e421b3f79e19d7b39a76'
CASTING = 'tracking/evidence/m04/app-capture/2026-10-29T19-16-43-336622Z-5e14943e.json'
CASTING_SHA = '307f6483abf69b53ec7114b5f95a73b8f4190cb63652ac56bf6209d16dad6c44'
SEALS = {
    'tools/release_m04_casting.py': 'ca855cda402566ebe8c6a78174a44dfcc9e878d7f0a320a6b7251a783ade2226',
    'tools/release_foundation.py': '02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751',
    'tools/provision_logo_verifier.py': '660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c',
    'tools/release_m03_remaining.py': '5a608e480c7afb56a1b49c7a683c238d950301c589c1ff91348368f486995b7e',
    'tools/release_specs_read_operation.py': 'a68be68c78bb20b59216e5aabd9b568bb0d46ef9fd35097ceb78392f85ad304e',
}
SCOPES = {
    '098d5b48-42a3-475b-b562-735c9eafce80': '4b70c8ce-18bd-4a8c-b5a9-bc1156c06463',
    'e470aefd-e0f7-480c-bf0d-170cb2cb7069': 'bd14d10f-b1c5-4d6a-8b4d-e5c48208433c',
}
CANDIDATE = '25a3c924-7b6c-48e3-88ce-c72e72b99c6d'
JOB = '9a5ddb61-6a9a-4157-b6be-8653cf2eadef'
MEDIA = 'f5dff77f-092f-4777-9f56-3bbce4dee57c'
ASSET = '5f8a6d53-0da0-4064-aacf-aea6b9c47c81'
WAITER = '6354dd4c-b790-430c-a1b7-40902fa70271'
WAITER_SLOTS = ['2f85b028-3351-4754-821f-468913abfcfc', 'bd424528-8021-49d6-89a5-78babd4d4785', 'c0040718-7083-4010-9a11-5b15e051cbd9']
EVIDENCE = ROOT / 'tracking/evidence/m04/review-app-capture'
APPLICATION_SOURCES = (
    'apps/web/components/WorkspaceReviewView.tsx', 'apps/web/components/RoleEditor.tsx', 'apps/web/components/RoleSlots.tsx',
    'apps/web/components/RetirementUndo.tsx', 'apps/web/components/retirement-undo.ts',
    'apps/worker/src/native-browser.ts', 'apps/worker/src/review-fit.ts', 'apps/worker/src/review-fit-stage-executor.ts',
    'apps/worker/src/review-stage-executor.ts', 'apps/worker/src/runtime.ts', 'apps/worker/src/runtime-main.ts',
    'apps/worker/src/runtime-types.ts', 'apps/worker/src/n8n-orchestrator.ts',
    'packages/integrations/src/openai-wording.ts', 'packages/integrations/src/prompts/wording-v1.ts', 'packages/templates/src/render.ts',
)


def require(value):
    if not value: raise ValueError('M04_REVIEW_APP_CAPTURE_UNCONFIRMED')


def sha(value): return hashlib.sha256(value).hexdigest()
def exact(value, keys): require(type(value) is dict and set(value) == set(keys))


def identifier(value): require(type(value) is str and re.fullmatch('[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', value))
def digest(value): require(type(value) is str and re.fullmatch('[a-f0-9]{64}', value))
def integer(value, minimum=0, maximum=9007199254740991): require(type(value) is int and minimum <= value <= maximum)


def timestamp(value):
    require(type(value) is str and 0 < len(value) <= 50)
    at = datetime.datetime.fromisoformat(value.replace('Z', '+00:00')); require(at.tzinfo is not None); return at


def identifiers(value, maximum=1024):
    require(type(value) is list and len(value) <= maximum and len(value) == len(set(value)))
    for item in value: identifier(item)


def checked(relative):
    from provision_logo_verifier import safe_path
    file = ROOT / relative; safe_path(file); require(file.resolve() == file and not file.is_symlink()); return file


def sealed(relative, expected):
    digest(expected); data = checked(relative).read_bytes(); require(len(data) <= 4 * 1024 * 1024 and sha(data) == expected); return data


def baselines():
    vision = json.loads(sealed(VISION, VISION_SHA)); reviewed = json.loads(sealed(REVIEWED, REVIEWED_SHA)); casting = json.loads(sealed(CASTING, CASTING_SHA))
    require(vision['result'] == reviewed['result'] == casting['result'] == 'captured')
    require(vision['technical_vision_provider_success'] is True and reviewed['confirmation']['candidate_id'] == CANDIDATE
        and reviewed['confirmation']['effective_reviewed'] is True and len(vision['state']['retained_profiles']) == 9)
    registry = json.loads(sealed(REGISTRY, REGISTRY_SHA))
    return {'vision': vision, 'reviewed': reviewed, 'casting': casting, 'registry': registry}


def observed_application_sources():
    result = {}
    for file in APPLICATION_SOURCES:
        data = checked(file).read_bytes(); require(0 < len(data) <= 4 * 1024 * 1024); result[file] = sha(data)
    return result


def inputs():
    # Incomplete projection pins deny access before linked/private configuration.
    sealed(SQL, SQL_SHA)
    for file, expected in SEALS.items(): sealed(file, expected)
    reference = baselines()
    require(checked('supabase/.temp/project-ref').read_text().strip() == TARGET)
    manifest_bytes = checked('development/local-db/reviewed.json').read_bytes(); require(len(manifest_bytes) <= 1024 * 1024)
    manifest = json.loads(manifest_bytes); require(type(manifest.get('migrations')) is list and len(manifest['migrations']) in (22, 23))
    migrations = {}; versions = []
    for row in manifest['migrations']:
        require(type(row) is dict and type(row.get('path')) is str and re.fullmatch('supabase/migrations/[0-9]{14}_[a-z0-9_]+\\.sql', row['path']) and row.get('reviewed_by') and row.get('reviewed_at'))
        sealed(row['path'], row['sha256']); migrations[row['path']] = row['sha256']; versions.append(Path(row['path']).name[:14])
    require(versions == sorted(set(versions)) and versions[:21] == reference['vision']['state']['versions'] and versions[21] == '20261029202629')
    require(sorted(file.name for file in checked('supabase/migrations').glob('*.sql')) == [Path(row['path']).name for row in manifest['migrations']])
    return {'versions': versions, 'manifest_sha256': sha(manifest_bytes), 'migration_seals': migrations,
        'source_seals': {SQL: SQL_SHA, REGISTRY: REGISTRY_SHA, VISION: VISION_SHA, REVIEWED: REVIEWED_SHA, CASTING: CASTING_SHA, **SEALS},
        'observed_application_source_sha256': observed_application_sources(),
        'helper_sha256': sha(Path(__file__).read_bytes())}, reference


def validate(state, reference, versions):
    exact(state, {'observed_at', 'query_role', 'database', 'unrestricted_visibility', 'versions', 'workspaces', 'series', 'reviews', 'jobs', 'suggestions', 'fit_results', 'waiter', 'subject', 'retained_profiles', 'protected_m02', 'assignment_separation'})
    observed = timestamp(state['observed_at'])
    require(state['query_role'] == state['database'] == 'postgres' and state['unrestricted_visibility'] is True)
    require(type(versions) is list and len(versions) in (22, 23) and versions == sorted(set(versions))
        and all(type(version) is str and re.fullmatch('[0-9]{14}', version) for version in versions) and state['versions'] == versions)
    require(versions[:21] == reference['vision']['state']['versions'] and versions[21] == '20261029202629')
    if len(versions) == 23: require(versions[22] == '20261029203953')
    def array(value, keys, maximum=1024, id_field='id'):
        require(type(value) is list and len(value) <= maximum)
        for row in value: exact(row, keys)
        if id_field:
            ids = [row[id_field] for row in value]; identifiers(ids, maximum)
        return value
    def nullable_id(value):
        if value is not None: identifier(value)
    def nullable_digest(value):
        if value is not None: digest(value)
    def boolean(value): require(type(value) is bool)
    def error_code(value): require(value is None or type(value) is str and re.fullmatch('[A-Z][A-Z0-9_]{0,99}', value))
    workspaces = array(state['workspaces'], {'id', 'project_id', 'row_version', 'draft_revision', 'archived'}, 2)
    require({row['id']: row['project_id'] for row in workspaces} == SCOPES)
    for row in workspaces: integer(row['row_version'], 1); integer(row['draft_revision']); require(row['archived'] is False)
    registry = reference['registry']; template_hash = registry['content_sha256']; fonts = {font['path']: font['sha256'] for font in registry['fonts']}
    series = array(state['series'], {'id', 'workspace_id', 'output_type', 'audience_preset_id', 'audience_scope', 'title_sha256', 'audience_sha256', 'template_key', 'template_version', 'template_content_sha256', 'font_key', 'row_version', 'archived'}, 64)
    series_by_id = {row['id']: row for row in series}
    for row in series:
        require(row['workspace_id'] in SCOPES and row['output_type'] in ('selection', 'shortlist') and row['audience_scope'] in ('internal', 'external'))
        identifier(row['audience_preset_id']); digest(row['title_sha256']); digest(row['audience_sha256']); integer(row['row_version'], 1); boolean(row['archived'])
        require((row['template_key'], row['template_version'], row['template_content_sha256'], row['font_key']) == (registry['key'], registry['version'], template_hash, registry['font_key']))
    reviews = array(state['reviews'], {'series_id', 'workspace_id', 'input_fingerprint', 'draft_revision', 'output_type', 'candidate_slide_count', 'pending_slide_count', 'expected_page_count', 'expected_tenfield_rectangle_count', 'total_rectangles_persisted', 'cover_sha256', 'slides'}, 64, 'series_id')
    review_by_id = {row['series_id']: row for row in reviews}
    require(set(review_by_id) == {row['id'] for row in series if not row['archived']})
    for row in reviews:
        context = series_by_id[row['series_id']]; require(row['workspace_id'] == context['workspace_id'] and row['output_type'] == context['output_type'])
        digest(row['input_fingerprint']); digest(row['cover_sha256']); integer(row['draft_revision'])
        require(row['draft_revision'] == next(w['draft_revision'] for w in workspaces if w['id'] == row['workspace_id']))
        for key in ('candidate_slide_count', 'pending_slide_count', 'expected_page_count', 'expected_tenfield_rectangle_count'): integer(row[key])
        require(row['total_rectangles_persisted'] is False)
        slides = array(row['slides'], {'order', 'kind', 'role_id', 'slot_id', 'assignment_id', 'candidate_id', 'candidate_media_id', 'position', 'review_status', 'fields_sha256', 'source_fields_sha256', 'requirements_sha256', 'frame_asset_ids', 'video_asset_id'}, 999, None)
        for ordinal, slide in enumerate(slides, 1):
            integer(slide['order'], 1); require(slide['order'] == ordinal and slide['kind'] in ('candidate', 'pending'))
            for field in ('role_id', 'slot_id', 'assignment_id', 'candidate_id', 'candidate_media_id', 'video_asset_id'): nullable_id(slide[field])
            for field in ('fields_sha256', 'source_fields_sha256', 'requirements_sha256'): digest(slide[field])
            identifiers(slide['frame_asset_ids'], 3)
            if slide['kind'] == 'candidate':
                for field in ('assignment_id', 'candidate_id', 'role_id', 'slot_id'): identifier(slide[field])
                require(slide['position'] in ('option', 'main', 'backup') and slide['review_status'] in ('reviewed', 'unreviewed'))
            else: require(slide['assignment_id'] is None and slide['candidate_id'] is None and slide['candidate_media_id'] is None and slide['position'] is None and slide['review_status'] is None and slide['video_asset_id'] is None and slide['frame_asset_ids'] == [])
        candidate_slides = [slide for slide in slides if slide['kind'] == 'candidate']; identifiers([slide['assignment_id'] for slide in candidate_slides], 999)
        require(row['candidate_slide_count'] == len(candidate_slides) and row['pending_slide_count'] == len(slides) - len(candidate_slides)
            and row['expected_page_count'] == len(slides) + 1 and row['expected_tenfield_rectangle_count'] == 10 * len(candidate_slides))
    stage_lists = {'ai_suggestion': ['prepare_suggestion', 'generate_suggestion', 'validate_suggestion'], 'review_fit': ['measure_review_fit']}
    schemas = {'prepare_suggestion': 'suggestion-preparation.v1', 'generate_suggestion': 'contextual-suggestion.v1', 'validate_suggestion': 'suggestion-validation.v1', 'measure_review_fit': 'review-fit-measurement.v1'}
    jobs = array(state['jobs'], {'id', 'workspace_id', 'resource_id', 'kind', 'status', 'stage', 'attempt', 'input_hash', 'input_hash_matches', 'configuration_sha256', 'n8n_execution_id', 'created_at', 'error_code', 'completed_stages', 'outbox', 'payloads'}, 128)
    job_by_id = {row['id']: row for row in jobs}; payload_by_job = {}
    for job in jobs:
        require(job['workspace_id'] in SCOPES and job['kind'] in stage_lists and job['status'] in ('queued', 'running', 'waiting_for_input', 'succeeded', 'failed', 'cancelled'))
        identifier(job['resource_id']); integer(job['attempt']); digest(job['input_hash']); digest(job['configuration_sha256']); require(job['input_hash_matches'] is True)
        require(timestamp(job['created_at']) <= observed); error_code(job['error_code'])
        require(job['n8n_execution_id'] is None or type(job['n8n_execution_id']) is str and re.fullmatch('[0-9]{1,20}', job['n8n_execution_id']))
        stages = stage_lists[job['kind']]; require(job['stage'] in stages)
        completed = array(job['completed_stages'], {'stage', 'attempt_id', 'input_hash_matches', 'result_sha256'}, len(stages), None)
        require([part['stage'] for part in completed] == stages[:len(completed)])
        for part in completed: identifier(part['attempt_id']); digest(part['result_sha256']); require(part['input_hash_matches'] is True)
        require((job['status'] == 'succeeded') == (len(completed) == len(stages)))
        if job['status'] == 'succeeded': require(job['n8n_execution_id'] is not None and job['attempt'] >= 1 and job['error_code'] is None and job['stage'] == stages[-1])
        elif len(completed) < len(stages): require(job['stage'] == stages[len(completed)])
        outbox = array(job['outbox'], {'stage', 'status', 'generation', 'attempt_count', 'input_hash_matches'}, 128, None)
        require(outbox and [part['generation'] for part in outbox] == sorted({part['generation'] for part in outbox}))
        for part in outbox:
            require(part['stage'] in stages and part['status'] in ('pending', 'leased', 'delivered', 'dead') and part['input_hash_matches'] is True)
            integer(part['generation'], 1); integer(part['attempt_count'], 0, 5)
        payloads = array(job['payloads'], {'id', 'stage', 'attempt_id', 'result_schema', 'input_hash_matches', 'payload_sha256', 'metadata'}, len(stages))
        require({part['stage'] for part in payloads} == {part['stage'] for part in completed} and len({part['stage'] for part in payloads}) == len(payloads))
        payload_by_job[job['id']] = {part['stage']: part for part in payloads}
        for part in payloads:
            require(part['stage'] in stages and part['result_schema'] == schemas[part['stage']] and part['input_hash_matches'] is True)
            identifier(part['attempt_id']); digest(part['payload_sha256'])
            completion = next(value for value in completed if value['stage'] == part['stage'])
            require(completion['attempt_id'] == part['attempt_id'] and completion['result_sha256'] == sha(json.dumps({'stage_output_id': part['id']}, separators=(', ', ': ')).encode('utf8')))
            require(any(event['stage'] == part['stage'] and event['status'] == 'delivered' for event in outbox))
            metadata = part['metadata']
            if part['stage'] in ('generate_suggestion', 'validate_suggestion'):
                exact(metadata, {'provider', 'sdk_version', 'requested_model', 'resolved_model', 'prompt_version', 'prompt_sha256', 'schema_sha256', 'input_sha256', 'response_id_sha256', 'request_id_sha256', 'usage'})
                require(metadata['provider'] == 'openai' and metadata['sdk_version'] == '7.45.1' and metadata['requested_model'] == 'gpt-6.1-sol'
                    and type(metadata['resolved_model']) is str and re.fullmatch('gpt-6\\.1-sol(?:-[0-9]{4}-[0-9]{2}-[0-9]{2})?', metadata['resolved_model'])
                    and metadata['prompt_version'] == 'contextual_suggestion_v1' and metadata['prompt_sha256'] == '8480a63823dc9be53ff4898c42df82f6e5b70ccc72100d141392d6c99766c242' and metadata['input_sha256'] == job['input_hash'])
                digest(metadata['schema_sha256']); digest(metadata['response_id_sha256']); nullable_digest(metadata['request_id_sha256'])
                usage = metadata['usage']
                if usage is not None:
                    exact(usage, {'input_tokens', 'output_tokens', 'total_tokens'})
                    for value in usage.values(): integer(value)
                    require(usage['total_tokens'] == usage['input_tokens'] + usage['output_tokens'])
            else: require(metadata is None)
        if 'validate_suggestion' in payload_by_job[job['id']]: require(payload_by_job[job['id']]['validate_suggestion']['payload_sha256'] == payload_by_job[job['id']]['generate_suggestion']['payload_sha256'])
    suggestions = array(state['suggestions'], {'id', 'workspace_id', 'job_id', 'target_type', 'target_id', 'target_row_version', 'field', 'bound_context_sha256', 'proposal_sha256', 'proposed_change_count', 'current_assignment_wording_matches'}, 128)
    require({row['job_id'] for row in suggestions} == {job['id'] for job in jobs if job['kind'] == 'ai_suggestion'})
    allowed_fields = {'assignment': {'name_or_id', 'age_or_range', 'height_measurements', 'languages_accents', 'skills_experience', 'city', 'previous_projects_roles', 'classification', 'availability', 'presentation_notes'},
        'candidate': {'name', 'age_or_range', 'height_measurements', 'skills_experience', 'city', 'previous_projects_roles', 'classification'}, 'workspace_candidate': {'availability'},
        'role': {'name', 'requirements.age_range', 'requirements.appearance_performance', 'requirements.location', 'requirements.availability_requirements', 'requirements.other_instructions'}}
    for row in suggestions:
        job = job_by_id[row['job_id']]; require(job['resource_id'] == row['id'] and row['workspace_id'] == job['workspace_id'])
        identifier(row['target_id']); integer(row['target_row_version'], 1); digest(row['bound_context_sha256'])
        require(row['target_type'] in allowed_fields and row['field'] in allowed_fields[row['target_type']]); integer(row['proposed_change_count'], 0, 1)
        require(row['current_assignment_wording_matches'] is None or type(row['current_assignment_wording_matches']) is bool)
        if job['status'] == 'succeeded':
            digest(row['proposal_sha256']); require(row['proposed_change_count'] == 1 and row['proposal_sha256'] == payload_by_job[job['id']]['validate_suggestion']['payload_sha256'])
            if row['target_type'] == 'assignment': boolean(row['current_assignment_wording_matches'])
        else: require(row['proposal_sha256'] is None and row['proposed_change_count'] == 0 and row['current_assignment_wording_matches'] is None)
    fits = array(state['fit_results'], {'job_id', 'workspace_id', 'series_id', 'input_fingerprint', 'status', 'error_code', 'completed_at', 'result_sha256', 'renderer_version', 'chromium_version', 'template_content_sha256', 'font_hashes', 'overflow_count', 'overflows', 'total_rectangles_persisted', 'matches_current_review'}, 128, 'job_id')
    fit_fields = set(allowed_fields['assignment']) | {'role_name', 'slot_label', 'requirements', 'project_name', 'client_name', 'title', 'layout'}
    for row in fits:
        require(row['job_id'] in job_by_id); job = job_by_id[row['job_id']]
        require(job['kind'] == 'review_fit' and row['series_id'] == job['resource_id'] and row['workspace_id'] == job['workspace_id'] and row['series_id'] in series_by_id)
        digest(row['input_fingerprint']); require(timestamp(row['completed_at']) <= observed and row['status'] in ('measured', 'failed') and row['total_rectangles_persisted'] is False)
        boolean(row['matches_current_review']); current = review_by_id.get(row['series_id']); require(row['matches_current_review'] == (current is not None and current['input_fingerprint'] == row['input_fingerprint']))
        if row['status'] == 'measured':
            require(job['status'] == 'succeeded' and row['error_code'] is None and row['renderer_version'] == 'everyone-casting-fit-v1' and row['template_content_sha256'] == template_hash
                and type(row['chromium_version']) is str and re.fullmatch('[0-9]+(?:\\.[0-9]+){2,3}', row['chromium_version']) and row['font_hashes'] == fonts)
            digest(row['result_sha256']); require(row['result_sha256'] == payload_by_job[job['id']]['measure_review_fit']['payload_sha256'])
            overflows = array(row['overflows'], {'slide_index', 'field', 'axis', 'overflow_px'}, 10000, None); integer(row['overflow_count'], 0, 10000); require(row['overflow_count'] == len(overflows))
            for overflow in overflows:
                integer(overflow['slide_index'], 0, 999); require(overflow['field'] in fit_fields and overflow['axis'] in ('horizontal', 'vertical')
                    and type(overflow['overflow_px']) in (int, float) and math.isfinite(overflow['overflow_px']) and 0 < overflow['overflow_px'] <= 100000000)
                if current and row['matches_current_review']: require(overflow['slide_index'] < current['expected_page_count'])
        else:
            require(job['status'] == 'failed' and row['error_code'] == 'FIT_MEASUREMENT_FAILED'
                and all(row[key] is None for key in ('result_sha256', 'renderer_version', 'chromium_version', 'template_content_sha256', 'font_hashes', 'overflow_count', 'overflows')))
    waiter = state['waiter']; exact(waiter, {'role_id', 'role_active', 'active_slot_ids', 'assignment_ids', 'archive_event_ids', 'undo_event_ids', 'consumed_archive_count', 'archive_audit_count', 'undo_audit_count'})
    require(waiter['role_id'] == WAITER and waiter['role_active'] is True and waiter['active_slot_ids'] == WAITER_SLOTS)
    for key in ('assignment_ids', 'archive_event_ids', 'undo_event_ids'): identifiers(waiter[key], 128)
    for key in ('consumed_archive_count', 'archive_audit_count', 'undo_audit_count'): integer(waiter[key], 1, 128)
    require(waiter['archive_event_ids'] and waiter['undo_event_ids'] and waiter['consumed_archive_count'] == len(waiter['archive_event_ids'])
        and waiter['archive_audit_count'] == len(waiter['archive_event_ids']) and waiter['undo_audit_count'] == len(waiter['undo_event_ids']))
    subject = state['subject']; exact(subject, {'id', 'row_version', 'facts_fingerprint', 'effective_reviewed', 'reviewed_facts_fingerprint', 'candidate_media_id', 'source_job_id', 'source_asset_id', 'source_sha256', 'source_size_bytes', 'selected_frame_asset_ids', 'frames'})
    vision = reference['vision']['state']; factual = reference['reviewed']['confirmation']; integer(subject['row_version'], factual['candidate_row_version'])
    require(subject['id'] == CANDIDATE and subject['candidate_media_id'] == MEDIA and subject['source_job_id'] == JOB and subject['source_asset_id'] == ASSET
        and subject['facts_fingerprint'] == subject['reviewed_facts_fingerprint'] == factual['reviewed_facts_fingerprint'] and subject['effective_reviewed'] is True
        and subject['source_sha256'] == vision['source']['sha256'] and subject['source_size_bytes'] == vision['source']['size_bytes'] and subject['selected_frame_asset_ids'] == vision['application']['selected_frame_asset_ids'])
    expected_frames = [{'asset_id': frame['frame_asset_id'], 'sha256': frame['sha256'], 'timestamp_ms': frame['timestamp_ms'], 'width': frame['width'], 'height': frame['height'], 'ready': frame['status'] == 'ready', 'source_and_job_match': frame['source_and_job_match']} for frame in vision['preparation']['sampled_frames']]
    require(subject['frames'] == expected_frames and state['retained_profiles'] == vision['retained_profiles'] and state['protected_m02'] == reference['casting']['state']['protected_m02'])
    separation = array(state['assignment_separation'], {'assignment_id', 'workspace_id', 'slot_id', 'candidate_id', 'position', 'shortlist_included', 'archived', 'presentation_notes_sha256', 'internal_notes_sha256', 'slide_wording_sha256', 'candidate_facts_fingerprint', 'candidate_facts_sha256', 'candidate_field_sources_sha256', 'project_availability_sha256'}, 512, 'assignment_id')
    separated = {row['assignment_id']: row for row in separation}
    old_state = reference['casting']['state']; old_facts = {row['id']: row for row in old_state['old_candidates']}
    old_pools = {row['id']: row for row in old_state['old_participations']}
    for row in separation:
        require(row['workspace_id'] in SCOPES and row['position'] in ('option', 'main', 'backup')); identifier(row['slot_id']); identifier(row['candidate_id']); boolean(row['shortlist_included']); boolean(row['archived'])
        for key in ('presentation_notes_sha256', 'internal_notes_sha256', 'project_availability_sha256'): nullable_digest(row[key])
        for key in ('slide_wording_sha256', 'candidate_facts_fingerprint', 'candidate_facts_sha256', 'candidate_field_sources_sha256'): digest(row[key])
        if row['candidate_id'] in old_facts:
            before = old_facts[row['candidate_id']]; require(row['candidate_facts_sha256'] == before['facts_sha256'] and row['candidate_field_sources_sha256'] == before['field_sources_sha256'])
        if row['candidate_id'] == CANDIDATE: require(row['candidate_facts_fingerprint'] == factual['reviewed_facts_fingerprint'])
    for old in old_state['assignments']:
        require(old['id'] in separated); row = separated[old['id']]
        if old['workspace_candidate_id'] in old_pools: expected_candidate = old_pools[old['workspace_candidate_id']]['candidate_id']
        else:
            # The earlier canonical checkpoint retained this already removed
            # synthetic assignment; its profile ID is in the signed-in journey.
            require(old['id'] == '227af2e0-730a-4629-bad6-6a4f8cd7fc19' and old['archived'] is True)
            expected_candidate = '6a15cdc3-4002-40f3-a2b1-5d8dfa8d6054'
        require(row['workspace_id'] == '098d5b48-42a3-475b-b562-735c9eafce80' and row['candidate_id'] == expected_candidate)
        for key in ('slot_id', 'position', 'shortlist_included', 'archived', 'presentation_notes_sha256', 'internal_notes_sha256'): require(row[key] == old[key])
    active = [row for row in separation if not row['archived']]; main_active = [row for row in active if row['workspace_id'] == '098d5b48-42a3-475b-b562-735c9eafce80']
    require(len(main_active) == 3 and sum(row['position'] == 'main' for row in main_active) == 1 and sum(row['shortlist_included'] for row in main_active) == 1)
    old_assignment_ids = {row['id'] for row in old_state['assignments']}
    new_main = [row for row in main_active if row['assignment_id'] not in old_assignment_ids]
    require(len(new_main) == 1 and new_main[0]['candidate_id'] == 'd5e665b3-dc23-4ead-858e-81abbce55743'
        and new_main[0]['slot_id'] == WAITER_SLOTS[0] and new_main[0]['position'] == 'option' and new_main[0]['shortlist_included'] is False)
    require(len({(row['workspace_id'], row['slot_id'], row['candidate_id']) for row in active}) == len(active))
    mains = [(row['workspace_id'], row['slot_id']) for row in active if row['position'] == 'main']; require(len(set(mains)) == len(mains))
    require({row['assignment_id'] for row in separation if row['slot_id'] in WAITER_SLOTS} == set(waiter['assignment_ids']))
    for review in reviews:
        visible = [row for row in active if row['workspace_id'] == review['workspace_id'] and (review['output_type'] == 'selection' or row['shortlist_included'])]
        slides = [slide for slide in review['slides'] if slide['kind'] == 'candidate']; require({slide['assignment_id'] for slide in slides} == {row['assignment_id'] for row in visible})
        for slide in slides:
            row = separated[slide['assignment_id']]; require(slide['candidate_id'] == row['candidate_id'] and slide['slot_id'] == row['slot_id'] and slide['position'] == row['position'])
        if review['workspace_id'] == '098d5b48-42a3-475b-b562-735c9eafce80':
            require((review['candidate_slide_count'], review['pending_slide_count']) == ((3, 2) if review['output_type'] == 'selection' else (1, 4)))
    require({'selection', 'shortlist'} <= {row['output_type'] for row in reviews if row['workspace_id'] == '098d5b48-42a3-475b-b562-735c9eafce80'})
    return {'structural_and_preservation_passed': True, 'reviewed_source_profile_fingerprint_and_frames_preserved': True,
        'original_nine_profiles_and_108_frames_preserved': True, 'old_manual_profile_facts_and_sources_preserved': True,
        'old_assignment_choices_and_private_notes_preserved': True, 'protected_m02_preserved': True, 'waiter_retirement_restored_and_consumed': True,
        'active_assignment_counts': {workspace: sum(row['workspace_id'] == workspace for row in active) for workspace in SCOPES},
        'main_workspace_main_count': sum(row['position'] == 'main' for row in main_active), 'main_workspace_shortlist_count': sum(row['shortlist_included'] for row in main_active),
        'successful_ai_job_count': sum(job['kind'] == 'ai_suggestion' and job['status'] == 'succeeded' for job in jobs),
        'successful_native_fit_job_count': sum(job['kind'] == 'review_fit' and job['status'] == 'succeeded' for job in jobs),
        'current_zero_overflow_fit_count': sum(row['status'] == 'measured' and row['matches_current_review'] and row['overflow_count'] == 0 for row in fits),
        'job_statuses': {job['id']: job['status'] for job in jobs}, 'actual_total_rectangles_persisted': False,
        'generated_pdf_or_independent_semantic_accuracy_claimed': False}


def main(arguments=None):
    arguments = sys.argv[1:] if arguments is None else arguments; require(arguments == [])
    report = {'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'target': TARGET, 'result': 'unconfirmed',
        'read_only': True, 'cloud_call_attempted': False, 'provider_called_by_observer': False, 'business_mutations_requested': False,
        'owner_answer_key_or_browser_session_used': False, 'private_payloads_or_scalar_fact_hashes_published': False, 'hosting_deferred': True,
        'scope': 'Two fixed workspaces; M04 app review/job metadata, exact retirement restoration and retained source/profile facts.',
        'application_source_boundary': 'Observed current on-disk public source hashes, stable across this read-only capture. These do not attest bytes loaded by a browser or worker; actual process/UI receipts establish that separately.',
        'limitations': 'Job status/provenance is separate from structural preservation; no independent semantic accuracy, PDF rendering, guest or hosting acceptance.'}
    try:
        current, reference = inputs(); report['inputs'] = current
        report['cloud_call_attempted'] = True
        result = cli_call(['db', 'query', '--linked', '--project-ref', TARGET, '--file', str(ROOT / SQL), '--output-format', 'json'])
        require(result.returncode == 0 and len(result.stdout.encode('utf8')) <= 2 * 1024 * 1024)
        payload = json.loads(result.stdout); require(type(payload) is dict and type(payload.get('rows')) is list and len(payload['rows']) == 1)
        exact(payload['rows'][0], {'m04_review_capture'})
        summary = validate(payload['rows'][0]['m04_review_capture'], reference, current['versions'])
        after, _ = inputs(); require(after == current)
        report.update(result='captured', state=payload['rows'][0]['m04_review_capture'], conclusions=summary, sources_stable=True)
    except Exception:
        report['code'] = 'M04_REVIEW_APP_CAPTURE_UNCONFIRMED'
    finally:
        EVIDENCE.mkdir(parents=True, exist_ok=True)
        file = EVIDENCE / (datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8] + '.json')
        with file.open('x', encoding='utf8') as handle: json.dump(report, handle, indent=2); handle.write('\n')
        print(json.dumps({'result': report['result'], 'receipt': file.relative_to(ROOT).as_posix(), 'read_only': True, 'cloud_call_attempted': report['cloud_call_attempted']}))
    return 0 if report['result'] == 'captured' else 1


if __name__ == '__main__':
    try: sys.exit(main())
    except Exception: sys.stderr.write('Fixed M04 review observer stopped; raw diagnostics remain private.\n'); sys.exit(1)
