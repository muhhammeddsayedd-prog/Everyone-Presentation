"""One exact read-only hosted-job observation, after the app reports success.

Consumes a private plan and stores only raw/English transcripts privately. Public
receipts contain bindings, fixed checks and actual provider metadata, no text.
No provider execution, job retry or business mutation is performed.
"""
from pathlib import Path
import datetime
import importlib.util
import json
import re
import sys
import unicodedata
import uuid

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('english_lookup', HERE.parent / 'english-component/lookup.py')
lookup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lookup)
spec = importlib.util.spec_from_file_location('name_review', HERE / 'inspect-retained-source.py')
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)
ROOT, PRIVATE = lookup.ROOT, lookup.PRIVATE


def exact(value, keys):
    lookup.need(type(value) is dict and set(value) == set(keys))


def plan_document():
    plan, raw = review.private_document('controlled-job-plan.json')
    exact(plan, ('job_id', 'candidate_media_id', 'source_asset_id', 'source_sha256'))
    lookup.need(all(type(plan[key]) is str and lookup.UUID.fullmatch(plan[key])
                    for key in ('job_id', 'candidate_media_id', 'source_asset_id')))
    lookup.need(plan['source_sha256'] == lookup.SOURCE_SHA)
    lookup.need(plan['job_id'] != review.EXPECTED['job_id'])
    lookup.need(plan['candidate_media_id'] != review.EXPECTED['candidate_media_id'])
    return plan, raw


def sql_for(plan, retained, proof):
    # Only previously validated UUID/digest/integer inputs enter SQL literals.
    lookup.need(all(lookup.UUID.fullmatch(plan[key]) for key in ('job_id', 'candidate_media_id', 'source_asset_id')))
    lookup.need(lookup.DIGEST.fullmatch(retained['original_sha256']))
    lookup.need(lookup.DIGEST.fullmatch(proof['reviewed_facts_fingerprint']))
    lookup.need(type(proof['candidate_row_version']) is int and 0 < proof['candidate_row_version'] < 9007199254740992)
    return f"""begin read only;
set local statement_timeout='8s';
with matched as (
 select m.*,a.sha256 as video_sha256,j.input_hash as job_input_hash,j.status as job_status,
  j.input#>>'{{configuration,english_transcript_version}}' as frozen_english_version,
  j.input#>>'{{configuration,extraction_model}}' as frozen_extraction_model,
  j.result->>'candidate_id'=m.candidate_id::text as job_result_candidate_bound,
  t.payload#>>'{{original_transcript,original_text}}' is not distinct from m.original_transcript as raw_stage_equal,
  e.payload#>>'{{english_transcript,text}}' is not distinct from m.english_transcript as english_stage_equal,
  e.result_schema as extraction_schema
 from eps.candidate_media m
 join eps.media_assets a on a.id=m.source_asset_id
 join eps.jobs j on j.id=m.source_job_id and j.input_asset_id=a.id and j.kind='candidate_scan'
 join eps.candidate_stage_payloads t on t.job_id=j.id and t.input_hash=j.input_hash and t.stage='transcribe_candidate'
 join eps.candidate_stage_payloads e on e.job_id=j.id and e.input_hash=j.input_hash and e.stage='extract_candidate'
 where j.id='{plan['job_id']}' and m.id='{plan['candidate_media_id']}'
 and a.id='{plan['source_asset_id']}' and a.sha256='{lookup.SOURCE_SHA}'
), preserved as (
 select c.reviewed_facts_fingerprint='{proof['reviewed_facts_fingerprint']}'
  and eps.cast_fingerprint(c.facts,c.field_sources)='{proof['reviewed_facts_fingerprint']}'
  and c.row_version={proof['candidate_row_version']} and eps.cast_is_reviewed(c) as reviewed_facts_preserved,
  encode(sha256(convert_to(m.original_transcript,'UTF8')),'hex')='{retained['original_sha256']}' as retained_raw_preserved,
  m.english_transcript_status='not_captured' and m.english_transcript is null as retained_legacy_cohort_preserved
 from eps.candidates c join eps.candidate_media m on m.candidate_id=c.id
 where c.id='{review.EXPECTED['candidate_id']}' and m.id='{review.EXPECTED['candidate_media_id']}'
 and m.source_job_id='{review.EXPECTED['job_id']}' and m.source_asset_id='{review.EXPECTED['source_asset_id']}'
)
select jsonb_build_object('database',current_database(),'operator',current_user,
 'history_count',(select count(*) from supabase_migrations.schema_migrations),
 'match_count',(select count(*) from matched),
 'source',(select jsonb_build_object('candidate_id',candidate_id,'candidate_media_id',id,'source_job_id',source_job_id,
  'source_asset_id',source_asset_id,'source_sha256',video_sha256,'job_input_hash',job_input_hash,'job_status',job_status,
  'frozen_english_version',frozen_english_version,'frozen_extraction_model',frozen_extraction_model,
  'job_result_candidate_bound',job_result_candidate_bound,'raw_stage_equal',raw_stage_equal,'english_stage_equal',english_stage_equal,
  'extraction_schema',extraction_schema,'original_text',original_transcript,'english_text',english_transcript,
  'english_status',english_transcript_status,'english_source_hash',english_transcript_source_sha256,
  'english_input_hash',english_transcript_input_hash,'english_metadata',english_transcript_metadata) from matched),
 'preservation_count',(select count(*) from preserved),
 'preservation',(select to_jsonb(p)from preserved p)) as controlled_english_observation;
rollback;
"""


