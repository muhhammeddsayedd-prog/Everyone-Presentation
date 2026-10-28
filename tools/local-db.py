"""Guard and probe only this project's disposable local Supabase runtime.

No reset, seed, cloud connection, login, linking or application migration is exposed.
CLI output is captured because `start`/`status` can contain local credentials.
Source: https://supabase.com/docs/guides/local-development
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import tomllib
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
PROJECT = "eps-local-dev"
NETWORK = "eps-local-dev-loopback"
CONTAINER = "supabase_db_eps-local-dev"
CLI = "supabase@2.122.0"


class LocalTargetError(Exception):
    pass


def run(args: list[str], *, timeout: int = 30) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args, cwd=ROOT, text=True, encoding="utf-8", errors="replace",
        capture_output=True, timeout=timeout, check=False,
    )


def docker_json(args: list[str]) -> object:
    result = run(["docker", *args])
    if result.returncode:
        raise LocalTargetError("DOCKER_INSPECTION_FAILED")
    return json.loads(result.stdout)


def guard() -> dict[str, object]:
    config_path = ROOT / "supabase" / "config.toml"
    config = tomllib.loads(config_path.read_text(encoding="utf-8"))
    if config.get("project_id") != PROJECT or config.get("db", {}).get("port") != 55432:
        raise LocalTargetError("UNEXPECTED_LOCAL_PROJECT_OR_PORT")
    if config.get("db", {}).get("migrations", {}).get("enabled") is not False:
        raise LocalTargetError("MIGRATIONS_MUST_REMAIN_DISABLED_UNTIL_BASELINE_DISCOVERY")
    if config.get("db", {}).get("seed", {}).get("enabled") is not False:
        raise LocalTargetError("SEED_MUST_REMAIN_DISABLED")
    if (ROOT / "supabase" / ".temp" / "project-ref").exists():
        raise LocalTargetError("CLOUD_LINK_METADATA_PRESENT")
    for name in ("DATABASE_URL", "SUPABASE_URL"):
        value = os.environ.get(name)
        if value:
            parsed = urlsplit(value)
            if parsed.hostname not in ("127.0.0.1", "localhost", "::1"):
                raise LocalTargetError("NON_LOOPBACK_PROVIDER_CONFIGURATION_PRESENT")
    return {
        "project_id": PROJECT, "config": "supabase/config.toml",
        "database_host": "127.0.0.1", "database_port": 55432,
        "network": NETWORK, "migrations_enabled": False, "seed_enabled": False,
        "scope": "Local empty Supabase runtime only; central schema remains unknown",
    }


def ensure_network() -> None:
    inspected = run(["docker", "network", "inspect", NETWORK])
    if inspected.returncode:
        created = run([
            "docker", "network", "create", "--label", f"eps.local.project={PROJECT}",
            "--opt", "com.docker.network.bridge.host_binding_ipv4=127.0.0.1", NETWORK,
        ])
        if created.returncode:
            raise LocalTargetError("LOCAL_NETWORK_CREATION_FAILED")
    network = docker_json(["network", "inspect", NETWORK])[0]
    if network.get("Labels", {}).get("eps.local.project") != PROJECT:
        raise LocalTargetError("LOCAL_NETWORK_OWNERSHIP_UNVERIFIED")
    if network.get("Options", {}).get("com.docker.network.bridge.host_binding_ipv4") != "127.0.0.1":
        raise LocalTargetError("LOCAL_NETWORK_NOT_LOOPBACK_BOUND")


def check_container_owner(container: dict[str, object]) -> None:
    if container.get("Name", "").lstrip("/") != CONTAINER:
        raise LocalTargetError("UNEXPECTED_CONTAINER")
    labels = container.get("Config", {}).get("Labels", {})
    if labels.get("com.supabase.cli.project") != PROJECT:
        raise LocalTargetError("CONTAINER_OWNERSHIP_UNVERIFIED")
    workdir = labels.get("com.supabase.cli.workdir")
    if not workdir or Path(workdir).resolve() != ROOT:
        raise LocalTargetError("CONTAINER_WORKSPACE_OWNERSHIP_UNVERIFIED")


def stop_owned_runtime() -> None:
    inspected = run(["docker", "inspect", CONTAINER])
    if inspected.returncode:
        return
    check_container_owner(json.loads(inspected.stdout)[0])
    cli_runner = "npx.cmd" if os.name == "nt" else "npx"
    stopped = run([
        cli_runner, "--yes", CLI, "stop", "--project-id", PROJECT,
        "--workdir", str(ROOT),
    ], timeout=60)
    if stopped.returncode:
        raise LocalTargetError("OWNED_RUNTIME_STOP_FAILED")


def probe() -> dict[str, object]:
    identity = guard()
    container = docker_json(["inspect", CONTAINER])[0]
    check_container_owner(container)
    bindings = container.get("NetworkSettings", {}).get("Ports", {}).get("5432/tcp") or []
    if not bindings or any(binding.get("HostIp") != "127.0.0.1" or binding.get("HostPort") != "55432" for binding in bindings):
        raise LocalTargetError("DATABASE_BINDING_NOT_EXPECTED_LOOPBACK")
    query = run([
        "docker", "exec", CONTAINER, "psql", "-U", "postgres", "-d", "postgres",
        "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c",
        "begin read only; select json_build_object('database',current_database(),'postgres_version',current_setting('server_version'),'eps_schema_exists',exists(select 1 from pg_namespace where nspname='eps')); rollback;",
    ])
    if query.returncode:
        raise LocalTargetError("LOCAL_READ_ONLY_QUERY_FAILED")
    query_row = next((json.loads(line) for line in query.stdout.splitlines() if line.startswith("{")), None)
    return {
        **identity, "container": CONTAINER,
        "image": container.get("Config", {}).get("Image"),
        "image_id": container.get("Image"),
        "running": container.get("State", {}).get("Running"),
        "health": container.get("State", {}).get("Health", {}).get("Status"),
        "bindings": bindings, "read_only_probe": query_row,
        "central_schema_replay": "not_run_missing_discovered_baseline",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("guard", "start", "probe"), default="guard", nargs="?")
    args = parser.parse_args()
    try:
        identity = guard()
        if args.action == "guard":
            evidence = {"status": "PASS", **identity}
        elif args.action == "start":
            ensure_network()
            existing = run(["docker", "inspect", CONTAINER])
            if existing.returncode == 0:
                check_container_owner(json.loads(existing.stdout)[0])
            # Official loopback network option; no status output is forwarded.
            cli_runner = "npx.cmd" if os.name == "nt" else "npx"
            started = run([
                cli_runner, "--yes", CLI, "db", "start", "--network-id", NETWORK,
                "--workdir", str(ROOT),
            ], timeout=300)
            if started.returncode:
                combined_output = (started.stdout + started.stderr).lower()
                category = "LOCAL_SUPABASE_START_FAILED"
                if "pull" in combined_output or "download" in combined_output:
                    category = "LOCAL_SUPABASE_IMAGE_PULL_OR_START_FAILED"
                raise LocalTargetError(category)
            try:
                evidence = {"status": "PASS", **probe()}
            except LocalTargetError:
                # Reject unexpected exposure and stop only our verified runtime.
                # Default stop retains volumes; no --all or --no-backup is used.
                stop_owned_runtime()
                raise
        else:
            evidence = {"status": "PASS", **probe()}
        print(json.dumps(evidence, indent=2))
        return 0
    except (LocalTargetError, subprocess.TimeoutExpired, OSError, ValueError, KeyError) as error:
        code = str(error) if isinstance(error, LocalTargetError) else type(error).__name__
        print(json.dumps({"status": "FAIL", "code": code, "scope": "local runtime only"}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
