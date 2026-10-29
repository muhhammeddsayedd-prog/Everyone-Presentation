"""Fixed read-only metadata observer. Never captures displayed words or URLs."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import uuid

from release_foundation import ROOT, TARGET
from release_m04_casting import call as cli_call
from release_m04_review import validate_process_scope

SQL = 'tools/sql/m05-app-capture.sql'
SQL_SHA = '5988e3e67295848de278b7dcf5d314943a82f69c1bdd1cdabac8ed146842a27d'
MANIFEST = 'development/local-db/reviewed.json'
SOURCES = [SQL, MANIFEST, 'tools/capture-m05-app.py', 'tools/release_m04_casting.py',
           'tools/release_foundation.py', 'tools/release_m04_review.py',
           'packages/templates/versions/1.1.0/registry.json', 'packages/templates/versions/1.1.0/render.ts',
           'apps/worker/src/presentation-pdf.ts', 'apps/worker/src/presentation-pdf-inspect-process.mjs',
           'apps/worker/src/presentation-stage-executor.ts', 'packages/central/src/presentation.ts',
           'apps/web/components/PresentationVersionView.tsx', 'apps/web/components/WorkspacePresentationView.tsx',
           'apps/web/components/PresentationIndex.tsx', 'apps/web/components/VersionAssetImage.tsx']


def require(value):
    if not value: raise ValueError('M05_APP_CAPTURE_UNCONFIRMED')


def sha(value): return hashlib.sha256(value).hexdigest()
def exact(value, keys): require(type(value) is dict and set(value) == set(keys))
def identifier(value): require(type(value) is str and re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', value))
def digest(value): require(type(value) is str and re.fullmatch(r'[a-f0-9]{64}', value))


def inputs():
    validate_process_scope(os.environ)
    require((ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET)
    require(sha((ROOT / SQL).read_bytes()) == SQL_SHA)
    manifest = json.loads((ROOT / MANIFEST).read_bytes()); require(len(manifest['migrations']) == 24)
    require(Path(manifest['migrations'][-1]['path']).name == '20261029215218_m05_immutable_presentation_versions.sql')
    versions = []
    for row in manifest['migrations']:
        require(re.fullmatch(r'supabase/migrations/[0-9]{14}_[a-z0-9_]+\.sql', row['path']))
        require(sha((ROOT / row['path']).read_bytes()) == row['sha256'])
        versions.append(Path(row['path']).name[:14])
    require(versions == sorted(set(versions)))
    return versions, {file: sha((ROOT / file).read_bytes()) for file in SOURCES}


def validate(state, versions):
    exact(state, ['observed_at', 'query_role', 'database', 'unrestricted_visibility', 'migration_versions', 'processing_enabled', 'versions', 'series', 'protected'])
    require(state['query_role'] == state['database'] == 'postgres' and state['migration_versions'] == versions)
    require(state['unrestricted_visibility'] is True)
    datetime.datetime.fromisoformat(state['observed_at'].replace('Z', '+00:00'))
    require(type(state['processing_enabled']) is bool)
    allowed = {'id', 'series_id', 'workspace_id', 'version_no', 'status', 'snapshot_sha256', 'manifest_sha256', 'inventory_sha256',
               'snapshot_hash_matches', 'manifest_hash_matches', 'inventory_hash_matches', 'page_count', 'template_version',
               'template_content_sha256', 'slides', 'pins', 'pdf_asset_id', 'manifest_asset_id', 'pdf_sha256', 'pdf_bytes',
               'manifest_bytes_sha256', 'job_id', 'job_status', 'stage', 'attempt', 'n8n_execution_id', 'error_code',
               'completed_stages', 'stage_receipts', 'outbox'}
    nested = {'order', 'kind', 'assignment_id', 'slot_id', 'content_sha256', 'frame_count', 'has_original_video',
              'asset_id', 'asset_kind', 'sha256', 'byte_size', 'current_physical_identity_matches', 'retained',
              'attempt_id', 'input_hash_matches', 'result_schema', 'payload_sha256', 'generation', 'output_type',
              'latest_ready_version_id', 'latest_ready_version_no', 'next_version_no'}
    strings = {'queued', 'rendering', 'ready', 'failed', 'running', 'succeeded', 'cancelled', 'waiting_for_input',
               'pending', 'leased', 'delivered', 'dead', 'cover', 'candidate', 'client_logo', 'candidate_frame', 'candidate_video',
               'presentation_manifest', 'presentation_pdf', 'selection', 'shortlist', '1.0.0', '1.1.0',
               'prepare_presentation', 'render_presentation', 'validate_presentation', 'publish_presentation',
               'presentation-preparation.v1', 'presentation-rendering.v1', 'presentation-validation.v1', 'presentation-render-result.v1'}
    def safe(value):
        if value is None or type(value) is bool: return
        if type(value) is int: require(0 <= value <= 9007199254740991); return
        if type(value) is str:
            require(value in strings or re.fullmatch(r'[a-f0-9]{64}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}|[0-9]{1,20}|[A-Z][A-Z0-9_]{0,99}', value)); return
        if type(value) is list:
            require(len(value) <= 2000)
            for item in value: safe(item)
            return
        require(type(value) is dict and set(value) <= allowed | nested)
        for item in value.values(): safe(item)
    require(type(state['versions']) is list and len(state['versions']) <= 100)
    for version in state['versions']:
        exact(version, allowed); safe(version); identifier(version['id'])
        require(version['workspace_id'] == '098d5b48-42a3-475b-b562-735c9eafce80')
        require(all(version[key] is True for key in ['snapshot_hash_matches', 'manifest_hash_matches', 'inventory_hash_matches']))
        require(version['page_count'] == len(version['slides']) and [row['order'] for row in version['slides']] == list(range(version['page_count'])))
        require(all(pin['current_physical_identity_matches'] is True and pin['retained'] is True for pin in version['pins']))
        if version['status'] == 'ready':
            require(version['job_status'] == 'succeeded' and len(version['completed_stages']) == 4)
            stages = [('prepare_presentation', 'presentation-preparation.v1'), ('render_presentation', 'presentation-rendering.v1'),
                      ('validate_presentation', 'presentation-validation.v1'), ('publish_presentation', 'presentation-render-result.v1')]
            require(version['stage'] == stages[-1][0])
            require([(row['stage'], row['result_schema']) for row in version['completed_stages']] == stages)
            for row in version['completed_stages']:
                require(row['input_hash_matches'] is True); identifier(row['attempt_id'])
            require(len(version['stage_receipts']) == 4 and sorted((row['stage'], row['result_schema']) for row in version['stage_receipts']) == sorted(stages))
            for row in version['stage_receipts']: digest(row['payload_sha256'])
            for key in ['pdf_asset_id', 'manifest_asset_id']: identifier(version[key])
            digest(version['pdf_sha256']); digest(version['manifest_bytes_sha256'])
            for prefix, purpose, checksum in [('pdf', 'presentation_pdf', 'pdf_sha256'), ('manifest', 'presentation_manifest', 'manifest_bytes_sha256')]:
                pins = [row for row in version['pins'] if row['asset_id'] == version[prefix + '_asset_id']]
                require(len(pins) == 1 and pins[0]['asset_kind'] == purpose and pins[0]['sha256'] == version[checksum])
    safe(state['series'])
    exact(state['protected'], ['m02_waiting_preserved', 'owner_confirmed_profile_still_reviewed', 'reviewed_source_sha256'])
    require(state['protected']['m02_waiting_preserved'] is True and state['protected']['owner_confirmed_profile_still_reviewed'] is True)
    require(state['protected']['reviewed_source_sha256'] == 'ffe461d30d48b32d90f1165627e2d104b6817f61d96a5a4bd9dcd6ff1964fc0a')


def main():
    require(sys.argv[1:] == [])
    report = {'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'result': 'unconfirmed', 'target': TARGET,
              'read_only': True, 'provider_called_by_observer': False, 'browser_session_used': False,
              'private_payloads_or_signed_urls_published': False, 'hosting_deferred': True}
    try:
        versions, seals = inputs()
        result = cli_call(['db', 'query', '--linked', '--project-ref', TARGET, '--file', str(ROOT / SQL), '--output-format', 'json'])
        require(result.returncode == 0 and len(result.stdout.encode()) <= 512 * 1024)
        rows = json.loads(result.stdout)['rows']; require(len(rows) == 1); exact(rows[0], ['m05_app_capture'])
        state = rows[0]['m05_app_capture']; validate(state, versions); require(inputs() == (versions, seals))
        report.update(result='captured', state=state, source_sha256=seals, sources_stable=True)
    except Exception: report['code'] = 'M05_APP_CAPTURE_UNCONFIRMED'
    directory = ROOT / 'tracking/evidence/m05/app-capture'; directory.mkdir(parents=True, exist_ok=True)
    file = directory / (datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8] + '.json')
    with file.open('x', encoding='utf8') as handle: json.dump(report, handle, indent=2); handle.write('\n')
    print(json.dumps({'result': report['result'], 'receipt': file.relative_to(ROOT).as_posix(), 'read_only': True}))
    return 0 if report['result'] == 'captured' else 1


if __name__ == '__main__': sys.exit(main())
