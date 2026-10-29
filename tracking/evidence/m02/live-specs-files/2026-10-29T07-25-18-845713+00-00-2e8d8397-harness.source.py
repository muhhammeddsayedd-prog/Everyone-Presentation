"""Fixed read-only live file metadata proof. Never reads worker/key config.

Root seals the actual file-job IDs after submitting through the app. Each run
retains its own SQL, harness and receipt; a later DOCX capture cannot overwrite
the earlier PDF proof. No HTTP object download or n8n API is performed here.
"""
import datetime
import hashlib
import json
import re
import sys
import uuid

from release_foundation import ROOT, TARGET, call

VERSIONS = ['20261028010943', '20261028013324', '20261028013655', '20261028024205', '20261028072515', '20261028162702',
            '20261028162800', '20261028172320', '20261028184145', '20261028222030', '20261029001520', '20261029003941', '20261029070038']

SQL = 'tools/sql/live-specs-files-readback.sql'
SQL_SHA256 = 'fd05d73fa50b7c2c1b608101b1b34eea8784f846cca61ebfca81390036920c5c'
JOB_EXPECTATIONS = {
    'c50391c2-da84-4ee0-9fd8-a2782eed234e': {
        'source_sha256': '5619ce39c4d4f9e661fd59196ec1cd50a7c281f5618412c34a3b3eef003a1e83',
        'mime_type': 'application/pdf',
        'arabic_expected': False,
    },
}
RELEASE_PROOF = 'tracking/evidence/cloud-specs-read-operation/2026-10-29T07-22-46-245766Z-0a6a9099-readback.json'
RELEASE_PROOF_SHA256 = 'bbb54bcd0633b55ef866eee6828c01e9b66bca413daff83d06a7e421464e3b0b'
WORKSPACE = '098d5b48-42a3-475b-b562-735c9eafce80'
PROJECT = '4b70c8ce-18bd-4a8c-b5a9-bc1156c06463'
EVIDENCE = ROOT / 'tracking/evidence/m02/live-specs-files'
STAGES = ['prepare_document', 'extract_specs', 'apply_specs']


def require(value):
    if not value: raise ValueError('LIVE_FILE_METADATA_UNCONFIRMED')


def sha256(value):
    return hashlib.sha256(value).hexdigest()


def render_sql(template, jobs):
    require(isinstance(jobs, dict) and 1 <= len(jobs) <= 4)
    for identity, expected in jobs.items():
        require(isinstance(identity, str) and re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', identity)
                and isinstance(expected, dict) and set(expected) == {'source_sha256', 'mime_type', 'arabic_expected'}
                and isinstance(expected['source_sha256'], str) and re.fullmatch(r'[a-f0-9]{64}', expected['source_sha256'])
                and expected['mime_type'] in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain')
                and type(expected['arabic_expected']) is bool)
    require(isinstance(template, str) and template.count('__EPS_FILE_JOB_IDS__') == 1)
    return template.replace('__EPS_FILE_JOB_IDS__', ','.join("'" + identity + "'" for identity in sorted(jobs)))


def checks_for(observed, expected):
    files = observed.get('file_jobs') if isinstance(observed, dict) else None
    rows = {row['job_id']: row for row in files} if isinstance(files, list) else {}
    checks = {'exact_scope': observed.get('workspace_id') == WORKSPACE and observed.get('project_id') == PROJECT,
              'exact_versions': observed.get('versions') == VERSIONS,
              'all_requested_jobs': len(rows) == len(expected) and set(rows) == set(expected)}
    assets = {row['asset_id']: row for row in observed.get('assets', [])}
    for identity, facts in expected.items():
        row = rows.get(identity, {}); preparation = row.get('preparation') or {}; provider = row.get('provider') or {}
        source = row.get('source_binding') or {}; references = row.get('references') or {}; usage = provider.get('usage') or {}
        original = assets.get(row.get('source_asset_id'), {})
        outbox = row.get('outbox') or []; completed = row.get('completed_stages') or []
        prefix = identity + ':'
        checks[prefix + 'succeeded'] = row.get('status') == 'succeeded'
        checks[prefix + 'frozen_original'] = (row.get('source_sha256') == facts['source_sha256']
            and original.get('stored_sha256') == facts['source_sha256'] and original.get('mime_type') == facts['mime_type']
            and original.get('status') == 'ready' and original.get('path_bound') is True
            and source.get('retained') is True and source.get('ready_original_matches') is True)
        attempts = row.get('stage_attempts') or {}
        checks[prefix + 'three_committed_stages'] = (sorted(item.get('stage', '') for item in completed) == sorted(STAGES)
            and set(attempts) == set(STAGES) and all(type(count) is int and 1 <= count <= 3 for count in attempts.values()))
        checks[prefix + 'all_stages_delivered'] = (set(item.get('stage') for item in outbox) == set(STAGES)
            and all(item.get('status') == 'delivered' and item.get('dispatch_bound') is True for item in outbox)
            and isinstance(row.get('last_n8n_execution_id'), str) and bool(row['last_n8n_execution_id']))
        checks[prefix + 'private_preparation_verified'] = (preparation.get('private_json_stored') is True
            and preparation.get('ready_derivative_matches_exact_json') is True and preparation.get('source_id_matches') is True
            and preparation.get('arabic_present') is facts['arabic_expected']
            and type(preparation.get('paragraph_count')) is int and preparation['paragraph_count'] > 0)
        checks[prefix + 'provider_metadata'] = (provider.get('provider') == 'openai' and provider.get('response_reference_present') is True
            and provider.get('requested_model') == (row.get('configuration') or {}).get('model_version')
            and provider.get('input_sha256') == row.get('input_sha256') and provider.get('sdk_version') == '7.45.1'
            and all(type(usage.get(key)) is int and usage[key] >= 0 for key in ('input_tokens', 'output_tokens', 'total_tokens'))
            and usage.get('total_tokens', 0) > 0)
        checks[prefix + 'document_evidence_grounded'] = (type(references.get('count')) is int and references['count'] > 0
            and references.get('all_grounded') is True and bool(references.get('locators'))
            and all(item.get('grounded') is True and item.get('asset_id') == row.get('source_asset_id') for item in references.get('locators', [])))
    draft = observed.get('current_draft') or {}
    checks['known_current_and_historical_origins_resolve'] = (draft.get('origin_resolves') is True
        and all(item.get('origin_resolves') is True for item in draft.get('role_origins', []) if item.get('origin_job_id') is not None))
    checks['current_draft_has_roles_and_slots'] = (type(draft.get('active_roles')) is int and draft['active_roles'] > 0
        and type(draft.get('active_slots')) is int and draft['active_slots'] >= draft['active_roles'])
    return checks


