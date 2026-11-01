"""Offline comparison of a retained ASR source to an existing owner name.

Only fixed classifications leave the private inputs. This is a character-level
source comparison, not a speech/translation accuracy classifier or new label.
"""
from pathlib import Path
import datetime
import hashlib
import json
import re
import sys
import unicodedata
import uuid

ROOT = Path(__file__).resolve().parents[3]
PRIVATE = ROOT / '.local/m03-english-component'
PROOF = ROOT / 'tracking/evidence/m03/reviewed-source-readback/2026-10-29T20-17-30-125263Z-6afa02e0.json'
PROOF_SHA = '51b39670ff6493aa1e6efb1f357484e1083681d38a41e421b3f79e19d7b39a76'
SOURCE_SHA = 'ffe461d30d48b32d90f1165627e2d104b6817f61d96a5a4bd9dcd6ff1964fc0a'
EXPECTED = {
    'candidate_id': '25a3c924-7b6c-48e3-88ce-c72e72b99c6d',
    'candidate_media_id': 'f5dff77f-092f-4777-9f56-3bbce4dee57c',
    'source_asset_id': '5f8a6d53-0da0-4064-aacf-aea6b9c47c81',
    'job_id': '9a5ddb61-6a9a-4157-b6be-8653cf2eadef',
    'source_sha256': SOURCE_SHA,
}


def need(condition):
    if not condition:
        raise ValueError('RETAINED_SOURCE_UNCONFIRMED')


def sha(value):
    return hashlib.sha256(value).hexdigest()


def normalized_arabic(text):
    """Canonical spelling differences only; no phonetic/fuzzy equivalence."""
    need(type(text) is str and 0 < len(text) <= 200000)
    value = ''.join(char for char in unicodedata.normalize('NFKD', text)
                    if not unicodedata.combining(char) and char != '\u0640')
    return value.translate(str.maketrans('\u0623\u0625\u0622\u0671', '\u0627' * 4)).casefold()


def comparison(source, expected_arabic_name):
    source = normalized_arabic(source)
    expected = normalized_arabic(expected_arabic_name)
    tokens = re.findall(r'[^\W\d_]+', expected)
    need(1 <= len(tokens) <= 20)
    compact = lambda value: re.sub(r'[\W_]', '', value)
    source_compact = compact(source)
    present = [token in source_compact for token in tokens]
    return {
        'comparison_kind': 'canonical_arabic_characters_not_phonetic_matching',
        'existing_owner_name_token_count': len(tokens),
        'expected_tokens_present_after_compaction': sum(present),
        'expected_tokens_absent_after_compaction': len(tokens) - sum(present),
        'expected_complete_name_present_after_compaction': compact(expected) in source_compact,
        'source_already_differs_from_existing_owner_full_name': not all(present),
        'unmatched_token_is_not_an_english_transliteration_artifact': not all(present),
        'new_translation_error_determined': False,
    }


def private_document(filename):
    path = PRIVATE / filename
    need(path.is_file() and not path.is_symlink() and path.resolve() == path)
    raw = path.read_bytes()
    need(0 < len(raw) <= 1048576)
    return json.loads(raw), raw


def main():
    need(len(sys.argv) == 1)
    source, binding_bytes = private_document('source-binding.json')
    expected, expected_bytes = private_document('owner-confirmed.json')
    # This private file is an investigator's spelling mapping of the already
    # accepted owner key, not a new human listening/label or a source correction.
    mapping, mapping_bytes = private_document('name-comparison-mapping.json')
    need(mapping['basis'] == 'investigator_spelling_mapping_of_existing_owner_key')
    need(mapping['owner_name'] == expected['name'])
    need(type(mapping['expected_arabic_name']) is str)
    proof_bytes = PROOF.read_bytes()
    need(sha(proof_bytes) == PROOF_SHA)
    proof = json.loads(proof_bytes)['confirmation']
    need(proof['effective_reviewed'] is True and proof['owner_key_name_matches'] is True)
    need(proof['source_corrected_field_paths'] == ['facts.name'])
    need(all(proof[key] == value for key, value in EXPECTED.items()))
    need(all(source[key] == EXPECTED[key] for key in ('candidate_media_id', 'source_asset_id', 'source_sha256')))
    need(source['source_job_id'] == EXPECTED['job_id'])
    need(type(source['original_text']) is str and sha(source['original_text'].encode()) == source['original_sha256'])
    checks = comparison(source['original_text'], mapping['expected_arabic_name'])
    need(checks['source_already_differs_from_existing_owner_full_name'])
    need((PRIVATE / 'source-binding.json').read_bytes() == binding_bytes)
    need((PRIVATE / 'owner-confirmed.json').read_bytes() == expected_bytes)
    need((PRIVATE / 'name-comparison-mapping.json').read_bytes() == mapping_bytes)
    receipt = {
        'evidence_kind': 'retained_asr_source_vs_existing_owner_name_comparison',
        'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'case_alias': 'permitted-arabic-introduction-01',
        'source_bound_to_existing_reviewed_proof': True,
        'reviewed_proof_sha256': PROOF_SHA,
        'retained_original_sha256_verified': True,
        'original_source_and_owner_key_unchanged': True,
        'prior_reviewed_name_correction_independently_recorded': True,
        'mapping_basis': mapping['basis'],
        'new_owner_labels_requested': False,
        'previous_english_output_available': False,
        'previous_english_output_wording_determined': False,
        'previous_failed_component_receipt_preserved': True,
        'provider_called': False,
        'cloud_called': False,
        'business_or_reviewed_facts_mutated': False,
        'raw_transcript_name_values_or_scalar_name_hashes_emitted': False,
        'checks': checks,
        'conclusion': 'original_asr_source_name_differs_from_the_corrected_reviewed_name',
        'remedy': 'verify_source_faithful_english_separately_from_preservation_of_reviewed_facts',
        'limitations': 'Cannot recover previous discarded English wording, measure ASR accuracy, or infer a new translation error.',
    }
    directory = ROOT / 'tracking/evidence/m03/english-name-review'
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / (datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + str(uuid.uuid4()) + '.json')
    with path.open('x', encoding='utf8', newline='\n') as stream:
        stream.write(json.dumps(receipt, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'result': receipt['conclusion'], 'receipt': path.relative_to(ROOT).as_posix(), 'provider_called': False}))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('RETAINED_SOURCE_UNCONFIRMED')
        sys.exit(1)
