#!/usr/bin/env python3
"""Create a deterministic-content archive and SHA-256 file inventory."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
manifest = ROOT / "MANIFEST.json"
files = sorted(p for p in ROOT.rglob("*") if p.is_file() and p != manifest and "__pycache__" not in p.parts and p.suffix != ".pyc")
inventory = {"pack": "Everyone Presentation Studio", "version": "1.0", "date": "2026-10-27", "status": "Specification only; implementation not started", "files": [{"path": p.relative_to(ROOT).as_posix(), "bytes": p.stat().st_size, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]}
manifest.write_text(json.dumps(inventory, indent=2) + "\n")
archive = ROOT.parent / "Everyone-Presentation-Studio-Codex-Development-Pack.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for p in sorted(files + [manifest]):
        z.write(p, f"{ROOT.name}/{p.relative_to(ROOT).as_posix()}")
with zipfile.ZipFile(archive) as z:
    error = z.testzip()
    if error:
        raise RuntimeError(f"Archive failed integrity check: {error}")
print(json.dumps({"archive": str(archive), "files": len(files) + 1, "archive_bytes": archive.stat().st_size, "uncompressed_bytes": sum(p.stat().st_size for p in files + [manifest])}))
