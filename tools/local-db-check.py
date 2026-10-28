"""Focused negative target-guard checks; no Docker/cloud/process mutations."""

import importlib.util
import json
import os
from pathlib import Path
import tempfile
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("eps_local_db", Path(__file__).with_name("local-db.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
checks = []


def rejects(code):
    try:
        module.guard()
    except module.LocalTargetError as error:
        assert str(error) == code, str(error)
        return
    raise AssertionError("Guard accepted an unsafe target")


source_config = (module.ROOT / "supabase" / "config.toml").read_text(encoding="utf-8")
with tempfile.TemporaryDirectory(prefix="eps-local-db-guard-") as temporary:
    fixture_root = Path(temporary)
    (fixture_root / "supabase" / ".temp").mkdir(parents=True)
    (fixture_root / "supabase" / "config.toml").write_text(source_config, encoding="utf-8")
    with patch.object(module, "ROOT", fixture_root):
        assert module.guard()["project_id"] == "eps-local-dev"
        checks.append("expected_local_configuration_accepted")
        with patch.dict(os.environ, {"DATABASE_URL": "postgresql://synthetic.invalid:5432/example"}):
            rejects("NON_LOOPBACK_PROVIDER_CONFIGURATION_PRESENT")
        checks.append("non_loopback_database_denied")
        (fixture_root / "supabase" / ".temp" / "project-ref").write_text("synthetic-cloud-link", encoding="utf-8")
        rejects("CLOUD_LINK_METADATA_PRESENT")
        checks.append("linked_cloud_metadata_denied")
    # A separate fresh fixture verifies identity without removing a path in-place.
with tempfile.TemporaryDirectory(prefix="eps-local-db-identity-") as temporary:
    fixture_root = Path(temporary)
    (fixture_root / "supabase").mkdir()
    (fixture_root / "supabase" / "config.toml").write_text(
        source_config.replace('project_id = "eps-local-dev"', 'project_id = "unrelated-project"'),
        encoding="utf-8",
    )
    with patch.object(module, "ROOT", fixture_root):
        rejects("UNEXPECTED_LOCAL_PROJECT_OR_PORT")
        checks.append("different_project_denied")

print(json.dumps({"status": "PASS", "checks": checks, "scope": "Local target guard only"}, indent=2))
