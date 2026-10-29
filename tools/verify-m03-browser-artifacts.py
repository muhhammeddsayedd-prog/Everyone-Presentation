"""Compare root-downloaded files with frozen canonical M03 artifact metadata.

No browser, network, credentials, SQL, provider or application mutation. A byte
match alone does not attest how a file arrived, image quality or factual accuracy.
"""
import datetime, hashlib, json, os, re, stat, sys, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VISION_PATH = 'tracking/evidence/m03/frame-vision-app/2026-10-29T19-12-45-337511Z-5acae3bc.json'
VISION_SHA = 'd0cacb93b838d32e5b141668cc0182ba7cbd5c5f066322b2f0b1436240a1d6f7'
SUPPORT_PATH = 'tracking/evidence/m03/remaining-support-live/2026-10-29T15-20-46-229813Z-9818231d.json'
SUPPORT_SHA = 'b41eaf12bd37b8a93aad49d9faa0612c921ba0eb5e8b866a8346ed580a264ba1'
FRAME_IDS = ['c2d1c6c9-389c-4cf8-9788-0f9fba371a8f', 'f2a60dcd-f319-4472-adab-c3a80d88912d', '26d345e8-e30e-4fa8-b78c-76282c0fc475']
PDF_ID = '092572d3-64ac-4bb5-bfe9-cb39830b850b'
DOCX_ID = '17ffa630-be3d-4be7-a03e-a5f3a6d132f8'
IDS = set(FRAME_IDS) | {PDF_ID, DOCX_ID}
INTENT = ROOT / '.local/m03-close-checks/download-intent.json'
MAXIMUM = 65536

def sha(value): return hashlib.sha256(value).hexdigest()
def require(value):
    if not value: raise ValueError('M03_BROWSER_ARTIFACT_UNCONFIRMED')

def parse_intent(value):
    require(type(value) is dict and set(value) == {'files'})
    rows = value['files']; require(type(rows) is list and 1 <= len(rows) <= 5)
    ids = []
    for row in rows:
        require(type(row) is dict and set(row) == {'asset_id', 'downloaded_path'})
        require(type(row['asset_id']) is str and row['asset_id'] in IDS)
        require(type(row['downloaded_path']) is str and 1 <= len(row['downloaded_path']) <= 600 and not any(ord(char) < 32 for char in row['downloaded_path']))
        ids.append(row['asset_id'])
    require(len(ids) == len(set(ids)))
    return rows

