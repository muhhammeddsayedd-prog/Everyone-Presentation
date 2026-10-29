"""Fixed read-only before/after metadata observer; no credentials or text loaded.

Run only when root requests a capture, with the existing project venv. Persisted
provider metadata is not a billing ledger; absent usage does not prove no call.
"""
import datetime
import hashlib
import json
import re
import sys
import uuid
from release_foundation import ROOT, TARGET, call

SQL = 'tools/sql/specs-protection-readback.sql'
SQL_SHA256 = '7fe4ba0729bf101d0b153d8e6feeaec698abaa240ba76af423df1ad1dc340c4f'
CLI_SHA256 = '02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751'
WORKSPACE = '098d5b48-42a3-475b-b562-735c9eafce80'
PROJECT = '4b70c8ce-18bd-4a8c-b5a9-bc1156c06463'
SPEC = '73a1a500-acfe-48cc-91ba-53a83b895118'
VERSIONS = ['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702',
            '20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038']
TOP = set('query_role database versions workspace_id project_id workspace spec roles slots jobs uploads'.split())
FIELDS = TOP | set(('spec_id row_version draft_revision source_row_version source_asset_id processing_job_id source_extraction_job_id '
 'source_text_sha256 general_instructions_sha256 clarifications_sha256 source_extraction_sha256 role_id archived sort_order headcount source_job_id '
 'name_sha256 requirements_sha256 source_role_sha256 evidence_sha256 slot_id ordinal provisional label_sha256 job_id status stage '
 'current_attempt_id error_code stage_attempts completed_stages provider_usage metadata_rows input_tokens output_tokens total_tokens '
 'prepare_document extract_specs apply_specs created_at updated_at upload_id asset_id asset_status reservation_revision spec_row_version '
 'mime_type expected_size_bytes expected_sha256 stored_sha256 expires_at completed_at').split())
ENUMS = set(('postgres queued running waiting_for_input succeeded failed cancelled open completed uploading ready quarantined archived '
 'prepare_document extract_specs apply_specs INPUT_CHANGED INPUT_HASH_MISMATCH RESULT_INVALID DEPENDENCY_UNAVAILABLE SOURCE_UNREADABLE '
 'RETRY_EXHAUSTED JOB_CANCELLED STAGE_FAILED DOCUMENT_VISION_REQUIRED UNRECOGNIZED').split()) | {
 'application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain'}

def require(value):
    if not value: raise ValueError('SPECS_PROTECTION_CAPTURE_UNCONFIRMED')

def sha(value):
    return hashlib.sha256(value).hexdigest()

def validate(value):
    require(isinstance(value, dict) and set(value) == TOP and value['query_role'] == value['database'] == 'postgres'
            and value['workspace_id'] == WORKSPACE and value['project_id'] == PROJECT and value['versions'] == VERSIONS
            and isinstance(value['spec'], dict) and value['spec'].get('spec_id') == SPEC)
    for field in ('roles','slots','jobs','uploads'): require(isinstance(value[field], list) and len(value[field]) <= 1000)
    def walk(item, key='', depth=0):
        require(depth <= 10)
        if isinstance(item, dict):
            require(set(item) <= FIELDS)
            for name, child in item.items(): walk(child, name, depth+1)
        elif isinstance(item, list):
            require(len(item) <= 1000)
            for child in item: walk(child, key, depth+1)
        elif item is None or type(item) is bool: return
        elif type(item) is int: require(0 <= item <= 9007199254740991)
        elif isinstance(item, str):
            if key.endswith('_sha256'): require(re.fullmatch(r'[a-f0-9]{64}', item))
            elif key.endswith('_id'): require(re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', item))
            elif key.endswith('_at'): require(datetime.datetime.fromisoformat(item.replace('Z','+00:00')).tzinfo is not None)
            elif key == 'versions': require(item in VERSIONS)
            else: require(item in ENUMS)
        else: require(False)
    walk(value)
    return value

def main():
    require(len(sys.argv) == 1 and SQL_SHA256)
    require((ROOT/'supabase/.temp/project-ref').read_text().strip() == TARGET)
    source = ROOT/SQL
    require(source.resolve() == source and sha(source.read_bytes()) == SQL_SHA256
            and sha((ROOT/'tools/release_foundation.py').read_bytes()) == CLI_SHA256)
    directory = ROOT/'tracking/evidence/m02/specs-protection'; directory.mkdir(parents=True, exist_ok=True)
    label = datetime.datetime.now(datetime.timezone.utc).isoformat().replace(':','-').replace('.','-') + '-' + uuid.uuid4().hex[:8]
    harness = (ROOT/'tools/capture-specs-protection.py').read_bytes()
    for suffix, data in (('-query.sql',source.read_bytes()),('-harness.source.py',harness)):
        with (directory/(label+suffix)).open('xb') as file: file.write(data)
    report = {'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':TARGET,'result':'unconfirmed','read_only':True,
              'scope':'Fixed canonical protection metadata only; compare captures separately. No service/provider byte acceptance.',
              'sql_sha256':SQL_SHA256,'harness_sha256':sha(harness),'private_text_or_credentials_returned':False,
              'provider_called':False,'storage_http_called':False,'mutations_requested':False}
    try:
        result = call(['db','query','--linked','--project-ref',TARGET,'--file',str(source),'--output-format','json'])
        require(result.returncode == 0 and len(result.stdout.encode('utf-8')) <= 2*1024*1024)
        rows = json.loads(result.stdout)['rows']; require(len(rows) == 1 and set(rows[0]) == {'specs_protection'})
        report.update(result='captured',observed=validate(rows[0]['specs_protection']))
    except Exception: report['code'] = 'SPECS_PROTECTION_CAPTURE_UNCONFIRMED'
    finally:
        receipt = directory/(label+'-metadata.json')
        with receipt.open('x',encoding='utf-8') as file: json.dump(report,file,indent=2); file.write('\n')
        print(json.dumps({'result':report['result'],'receipt':receipt.relative_to(ROOT).as_posix(),'private_text_or_credentials_returned':False}))
    return 0 if report['result'] == 'captured' else 1

if __name__ == '__main__':
    try: sys.exit(main())
    except Exception:
        print('{"result":"unconfirmed","code":"SPECS_PROTECTION_CAPTURE_UNCONFIRMED","raw_diagnostics_suppressed":true}')
        sys.exit(1)