def latin_letters_only(value):
    # A conservative Unicode-name script check, not semantic English validation.
    return all(not unicodedata.category(char).startswith('L') or 'LATIN' in unicodedata.name(char, '') for char in value)


def summary(payload, plan):
    rows = payload if type(payload) is list else payload.get('rows') if type(payload) is dict else None
    lookup.need(type(rows) is list and len(rows) == 1)
    exact(rows[0], ('controlled_english_observation',))
    value = rows[0]['controlled_english_observation']
    exact(value, ('database', 'operator', 'history_count', 'match_count', 'source', 'preservation_count', 'preservation'))
    lookup.need(value['database'] == 'postgres' and value['operator'] == 'postgres' and value['history_count'] == 34)
    lookup.need(value['match_count'] == 1 and value['preservation_count'] == 1)
    source = value['source']
    exact(source, ('candidate_id','candidate_media_id','source_job_id','source_asset_id','source_sha256','job_input_hash','job_status',
                  'frozen_english_version','frozen_extraction_model','job_result_candidate_bound','raw_stage_equal','english_stage_equal',
                  'extraction_schema','original_text','english_text','english_status','english_source_hash','english_input_hash','english_metadata'))
    lookup.need(source['source_job_id'] == plan['job_id'] and source['candidate_media_id'] == plan['candidate_media_id']
                and source['source_asset_id'] == plan['source_asset_id'] and source['source_sha256'] == plan['source_sha256'])
    lookup.need(lookup.UUID.fullmatch(source['candidate_id']) and lookup.DIGEST.fullmatch(source['job_input_hash']))
    raw, english = source['original_text'], source['english_text']
    lookup.need(type(raw) is str and 0 < len(raw) <= 200000 and raw.strip())
    lookup.need(type(english) is str and 0 < len(english) <= 200000 and english.strip())
    lookup.need(not any(unicodedata.category(c) == 'Cs' or unicodedata.category(c) == 'Cc' and c not in '\n\r\t' for c in english))
    metadata = source['english_metadata']
    lookup.need(type(metadata) is list and 1 <= len(metadata) <= 64)
    metadata_checks = []
    for item in metadata:
        lookup.need(type(item) is dict)
        required = {'provider','task','sdk_version','requested_model','resolved_model','request_id','response_id','prompt_version','input_sha256','usage'}
        lookup.need(required <= set(item) <= required | {'prompt_sha256','schema_sha256'})
        lookup.need(all(type(item[key]) is str and lookup.DIGEST.fullmatch(item[key])
                        for key in ('input_sha256','prompt_sha256','schema_sha256') if key in item))
        metadata_checks.append(item.get('provider') == 'openai' and item.get('task') == 'transcript_english'
            and item.get('sdk_version') == '7.45.1' and item.get('prompt_version') == 'transcript-english.v1'
            and item.get('requested_model') == source['frozen_extraction_model']
            and all(type(item.get(key)) is str and re.fullmatch(r'[A-Za-z0-9._:-]{1,200}', item[key]) for key in ('request_id','response_id','resolved_model'))
            and type(item.get('usage')) is dict and set(item['usage']) == {'input_tokens','output_tokens','total_tokens'}
            and all(type(count) is int and count >= 0 for count in item['usage'].values()))
        # Wrong fixed labels are not merely false checks: do not publish their
        # untrusted values through a metadata receipt on the failure path.
        lookup.need(metadata_checks[-1])
    preservation = value['preservation']
    exact(preservation, ('reviewed_facts_preserved','retained_raw_preserved','retained_legacy_cohort_preserved'))
    checks = {
        'exact_new_job_media_source_binding': True,
        'job_succeeded': source['job_status'] == 'succeeded',
        'job_frozen_english_version_enabled': source['frozen_english_version'] == '1.0',
        'extraction_schema_v2': source['extraction_schema'] == 'candidate-extraction-stage.v2',
        'job_result_candidate_bound': source['job_result_candidate_bound'] is True,
        'persisted_raw_equals_job_stage': source['raw_stage_equal'] is True,
        'persisted_english_equals_job_stage': source['english_stage_equal'] is True,
        'english_available': source['english_status'] == 'available',
        'english_has_latin_letters_only': latin_letters_only(english),
        'english_source_sha_matches_exact_raw': source['english_source_hash'] == lookup.sha(raw.encode('utf8')),
        'english_input_hash_matches_job': source['english_input_hash'] == source['job_input_hash'],
        'actual_chunk_provider_metadata_present': all(metadata_checks),
        **{key: value is True for key, value in preservation.items()},
    }
    return source, checks


