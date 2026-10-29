"""Exclusive owner/SYSTEM files for the authorized disposable local SQL proof.

No existing private configuration is read. Payload travels only over child stdin.
This writer has three fixed artifact names and cannot target an arbitrary path.
"""
import json
import os
import re
import sys
from provision_logo_verifier import ROOT, WindowsPrivateFiles


def main():
    if os.name != 'nt' or len(sys.argv) != 1:
        raise ValueError('unsupported fixture writer')
    raw = sys.stdin.buffer.read(18 * 1024 * 1024 + 1)
    if len(raw) > 18 * 1024 * 1024:
        raise ValueError('fixture payload budget')
    value = json.loads(raw)
    if not isinstance(value, dict) or set(value) != {'run_id', 'file', 'contents'}:
        raise ValueError('fixture envelope')
    if not isinstance(value['run_id'], str) or re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}', value['run_id']) is None:
        raise ValueError('fixture identity')
    limits = {'instance.env': 1024, 'canonical19.sql': 16 * 1024 * 1024, 'diagnostic.json': 2 * 1024 * 1024}
    if value['file'] not in limits or not isinstance(value['contents'], str):
        raise ValueError('fixture artifact')
    data = value['contents'].encode('utf-8')
    if len(data) > limits[value['file']]:
        raise ValueError('fixture content budget')
    directory = ROOT / '.local' / 'm04-main-race' / value['run_id']
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / value['file']
    security = WindowsPrivateFiles()
    with security.create(target) as handle:
        handle.write(data)
        handle.flush()
        os.fsync(handle.fileno())
        security.verify_open(handle)
    security.verify(target)
    print(json.dumps({'protected': True, 'bytes': len(data)}))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Protected M04 fixture artifact could not be created.', file=sys.stderr)
        raise SystemExit(1) from None
