"""Lift only519 exact frozen-body literals into one query-local text row."""
from pathlib import Path
import hashlib
import importlib.util
import json
from pglast import scan

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parents[2]
MAIN = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
PARENT = MAIN / 'development/m07/presentation-generation-factored-release/state.py'
PARENT_SHA = 'e04c10b6f9fe166a3b20d1a6df72b09caf04fa04bd1e4eb4161b658cde0bb3a4'
_stat = PARENT.lstat()
if not (PARENT.is_file() and not PARENT.is_symlink() and PARENT.resolve() == PARENT and _stat.st_nlink == 1 and 0 < _stat.st_size <= 16 * 1024**2 and hashlib.sha256(PARENT.read_bytes()).hexdigest() == PARENT_SHA):
    raise ValueError('GENERATION42_COMPACT_SOURCE_UNCONFIRMED')
_spec = importlib.util.spec_from_file_location('generation42_frozen_factored_Context', PARENT)
parent = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(parent)
for _name in ('TARGET', 'MAXIMUM', 'VERSION', 'MIGRATION', 'MIGRATION_SHA', 'MIGRATION_NAME', 'REMAINING_PROOF_REF', 'REMAINING_AUDIT_REF', 'READY', 'FIXED', 'TARGETS', 'uuid', 'need', 'sha', 'load', 'literal', 'json_sql', 'digest', 'parts', 'module'):
    globals()[_name] = getattr(parent, _name)
RECONCILIATION = {'path': 'tracking/evidence/m07/presentation-generation-factored-release/Root-92b626cc-413-read-only-reconciliation.json', 'sha256': 'f805d1ab0b641a89e84952e1fc838d9f33e4502ecc52ba4c2ac934838fa7ec7e'}


def cte_name(query):
    return 'g42_b_' + sha(query.encode())[:16]


def lift(query, targets):
    need(query.startswith('with ') and len(targets) == 7)
    name = cte_name(query)
    need(name not in query)
    rows = list(targets.items())
    literals = {literal(row['before_body']): index for index, (_, row) in enumerate(rows)}
    need(len(literals) == 7)
    counts = [0] * 7
    spans = []
    char_cursor = byte_cursor = 0
    raw = query.encode('utf8')
    for token in scan(query):
        if token.name != 'SCONST':
            continue
        text = query[token.start:token.end + 1]
        if text not in literals:
            continue
        index = literals[text]
        body = rows[index][1]['before_body']
        need(text[1:-1].replace("''", "'").encode() == body.encode())
        need(sha(body.encode()) == rows[index][1]['before_sha256'])
        need(query[token.end + 1:token.end + 7] == '::text')
        # Scanner offsets are Python character offsets. Map only intervening
        # segments to UTF8 bytes, then assert the exact original encoded token.
        byte_cursor += len(query[char_cursor:token.start].encode('utf8'))
        encoded = text.encode('utf8')
        need(raw[byte_cursor:byte_cursor + len(encoded)] == encoded)
        reference = ('(select b' + str(index) + ' from ' + name + ')').encode()
        spans.append((byte_cursor, byte_cursor + len(encoded), encoded, reference))
        byte_cursor += len(encoded)
        char_cursor = token.end + 1
        counts[index] += 1
    expected = [75 if signature.startswith('eps.capture_presentation_video_english_transcripts(') else 74 for signature, _ in rows]
    need(counts == expected and sum(counts) == 519)
    chunks, generated = [], []
    cursor = out_size = 0
    for start, end, encoded, reference in spans:
        need(cursor <= start and raw[start:end] == encoded)
        gap = raw[cursor:start]
        chunks.extend((gap, reference))
        out_size += len(gap)
        generated.append((out_size, out_size + len(reference), encoded, reference))
        out_size += len(reference)
        cursor = end
    chunks.append(raw[cursor:])
    replaced = b''.join(chunks)
    values = ','.join(literal(row['before_body']) + '::text as b' + str(index) for index, (_, row) in enumerate(rows))
    inserted = (name + ' as materialized(select ' + values + '),').encode()
    compact = b'with ' + inserted + replaced[5:]
    inverse = b'with ' + compact[5 + len(inserted):]
    for start, end, encoded, reference in reversed(generated):
        need(inverse[start:end] == reference)
        inverse = inverse[:start] + encoded + inverse[end:]
    need(inverse == raw)
    return compact.decode('utf8'), {'original_query_sha256': sha(raw), 'compact_query_sha256': sha(compact),
                                  'original_bytes': len(raw), 'compact_bytes': len(compact),
                                  'literal_counts': {name: count for (name, _), count in zip(rows, counts)},
                                  'exact_token_replacements': 519, 'one_typed_materialized_literal_row': True,
                                  'inverse_original_UTF8_byte_equal': True, 'non_token_bytes_and_outer_text_casts_unchanged': True}


class Context(parent.Context):
    def __init__(self, root=MAIN, source=SOURCE):
        super().__init__(root=root, source=source)

    def original_state_sql(self):
        return parent.Context.state_sql(self)

    def state_sql(self):
        return lift(self.original_state_sql(), self.targets)[0]

    def admission(self):
        value = super().admission()
        raw = load(self.root / RECONCILIATION['path'])
        need(sha(raw) == RECONCILIATION['sha256'])
        result = json.loads(raw)
        need(result['result'] == 'observed_not_applied_original41_unchanged' and result['safe_HTTP_status'] == 413)
        need(result['two_fresh_read_only_full_states_equal_original_preimage'] is True and result['new42_history_row_absent'] is True and result['SQL_or_claim_replayed'] is False)
        value['second_413_not_applied_reconciliation'] = RECONCILIATION
        return value

    def source_pins(self):
        pins = super().source_pins()
        pins[str(PARENT)] = PARENT_SHA
        file = self.root / RECONCILIATION['path']
        need(sha(load(file)) == RECONCILIATION['sha256'])
        pins[str(file)] = RECONCILIATION['sha256']
        for file in sorted(HERE.iterdir()):
            if file.is_file():
                pins[str(file)] = sha(load(file))
        return dict(sorted(pins.items()))
