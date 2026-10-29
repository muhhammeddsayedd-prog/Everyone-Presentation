"""Fixed read-only evidence for the actual app-submitted image-only PDF.

Import and log-only mode make no network call. Only the no-argument capture runs
the fixed metadata SQL through the existing owner CLI; no provider/Storage call.
Raw log lines, source text, images and provider bodies are never written out.
"""
import datetime
import hashlib
import json
import re
import sys
import uuid

from release_foundation import ROOT, TARGET, call

JOB = 'e7316bb7-4c40-4460-8d17-15503ba12315'
WORKSPACE = 'e470aefd-e0f7-480c-bf0d-170cb2cb7069'
PROJECT = 'bd14d10f-b1c5-4d6a-8b4d-e5c48208433c'
ASSET = 'c7a82096-7a56-415c-9ba1-eeb4bbb0e708'
SOURCE_SHA256 = '2f1508bf45a46ae81f3459b1507db58f1e9af41591a0367b643dce973823225f'
SOURCE_BYTES = 213626
SQL = 'tools/sql/m02-pdf-vision-readback.sql'
SQL_SHA256 = 'a5732d46a476cc593abedeb6403463b4aa4cfad7be081fd15e00c95d1e45f215'
LOG = '.local/specs-runtime/worker-pdf-vision-v1.stdout.log'
MAXIMUM_LOG_BYTES = 1024 * 1024
EVIDENCE = ROOT / 'tracking/evidence/m02/live-pdf-vision'
STAGES = ['prepare_document', 'extract_specs', 'apply_specs']
ROLE_CHECKS = {'archive_clerk', 'headcount_not_invented', 'age_not_invented', 'arabic_required', 'english_required',
               'cairo_retained', 'scene_9_retained', 'scene_11_retained', 'relative_monday_retained',
               'calendar_date_not_invented', 'date_clarification_present'}


def require(value):
    if not value:
        raise ValueError('PDF_VISION_EVIDENCE_UNCONFIRMED')


def sha256(value):
    return hashlib.sha256(value).hexdigest()


def identifier(value):
    return isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9._:-]{1,200}', value) is not None


def digest(value):
    return isinstance(value, str) and re.fullmatch(r'[a-f0-9]{64}', value) is not None


def count(value):
    return type(value) is int and 0 <= value <= 9007199254740991


def safe_sql_failure(stdout, stderr):
    """Never return raw CLI/database diagnostics, literals or unknown identifiers."""
    raw = (stdout + '\n' + stderr)[:2 * 1024 * 1024]
    classes = {
        'SQL_SCOPE_UNCONFIRMED': 'PDF_VISION_READBACK_SCOPE_UNCONFIRMED',
        'SQL_SYNTAX_ERROR': 'syntax error', 'SQL_UNDEFINED_COLUMN': 'column',
        'SQL_CARDINALITY_ERROR': 'more than one row', 'SQL_AMBIGUOUS_COLUMN': 'ambiguous',
        'SQL_PERMISSION_DENIED': 'permission denied', 'SQL_UNDEFINED_FUNCTION': 'function',
    }
    codes = [name for name, pattern in classes.items() if pattern.lower() in raw.lower()]
    identifiers = []
    for name in ('input_asset_id', 'workspace_id', 'project_id', 'resource_id', 'source_text', 'source_asset_id', 'source_hash',
                 'source_size_bytes', 'source_mime_type', 'payload_utf8', 'prepared_text', 'paragraphs', 'provisional', 'source_job_id',
                 'requirements', 'object_key', 'processing_job_id', 'source_extraction_job_id'):
        if re.search(r'column\s+[\"\']?(?:[a-z]+\.)?' + name + r'[\"\']?\s+(?:does not exist|is ambiguous)', raw, re.IGNORECASE):
            identifiers.append(name)
    return {'classes': codes or ['SQL_OR_CLI_UNCONFIRMED'], 'known_column_identifiers': identifiers}