def expected_artifacts(vision, support):
    require(vision['result'] == support['result'] == 'captured')
    require(vision['technical_vision_provider_success'] is True)
    state = vision['state']; selection = state['selection']; source = state['source']
    require(state['job']['id'] == '9a5ddb61-6a9a-4157-b6be-8653cf2eadef' and state['job']['status'] == 'succeeded')
    require(source['asset_id'] == selection['source_asset_id'] == state['application']['source_asset_id'] == '5f8a6d53-0da0-4064-aacf-aea6b9c47c81')
    require(selection['method'] == 'openai_vision' and selection['selected_frame_asset_ids'] == FRAME_IDS)
    require(state['application']['selected_frame_asset_ids'] == FRAME_IDS)
    expected = {}
    for frame in vision['selected_frames']:
        asset = frame['frame_asset_id']; require(asset in FRAME_IDS and asset not in expected)
        expected[asset] = {'asset_id': asset, 'kind': 'frame', 'mime_type': 'image/jpeg',
            **{key: frame[key] for key in ('size_bytes', 'sha256', 'width', 'height', 'timestamp_ms')}}
    require(set(expected) == set(FRAME_IDS))
    require(support['proof']['candidate_id'] == 'b7341092-50c4-49b4-ad5f-a0ceedddebf1')
    for asset, mime in ((PDF_ID, 'application/pdf'), (DOCX_ID, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')):
        rows = [row for row in support['proof']['support'] if row['asset_id'] == asset]; require(len(rows) == 1)
        row = rows[0]
        require(row['archived'] is False and row['asset_status'] == 'ready' and row['upload_status'] == 'completed')
        require(row['mime_type'] == mime and row['stored_object_exists'] is True and row['reservation_matches'] is True)
        expected[asset] = {'asset_id': asset, 'kind': 'support', 'mime_type': mime,
            **{key: row[key] for key in ('size_bytes', 'sha256', 'width', 'height')}, 'timestamp_ms': None}
    for row in expected.values():
        require(type(row['size_bytes']) is int and 1 <= row['size_bytes'] <= MAXIMUM)
        require(type(row['sha256']) is str and re.fullmatch('[a-f0-9]{64}', row['sha256']))
    return expected

def compare_bytes(data, expected):
    require(type(data) is bytes and len(data) == expected['size_bytes'] and sha(data) == expected['sha256'])
    prefixes = {'image/jpeg': b'\xff\xd8', 'application/pdf': b'%PDF-',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': b'PK\x03\x04'}
    require(data.startswith(prefixes[expected['mime_type']]))
    return {**expected, 'bytes_match_canonical': True, 'decoded_or_visually_inspected_by_tool': False}

def identity(info):
    # Windows Python deprecates ctime's creation-time alias. Its path/fd forms
    # can differ; birthtime is the explicit stable creation field there.
    created_or_changed = info.st_birthtime_ns if os.name == 'nt' else info.st_ctime_ns
    return info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, created_or_changed

def read_stable_file(file, maximum):
    before = file.lstat()
    require(stat.S_ISREG(before.st_mode) and not file.is_symlink() and not getattr(before, 'st_file_attributes', 0) & getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 1024))
    require(0 < before.st_size <= maximum)
    descriptor = os.open(file, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_BINARY', 0))
    with os.fdopen(descriptor, 'rb') as handle:
        opened = os.fstat(handle.fileno()); require(identity(before) == identity(opened))
        data = handle.read(maximum + 1); require(len(data) == before.st_size and len(data) <= maximum)
        require(identity(opened) == identity(os.fstat(handle.fileno())) == identity(file.lstat()))
    return data

def downloaded_file(name):
    file = Path(name); require(file.is_absolute())
    original = file.lstat(); require(not file.is_symlink() and not getattr(original, 'st_file_attributes', 0) & getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 1024))
    resolved = file.resolve(strict=True)
    allowed = [(Path.home() / 'Downloads').resolve(strict=True), (ROOT / '.local/m03-close-checks').resolve(strict=True)]
    require(any(resolved.is_relative_to(parent) for parent in allowed))
    return resolved

def main():
    require(sys.argv[1:] == [])
    report = {'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'result': 'unconfirmed',
        'scope': 'Local downloaded-file byte comparison with sealed canonical metadata; browser actions must be evidenced separately.',
        'browser_or_network_called': False, 'cloud_or_provider_called': False, 'credentials_loaded': False,
        'browser_download_attested_by_this_tool': False, 'private_paths_or_payloads_recorded': False,
        'image_quality_or_factual_review_claimed': False, 'hosting_deferred': True,
        'tool_sha256': sha(Path(__file__).read_bytes())}
    try:
        sources = {}
        for path, digest in ((VISION_PATH, VISION_SHA), (SUPPORT_PATH, SUPPORT_SHA)):
            data = read_stable_file(ROOT / path, 2 * 1024 * 1024); require(sha(data) == digest); sources[path] = json.loads(data)
        expected = expected_artifacts(sources[VISION_PATH], sources[SUPPORT_PATH])
        intent_bytes = read_stable_file(INTENT, 4096); rows = parse_intent(json.loads(intent_bytes))
        results = []
        for row in rows:
            file = downloaded_file(row['downloaded_path']); data = read_stable_file(file, MAXIMUM)
            results.append(compare_bytes(data, expected[row['asset_id']]))
        require(read_stable_file(INTENT, 4096) == intent_bytes)
        require(sha((ROOT / VISION_PATH).read_bytes()) == VISION_SHA and sha((ROOT / SUPPORT_PATH).read_bytes()) == SUPPORT_SHA)
        matched = {row['asset_id'] for row in results}
        report.update(result='matched', artifacts=results, missing_artifact_ids=sorted(IDS - matched), all_five_bytes_matched=matched == IDS,
            canonical_sources={VISION_PATH: VISION_SHA, SUPPORT_PATH: SUPPORT_SHA})
    except Exception:
        report['code'] = 'M03_BROWSER_ARTIFACT_UNCONFIRMED'
    directory = ROOT / 'tracking/evidence/m03/browser-artifact-bytes'; directory.mkdir(parents=True, exist_ok=True)
    filename = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8] + '.json'
    receipt = directory / filename
    with receipt.open('x', encoding='utf8') as handle: json.dump(report, handle, indent=2); handle.write('\n')
    print(json.dumps({'result': report['result'], 'receipt': receipt.relative_to(ROOT).as_posix(),
        'matched_artifacts': len(report.get('artifacts', [])), 'all_five_bytes_matched': report.get('all_five_bytes_matched', False), 'browser_request_made': False}))
    return 0 if report['result'] == 'matched' else 1

if __name__ == '__main__':
    try: sys.exit(main())
    except Exception: sys.stderr.write('M03 local artifact comparison stopped; private diagnostics suppressed.\n'); sys.exit(1)
