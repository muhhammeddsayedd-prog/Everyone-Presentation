"""Assemble four local candidate definitions in RAM; no migration or SQL runner."""
from pathlib import Path
import importlib.util
import json

HERE = Path(__file__).resolve().parent
ENTRY_ENABLED = False


def module(name):
    spec = importlib.util.spec_from_file_location('generation_data_reuse_' + name, HERE / (name + '.py'))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def build():
    source, review, capture = module('source'), module('review'), module('capture')
    records = source.sources()
    transforms = {
        'eps.review_snapshot_data': review.patch_data_body,
        'eps.review_snapshot': review.patch_wrapper_body,
        'public.eps_generate_version': capture.patch_generate_body,
        'eps.capture_presentation_video_transcripts': capture.patch_raw_body,
    }
    result = []
    for name, transform in transforms.items():
        record = records[name]
        body = transform(record['body'])
        source.need(body != record['body'])
        result.append({
            'name': name, 'before_body_sha256': source.sha(record['body'].encode()),
            'after_body_sha256': source.sha(body.encode()),
            'before': source.definition(record, record['body']),
            'after': source.definition(record, body),
        })
    return result


if __name__ == '__main__':
    if not ENTRY_ENABLED:
        raise SystemExit('GENERATION_DATA_REUSE_ASSEMBLY_DISABLED')
    print(json.dumps({'source_only': True, 'SQL_executed': False, 'bodies': [
        {key: value for key, value in item.items() if key not in ['before', 'after']} for item in build()
    ]}))
