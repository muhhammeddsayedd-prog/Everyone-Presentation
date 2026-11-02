"""Read only pinned function source; never execute SQL or inspect COPY payloads."""
from pathlib import Path
import hashlib
import re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
MAIN = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
BACKUP = MAIN / '.local/m07-recovery/639da33a-7e90-4471-b0ec-c7a8ff6097ef/backup/metadata.sql'
BACKUP_SHA = '12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c'
BODY_SHAS = {
    'eps.review_snapshot_data': '4d46151993a60d8c6ac9d36e48781fee34c12c3e1dede727ac1ed4d31a953ab7',
    'eps.review_snapshot': 'f0815e014144f1345b4679d96114aab6b358d95df317e3cfe6ac6b59989813cb',
    'public.eps_generate_version': 'b20fef7adc8dee0da91db1508b30d4116855bb3e9be9e881072a7e8d55fcee08',
    'eps.capture_presentation_video_transcripts': 'ed4a3469971fa410078b546b13aa0a875b4867efdda4b134dc729563dd887187',
}


def need(ok):
    if not ok:
        raise ValueError('GENERATION_DATA_REUSE_SOURCE_UNCONFIRMED')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def sources():
    need(BACKUP.is_file() and not BACKUP.is_symlink() and BACKUP.stat().st_nlink == 1)
    need(0 < BACKUP.stat().st_size <= 2 * 1024**2)
    raw = BACKUP.read_bytes()
    need(sha(raw) == BACKUP_SHA)
    text = raw.decode('utf-8').replace('\r\n', '\n')
    result = {}
    for name, expected in BODY_SHAS.items():
        pattern = r'(CREATE FUNCTION ' + re.escape(name) + r'\([^;]*? AS (\$[a-zA-Z0-9_]*\$))(.*?)\2;'
        matches = list(re.finditer(pattern, text, re.S))
        need(len(matches) == 1)
        match = matches[0]
        need(sha(match[3].encode()) == expected)
        result[name] = {'definition': match[0], 'prefix': match[1], 'body': match[3], 'suffix': match[2] + ';'}
    return result


def definition(record, body):
    """The local candidate changes the body and CREATE/REPLACE marker only."""
    return record['prefix'].replace('CREATE FUNCTION ', 'CREATE OR REPLACE FUNCTION ', 1) + body + record['suffix']
