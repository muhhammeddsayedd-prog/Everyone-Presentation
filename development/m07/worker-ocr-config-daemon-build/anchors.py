"""Public source anchors only. Future private profile is deliberately unset."""
from pathlib import Path
import hashlib,importlib.util
MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
OLD=MAIN/'development/m07/worker-compatible-daemon-build'
FROZEN={'build.py':'1409d10ccd1a5e0d48878ab256318ebe3a785d5a90343c57f8b7c771be6d75d0','anchors.py':'591ea939dfb7fd43b999d81db78ab12eaeacc954984a9bb32bd48d51b4f05545'}
PROFILE=None
PROFILE_PATH='.local/worker-ocr-config-daemon-build/build-inputs.json'
PRIVATE='.local/worker-ocr-config-daemon-build'
EVIDENCE='tracking/evidence/m07/worker-ocr-config-daemon-build'
def need(ok):
 if not ok:raise ValueError('OCR_DAEMON_BUILD_REFUSED')
def library():
 for name,h in FROZEN.items():
  p=OLD/name;need(p.is_file()and not p.is_symlink()and p.stat().st_nlink==1 and hashlib.sha256(p.read_bytes()).hexdigest()==h)
 spec=importlib.util.spec_from_file_location('ocr_frozen_compatible_build',OLD/'build.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