def ocr_events(log_bytes, attempt_id=None):
    """Project only a known successful OCR event; unknown fields never escape."""
    require(isinstance(log_bytes, bytes) and 0 < len(log_bytes) <= MAXIMUM_LOG_BYTES)
    grouped = {}
    for line in log_bytes.decode('utf-8', errors='strict').splitlines():
        try:
            value = json.loads(line)
        except (ValueError, TypeError):
            continue
        if not isinstance(value, dict) or value.get('event') != 'document_vision_page_processed' or value.get('job_id') != JOB:
            continue
        require(value.get('source_asset_id') == ASSET and value.get('source_sha256') == SOURCE_SHA256
                and value.get('provider') == 'openai' and value.get('sdk_version') == '7.45.1'
                and value.get('prompt_version') == 'pdf-page-ocr.v1' and value.get('rasterizer_version') == 'pdftoppm version 22.12.0'
                and value.get('page') in (1, 2) and type(value.get('page')) is int
                and identifier(value.get('attempt_id')) and digest(value.get('input_hash'))
                and identifier(value.get('requested_model')) and identifier(value.get('resolved_model'))
                and identifier(value.get('response_id'))
                and (value.get('request_id') is None or identifier(value.get('request_id')))
                and digest(value.get('image_sha256')) and digest(value.get('prompt_sha256')) and digest(value.get('schema_sha256'))
                and count(value.get('elapsed_ms')))
        usage = value.get('usage')
        require(isinstance(usage, dict) and all(count(usage.get(key)) for key in ('input_tokens', 'output_tokens', 'total_tokens'))
                and usage['total_tokens'] > 0 and usage['input_tokens'] + usage['output_tokens'] == usage['total_tokens'])
        projected = {key: value[key] for key in ('job_id', 'attempt_id', 'input_hash', 'source_asset_id', 'source_sha256', 'page',
                     'provider', 'sdk_version', 'requested_model', 'resolved_model', 'prompt_version', 'prompt_sha256',
                     'schema_sha256', 'image_sha256', 'elapsed_ms', 'rasterizer_version')}
        projected['usage'] = {key: usage[key] for key in ('input_tokens', 'output_tokens', 'total_tokens')}
        projected['response_reference_present'] = True
        projected['response_id_sha256'] = sha256(value['response_id'].encode())
        projected['request_reference_present'] = value.get('request_id') is not None
        grouped.setdefault(value['attempt_id'], []).append(projected)
    if attempt_id is not None:
        require(identifier(attempt_id) and attempt_id in grouped)
        selected = grouped[attempt_id]
    else:
        complete = [rows for rows in grouped.values() if sorted(row['page'] for row in rows) == [1, 2]]
        require(len(complete) == 1)
        selected = complete[0]
    selected = sorted(selected, key=lambda row: row['page'])
    require([row['page'] for row in selected] == [1, 2]
            and len({row['input_hash'] for row in selected}) == 1
            and len({row['requested_model'] for row in selected}) == 1
            and len({row['image_sha256'] for row in selected}) == 2
            and len({row['response_id_sha256'] for row in selected}) == 2)
    return selected


def read_private_log():
    path = ROOT / LOG
    before = path.lstat()
    require(path.is_file() and not path.is_symlink() and 0 < before.st_size <= MAXIMUM_LOG_BYTES)
    with path.open('rb') as handle:
        value = handle.read(MAXIMUM_LOG_BYTES + 1)
    after = path.lstat()
    require((before.st_ino, before.st_size, before.st_mtime_ns) == (after.st_ino, after.st_size, after.st_mtime_ns)
            and len(value) == before.st_size)
    return value, {'path': LOG, 'sha256': sha256(value), 'bytes': len(value),
                   'modified_at': datetime.datetime.fromtimestamp(before.st_mtime, datetime.timezone.utc).isoformat()}


def checks_for(proof, events):
    job = proof.get('job') or {}
    source = proof.get('source') or {}
    preparation = proof.get('preparation') or {}
    provider = proof.get('provider') or {}
    references = proof.get('references') or {}
    draft = proof.get('draft') or {}
    role = draft.get('role_fixture_checks') or {}
    outbox = proof.get('outbox') or []
    attempts = job.get('stage_attempts') or {}
    return {
        'fixed_completed_job': proof.get('query_role') == 'postgres' and proof.get('database') == 'postgres' and proof.get('target_count') == 1
            and job.get('id') == JOB and job.get('workspace_id') == WORKSPACE and job.get('project_id') == PROJECT and job.get('status') == 'succeeded',
        'actual_three_stage_n8n_path': sorted(item.get('stage', '') for item in job.get('completed_stages') or []) == sorted(STAGES)
            and set(attempts) == set(STAGES) and all(type(value) is int and 1 <= value <= 3 for value in attempts.values())
            and identifier(job.get('n8n_execution_id')) and set(item.get('stage') for item in outbox) == set(STAGES)
            and all(item.get('status') == 'delivered' and item.get('input_hash_matches') is True for item in outbox),
        'exact_ready_original': source.get('asset_id') == ASSET and source.get('status') == 'ready' and source.get('mime_type') == 'application/pdf'
            and source.get('size_bytes') == SOURCE_BYTES and source.get('sha256') == SOURCE_SHA256 and source.get('fixed_fixture_hash_matches') is True
            and source.get('frozen_source_matches') is True and source.get('private_path_bound') is True,
        'honest_private_vision_preparation': preparation.get('method') == 'pdf_vision' and preparation.get('pages') == [1, 2]
            and preparation.get('ready_derivative_matches_exact_json') is True and preparation.get('derivative_path_bound') is True
            and preparation.get('original_asset_and_hash_bound') is True and preparation.get('arabic_preserved') is True
            and digest(preparation.get('derivative_sha256')) and preparation.get('derivative_sha256') == preparation.get('private_json_sha256'),
        'ocr_receipts_match_committed_preparation': len(events) == 2 and all(row['attempt_id'] == preparation.get('attempt_id') and row['input_hash'] == job.get('input_sha256')
            and row['requested_model'] == provider.get('requested_model') for row in events),
        'real_extraction_provider_metadata': provider.get('provider') == 'openai' and provider.get('sdk_version') == '7.45.1'
            and provider.get('response_reference_present') is True and provider.get('frozen_model_matches') is True and provider.get('input_hash_matches') is True
            and isinstance(provider.get('usage'), dict) and count(provider['usage'].get('total_tokens')) and provider['usage']['total_tokens'] > 0,
        'actual_source_evidence_grounded': type(references.get('count')) is int and references['count'] > 0 and references.get('all_grounded') is True
            and all(row.get('asset_id') == ASSET and row.get('grounded') is True for row in references.get('locators') or [])
            and all(page in (1, 2) or page is None for page in references.get('pages') or []),
        'saved_draft_and_pending_slots': draft.get('current_job_is_target') is True and draft.get('extraction_origin_is_target') is True
            and draft.get('active_roles') == 1 and draft.get('active_slots') == 1 and draft.get('provisional_slots') == 1,
        'synthetic_fixture_facts_and_unknowns': set(role) == ROLE_CHECKS and all(value is True for value in role.values()),
        'protected_original_work_retained': set(proof.get('protected_source') or {}) == {'still_waiting', 'manual_note_retained'}
            and all(value is True for value in proof['protected_source'].values()),
    }


