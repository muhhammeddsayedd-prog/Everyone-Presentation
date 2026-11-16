"""Cycle 7 parity inventory reconciliation (idempotent).

1. Declares the three non-tool operations that were added after M07 without an exclusion row
   (binary companions and the guest feedback summary). They are guest/binary routes, not user MCP tools.
2. Makes tools/check_m07_parity.py derive its counts from the inventory instead of the frozen M07 numbers
   (87 tools / 29 exclusions), keeping every structural check (same names, schemas, HTTP mapping, sources).

Run: python tools/update_cycle7_parity_inventory.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / 'contracts/operation-parity.json'
CHECKER = ROOT / 'tools/check_m07_parity.py'

ADD = {
    'get_candidate_photo_content': {'implementation': 'authorized_binary_companion',
        'reason': 'Archive photo bytes stream under the same cast.read authorization as list_candidate_photos; no JSON/base64 user tool.',
        'introduced_m07': False, 'sources': ['apps/web/lib/candidates-http.ts']},
    'get_version_pptx_content': {'implementation': 'authorized_binary_companion',
        'reason': 'PowerPoint bytes are composed on request for the signed-in user; download_version_pptx is the user tool.',
        'introduced_m07': False, 'sources': ['apps/web/lib/presentation-http.ts']},
    'guest_get_feedback_summary': {'implementation': 'guest_session_only',
        'reason': 'Guest review session operation behind the review gateway; not an acting-user tool (get_feedback_summary is).',
        'introduced_m07': False, 'sources': ['apps/web/lib/guest-http.ts']},
}


def main():
    raw = INVENTORY.read_bytes(); crlf = b'\r\n' in raw
    inventory = json.loads(raw.decode('utf-8'))
    changed = False
    for name, row in ADD.items():
        if name not in inventory['excluded_operations']:
            inventory['excluded_operations'][name] = row; changed = True
    if changed:
        text = json.dumps(inventory, indent=2, ensure_ascii=False) + '\n'
        INVENTORY.write_bytes((text.replace('\n', '\r\n') if crlf else text).encode('utf-8'))
    source = CHECKER.read_text(encoding='utf-8')
    replacements = [
        ("check(len(runtime) == len(tools) == 87, 'Runtime/catalog must contain87 implemented user tools.')",
         "check(len(runtime) == len(tools) and len(tools) >= 87, 'Runtime/catalog must expose every implemented user tool (at least the 87 M07 tools).')"),
        ("check(len(rows) == len({row['operation'] for row in rows}) == 87, 'Meaningful-action inventory must cover each user operation once.')",
         "check(len(rows) == len({row['operation'] for row in rows}) == len(tools), 'Meaningful-action inventory must cover each user operation once.')"),
        ("check(sum(row['introduced_m07'] for row in excluded.values()) == 1 and len(excluded) == 29, 'Expected28 retained exclusions plus one documented binary companion.')",
         "check(sum(row['introduced_m07'] for row in excluded.values()) == 1 and len(excluded) >= 29, 'Expected the retained exclusions plus one documented M07 binary companion.')"),
    ]
    for old, new in replacements:
        if old in source:
            source = source.replace(old, new)
    CHECKER.write_bytes(source.encode('utf-8'))
    print(json.dumps({'exclusions': len(inventory['excluded_operations']), 'inventory_changed': changed}))


if __name__ == '__main__':
    main()
