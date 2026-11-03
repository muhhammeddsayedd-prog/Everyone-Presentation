"""One raw-body substitution over frozen ee38; no new parser/transport/profile."""
from pathlib import Path
import hashlib
import importlib.util
import json

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
NAMESPACE='presentation-generation-raw-companion-stage-diagnostic'
PREVIOUS_NAMESPACE='presentation-generation-pin-batch-stage-diagnostic'
OLD=HERE.parent/PREVIOUS_NAMESPACE
PIN_FILE=HERE.parent/'presentation-raw-companion-batch/candidate.py'
RAW_BEFORE='afe33691e2bb1dad42999b49c8c5ba9d583d68bfc6cced60bfbea0adadc37dd7'
RAW_AFTER='f2229b303a83d7c9ca053e3c0f7e65ec3472b0cbe3b624aad4ff1a1e4af1c4d5'
PINS={
 'README.md':'b11ead01163e81818d5f9a5bdda218cfdb5a91e280f4a224ea56f70146398598', 'admit.mjs':'c4cb662279a50bf5b09af65afb996286cee22865eb2b59db548f9ba5c56fe820','compiler.py':'afa59e38cdc097161255ab7d52a92d1742b45c5cae7a211b09ec9819e16823ca','entry.mjs':'3b688b82de442dae4e939804a8d8610dba0bba56c153e8602730fdd2188992b4','projection.py':'0fcf9da23c659bb7ddb77c56efcd35e1fb1fa03d9cbc02bdd98ad7ee4e66bc1e','test_wrapper.py':'6438e30e204c222dd602a270f745e3aa0e1c6f34547a44fe846f1229290bbe56','wrapper.test.mjs':'e597c57cf95ac7abc96ebd0f07e1081efd6ada846bce8f57bdaa5143af589d50',
}
CALLBACK_EDITS=[('candidate_aa1_pinbatch_four_body_identity_verified=true','candidate_aa1_GEN41fe_rawf222_identity_verified=true'),('pinbatch374_performance_failure_remains_open=true','first633_performance_failure_remains_open=true')]


def sha(raw):return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:raise ValueError('RAW_BATCH_STAGE_SOURCE_UNCONFIRMED')


def load(name,file):
    spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value


def frozen():
    for name,digest in PINS.items():
        file=OLD/name;info=file.lstat();need(file.is_file()and not file.is_symlink()and info.st_nlink==1 and sha(file.read_bytes())==digest)
    load('raw_stage_old_projection',OLD/'projection.py').frozen()


def previous():
    frozen();return load('raw_stage_frozen_projection',OLD/'projection.py')


def pin_candidate():
    return load('raw_stage_sealed_raw_candidate',PIN_FILE)


def instrumented_bodies():
    rows,_=previous().instrumented_bodies();candidate=pin_candidate();record=candidate.build()
    for row in rows:
        if row['name']=='eps.capture_presentation_video_transcripts':
            need(row['after_body_sha256']==RAW_BEFORE and row['after']==record['before'])
            row.update(after=record['after'],current_candidate_body_sha256=RAW_AFTER,after_body_sha256=RAW_AFTER)
            # Raw is uninstrumented; the same five notice-bearing functions/lines remain.
            need(row['instrumented']is False)
    return rows,{'only_business_delta_from_ee38':'rawafe_to_f222','raw_before_sha256':RAW_BEFORE,'raw_after_sha256':RAW_AFTER,
                 'GEN_DATA_notices_temporary_map_cases_parser_and_other_three_definitions_unchanged':True,
                 'raw_body_line_count':len(candidate.parts(record['after'])[2].splitlines()),
                 'raw_finite_inverse_byte_equal':record['finite_inverse_byte_equal']}


def project_callback(cases_path):
    before,prior=previous().project_callback(cases_path);source=before
    for a,b in CALLBACK_EDITS:need(source.count(a)==1);source=source.replace(a,b,1)
    inverse=source
    for a,b in reversed(CALLBACK_EDITS):inverse=inverse.replace(b,a,1)
    need(inverse==before)
    return source,{'inverse_byte_equal':True,'frozen_ee38_callback_projection':prior,'callback_SQL_authority_restore_and_one_call_unchanged':True}


def project_entry():
    frozen();before=(OLD/'entry.mjs').read_text(encoding='utf8');source=before.replace(PREVIOUS_NAMESPACE,NAMESPACE).replace('PIN_BATCH_STAGE_DIAG_','RAW_BATCH_STAGE_DIAG_')
    need(source.count(RAW_BEFORE)==1);source=source.replace(RAW_BEFORE,RAW_AFTER,1)
    old_scope='one owned helperaa1 GEN41fe MCP-large8s stage diagnostic: unchanged eeca/d958 bounded NOTICE/private57014 mechanism; pinbatch374 failure remains open; instrumentation cost present, no performance/provider/production acceptance'
    scope='one owned helperaa1 GEN41fe rawf222 MCP-large8s stage diagnostic: frozen ee38 bounded NOTICE/private57014 mechanism; first633 stage remains unknown; instrumentation cost present, no performance/provider/production acceptance'
    need(source.count(old_scope)==1);source=source.replace(old_scope,scope,1)
    inverse=source.replace(scope,old_scope,1).replace(RAW_AFTER,RAW_BEFORE,1).replace(NAMESPACE,PREVIOUS_NAMESPACE).replace('RAW_BATCH_STAGE_DIAG_','PIN_BATCH_STAGE_DIAG_')
    need(inverse==before);return source
