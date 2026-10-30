"""Create only fixed live-inspection output files with owner/SYSTEM access."""
import hashlib
import json
import os
from pathlib import Path
import re
import sys

from provision_logo_verifier import ROOT, WindowsPrivateFiles, safe_path

MAXIMUM = 8 * 1024 * 1024
PATTERN = re.compile(r'\.local/m06-live/inspections/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}\.[0-9]{3}Z/(?:[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}-[1-9][0-9]{0,3}\.png|receipt\.json)')


def main():
    if len(sys.argv) == 3 and sys.argv[1] == '--verify':
        value = sys.argv[2]
        if not re.fullmatch(r'\.local/m06-live/(?:inspection-intent\.json|(?:[A-Za-z0-9_-]+/)*version-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.snapshot\.json)', value):
            raise ValueError('M06_LIVE_PRIVATE_READ_PATH_INVALID')
        file = ROOT / Path(value)
        safe_path(file)
        WindowsPrivateFiles().verify(file)
        print(json.dumps({'verified': True, 'owner_system_only': True}))
        return
    if len(sys.argv) != 2 or not PATTERN.fullmatch(sys.argv[1]):
        raise ValueError('M06_LIVE_PRIVATE_PATH_INVALID')
    data = sys.stdin.buffer.read(MAXIMUM + 1)
    if not 0 < len(data) <= MAXIMUM:
        raise ValueError('M06_LIVE_PRIVATE_BYTES_INVALID')
    destination = ROOT / Path(sys.argv[1])
    if destination.suffix == '.png':
        if data[:8] != b'\x89PNG\r\n\x1a\n' or len(data) < 24 or not 0 < int.from_bytes(data[16:20], 'big') <= 2000 or not 0 < int.from_bytes(data[20:24], 'big') <= 2000:
            raise ValueError('M06_LIVE_PRIVATE_PNG_INVALID')
    else:
        if not isinstance(json.loads(data), dict):
            raise ValueError('M06_LIVE_PRIVATE_RECEIPT_INVALID')
    safe_path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    safe_path(destination)
    security = WindowsPrivateFiles()
    with security.create(destination) as handle:
        security.verify_open(handle)
        handle.write(data)
        handle.flush()
        os.fsync(handle.fileno())
        security.verify_open(handle)
        handle.seek(0)
        if handle.read() != data:
            raise ValueError('M06_LIVE_PRIVATE_READBACK_INVALID')
    security.verify(destination)
    print(json.dumps({'written': True, 'owner_system_only': True, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        sys.stderr.write('M06 live private output creation stopped; no document content was logged.\n')
        sys.exit(1)