def main():
    lookup.need(len(sys.argv) == 1 and (ROOT / 'supabase/.temp/project-ref').read_text().strip() == lookup.TARGET)
    plan, plan_bytes = plan_document()
    retained, binding_bytes = review.private_document('source-binding.json')
    proof_bytes = review.PROOF.read_bytes()
    lookup.need(lookup.sha(proof_bytes) == review.PROOF_SHA)
    proof = json.loads(proof_bytes)['confirmation']
    lookup.need(proof['effective_reviewed'] is True and all(proof[key] == value for key, value in review.EXPECTED.items()))
    sql = sql_for(plan, retained, proof).encode('utf8')
    lookup.need(sql.startswith(b'begin read only;') and sql.rstrip().endswith(b'rollback;'))
    lookup.need(not re.search(rb'(?im)^\s*(?:commit|insert|update|delete|create|alter|drop|grant|revoke)\b', sql))
    run_id = str(uuid.uuid4())
    observed = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with (PRIVATE / ('controlled-job-' + plan['job_id'] + '.claim.json')).open('x', encoding='utf8') as stream:
        json.dump({'run_id':run_id,'observed_at':observed,'sql_sha256':lookup.sha(sql),'automatic_retry':False}, stream)
    private = PRIVATE / run_id
    private.mkdir()
    snapshot = (private / 'controlled-read.sql').resolve()
    with snapshot.open('xb') as stream:
        stream.write(sql)
    lookup.snapshot_ok(snapshot, lookup.sha(sql))
    command = ['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',lookup.TARGET,'--file',str(snapshot),
               '--output-format','json','--workdir',str(ROOT)]
    code, timeout, overflow, stdout, _stderr = lookup.bounded(command)
    lookup.snapshot_ok(snapshot, lookup.sha(sql))
    receipt = {'evidence_kind':'actual_controlled_english_job_read_only_observation','observed_at':observed,'run_id':run_id,
               'target':lookup.TARGET,'job_id':plan['job_id'],'candidate_media_id':plan['candidate_media_id'],'source_asset_id':plan['source_asset_id'],
               'read_only_rollback':True,'automatic_retry':False,'provider_called_by_observer':False,'raw_cli_persisted':False,
               'transcript_text_only_in_private_file':True,'exit_code':code,'timed_out':timeout,'output_limit_exceeded':overflow,
               'persistence_checks_passed':False,'semantic_source_faithfulness_accepted':False,'app_guest_or_version_acceptance':False}
    try:
        lookup.need(code == 0 and not timeout and not overflow)
        source, checks = summary(json.loads(stdout), plan)
        lookup.need((PRIVATE / 'controlled-job-plan.json').read_bytes() == plan_bytes
                    and (PRIVATE / 'source-binding.json').read_bytes() == binding_bytes)
        with (private / 'transcripts.json').open('x', encoding='utf8', newline='\n') as stream:
            json.dump(source, stream, ensure_ascii=False)
        receipt.update({'checks':checks,'persistence_checks_passed':all(checks.values()),'metadata':source['english_metadata'],
                        'semantic_inspection':'Private raw/English pair requires source-faithfulness assessment; owner-name equality is not the gate.'})
    except Exception:
        receipt['safe_error_code'] = 'CONTROLLED_ENGLISH_OBSERVATION_UNCONFIRMED'
    out = ROOT / 'tracking/evidence/m03/english-name-review'
    out.mkdir(parents=True, exist_ok=True)
    path = out / (datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + run_id + '-controlled-job.json')
    with path.open('x', encoding='utf8', newline='\n') as stream:
        stream.write(json.dumps(receipt, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'persistence_checks_passed':receipt['persistence_checks_passed'],'receipt':path.relative_to(ROOT).as_posix(),
                      'private_transcript_file':(private/'transcripts.json').relative_to(ROOT).as_posix(),'provider_called_by_observer':False}))
    lookup.need(receipt['persistence_checks_passed'])


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('CONTROLLED_ENGLISH_OBSERVATION_UNCONFIRMED')
        sys.exit(1)