def main():
    require(sys.argv[1:] in ([], ['--log-only']))
    log_only = sys.argv[1:] == ['--log-only']
    log_bytes, log_metadata = read_private_log()
    report = {'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'target': TARGET, 'result': 'unconfirmed',
              'scope': 'Actual image-only synthetic PDF processed through the signed-in app; OCR event projection and fixed read-only canonical metadata.',
              'job_id': JOB, 'workspace_id': WORKSPACE, 'project_id': PROJECT, 'source_asset_id': ASSET, 'source_sha256': SOURCE_SHA256, 'read_only': True,
              'cloud_called_by_capture': False, 'provider_called_by_capture': False, 'storage_http_called_by_capture': False,
              'raw_source_images_provider_bodies_or_credentials_recorded': False, 'log': log_metadata,
              'harness_sha256': sha256((ROOT / 'tools/capture-m02-pdf-vision.py').read_bytes())}
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    label = report['observed_at'].replace(':', '-').replace('.', '-') + '-' + uuid.uuid4().hex[:8]
    try:
        if log_only:
            report.update(result='ocr_metadata_captured', ocr_pages=ocr_events(log_bytes))
        else:
            report['phase'] = 'linked_target'
            require((ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET)
            sql = (ROOT / SQL).read_bytes()
            report['phase'] = 'sql_seal'
            require(sha256(sql) == SQL_SHA256)
            report.update(sql_sha256=SQL_SHA256, cloud_called_by_capture=True)
            report['phase'] = 'query_execution'
            result = call(['db', 'query', '--linked', '--project-ref', TARGET, '--file', str(ROOT / SQL), '--output-format', 'json'])
            if result.returncode != 0:
                report['sql_failure'] = safe_sql_failure(result.stdout, result.stderr)
            require(result.returncode == 0 and len(result.stdout.encode('utf-8')) <= 512 * 1024)
            report['phase'] = 'query_payload'
            rows = json.loads(result.stdout)['rows']
            require(len(rows) == 1 and set(rows[0]) == {'proof'} and isinstance(rows[0]['proof'], dict))
            proof = rows[0]['proof']
            report['phase'] = 'ocr_attempt_binding'
            events = ocr_events(log_bytes, (proof.get('preparation') or {}).get('attempt_id'))
            report['phase'] = 'acceptance_checks'
            checks = checks_for(proof, events)
            report.update(result='passed' if all(checks.values()) else 'failed', checks=checks, proof=proof, ocr_pages=events)
    except Exception:
        report['code'] = 'PDF_VISION_EVIDENCE_UNCONFIRMED'
    finally:
        receipt = EVIDENCE / (label + ('-ocr-only.json' if log_only else '-readback.json'))
        receipt.open('x', encoding='utf-8').write(json.dumps(report, indent=2) + '\n')
        print(json.dumps({'result': report['result'], 'receipt': receipt.relative_to(ROOT).as_posix(), 'checks': report.get('checks', {}),
                          'phase': report.get('phase'), 'sql_failure': report.get('sql_failure'),
                          'cloud_called_by_capture': report['cloud_called_by_capture'], 'raw_private_payloads_recorded': False}))
    return 0 if report['result'] in ('passed', 'ocr_metadata_captured') else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        print('{"result":"unconfirmed","code":"PDF_VISION_EVIDENCE_UNCONFIRMED","raw_diagnostics_suppressed":true}')
        sys.exit(1)