def prerequisites():
    require(SQL_SHA256 and JOB_EXPECTATIONS)
    require((ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET)
    source = (ROOT / SQL).read_bytes(); require(sha256(source) == SQL_SHA256)
    proof = (ROOT / RELEASE_PROOF).read_bytes(); require(sha256(proof) == RELEASE_PROOF_SHA256)
    value = json.loads(proof)
    require(value['target'] == TARGET and value['result'] == 'passed' and value['application_verified_by_readback'] is True
            and value['action'] == 'readback' and value['readback']['versions'] == VERSIONS)
    return render_sql(source.decode('utf-8'), JOB_EXPECTATIONS)


def main():
    require(len(sys.argv) == 1)
    rendered = prerequisites(); EVIDENCE.mkdir(parents=True, exist_ok=True)
    observed_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    label = observed_at.replace(':', '-').replace('.', '-') + '-' + uuid.uuid4().hex[:8]
    query_file = EVIDENCE / (label + '-query.sql'); query_file.open('x', encoding='utf-8').write(rendered)
    harness = (ROOT / 'tools/capture-live-specs-files.py').read_bytes()
    (EVIDENCE / (label + '-harness.source.py')).open('xb').write(harness)
    report = {'observed_at': observed_at, 'target': TARGET, 'result': 'unconfirmed', 'read_only': True,
              'scope': 'Actual canonical file-job metadata. Stored hashes are not a fresh HTTP byte proof; only last n8n execution per job is persisted.',
              'original_pasted_receipts_modified': False, 'raw_source_provider_payloads_or_credentials_recorded': False,
              'provider_called': False, 'storage_http_called': False, 'n8n_api_called': False,
              'expected_jobs': JOB_EXPECTATIONS, 'sql_template_sha256': SQL_SHA256, 'rendered_sql_sha256': sha256(rendered.encode()),
              'harness_sha256': sha256(harness), 'release_proof_sha256': RELEASE_PROOF_SHA256}
    try:
        result = call(['db', 'query', '--linked', '--project-ref', TARGET, '--file', str(query_file), '--output-format', 'json'])
        require(result.returncode == 0 and len(result.stdout.encode('utf-8')) <= 8 * 1024 * 1024)
        rows = json.loads(result.stdout)['rows']; require(len(rows) == 1 and set(rows[0]) == {'live_specs_files'})
        observed = rows[0]['live_specs_files']; require(observed['query_role'] == 'postgres' and observed['database'] == 'postgres')
        checks = checks_for(observed, JOB_EXPECTATIONS)
        report.update(result='passed' if all(checks.values()) else 'failed', checks=checks, observed=observed)
    except Exception:
        report['code'] = 'LIVE_FILE_METADATA_UNCONFIRMED'
    finally:
        path = EVIDENCE / (label + '-metadata.json'); path.open('x', encoding='utf-8').write(json.dumps(report, indent=2) + '\n')
        print(json.dumps({'result': report['result'], 'checks': report.get('checks', {}), 'receipt': path.relative_to(ROOT).as_posix(),
                          'raw_source_provider_payloads_or_credentials_recorded': False}))
    return 0 if report['result'] == 'passed' else 1


if __name__ == '__main__':
    try: sys.exit(main())
    except Exception:
        print('{"result":"unconfirmed","code":"LIVE_FILE_METADATA_UNCONFIRMED","raw_diagnostics_suppressed":true}')
        sys.exit(1)
