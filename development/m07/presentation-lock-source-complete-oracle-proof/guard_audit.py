"""Offline readonly-effect audit of the actual pinned restored scope call graph."""
from pathlib import Path
import hashlib
import re

METADATA = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio/.local/m07-recovery/639da33a-7e90-4471-b0ec-c7a8ff6097ef/backup/metadata.sql')
METADATA_SHA = '12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c'


def build():
    raw = METADATA.read_bytes()
    if hashlib.sha256(raw).hexdigest() != METADATA_SHA:
        raise ValueError('COMPLETE_ORACLE_GUARD_METADATA_UNCONFIRMED')
    text = raw.decode('utf8')
    queue = ['eps.presentation_scope']
    found = {}
    while queue:
        name = queue.pop()
        if name in found:
            continue
        matches = list(re.finditer(r'^CREATE FUNCTION ' + re.escape(name) + r'\(', text, re.M))
        if len(matches) != 1:
            raise ValueError('COMPLETE_ORACLE_GUARD_DEFINITION_UNCONFIRMED:' + name)
        tail = text[matches[0].start():]
        delimiter = re.search(r'\bAS (\$[A-Za-z0-9_]*\$)', tail)
        if not delimiter:
            raise ValueError('COMPLETE_ORACLE_GUARD_BODY_UNCONFIRMED')
        start = delimiter.end()
        end = tail.find(delimiter[1] + ';', start)
        if end < start:
            raise ValueError('COMPLETE_ORACLE_GUARD_END_UNCONFIRMED')
        body = tail[start:end]
        # Never emit source or string literals. Reject dynamic statements too.
        clean = re.sub(r"'(?:''|[^'])*'", "''", body)
        clean = re.sub(r'--[^\n]*|/\*.*?\*/', '', clean, flags=re.S)
        effect = re.search(r'\b(?:insert|update|delete|merge|truncate|create|alter|drop|grant|revoke|lock|execute|call|set_config)\b|\bfor\s+(?:no\s+key\s+update|key\s+share|share)\b', clean, re.I)
        if effect:
            raise ValueError('COMPLETE_ORACLE_GUARD_EFFECT_REQUIRES_REVIEW:' + name + ':' + effect[0])
        callees = sorted(set(re.findall(r'\b((?:eps|auth|public)\.[A-Za-z0-9_]+)\s*\(', clean)))
        found[name] = {'body_sha256': hashlib.sha256(body.encode()).hexdigest(), 'readonly_effect_tokens_absent': True, 'clock_timestamp_calls': len(re.findall(r'\bclock_timestamp\s*\(', clean, re.I)), 'callees': callees}
        queue.extend(callees)
    if sum(item['clock_timestamp_calls'] for item in found.values()) == 0:
        raise ValueError('COMPLETE_ORACLE_CURRENT_CLOCK_CHECK_UNCONFIRMED')
    return {'metadata_sha256': METADATA_SHA, 'root': 'eps.presentation_scope(uuid,boolean)', 'write_true_is_existing_generate_caller_scope_not_DML': True, 'functions': found, 'raw_source_printed_or_copied': False}
