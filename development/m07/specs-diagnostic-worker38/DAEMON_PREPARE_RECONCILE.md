# Exact daemon local-preparation reconciliation — disabled

The original daemon prepare receipt at18:26:26UTC remains **unconfirmed**, SHA256
38f36ca2d06894a27747d011b6b81a7725b6a01e76543d77f185cadf081b8f85.
It retained its claim, reported TRANSPORT_UNCONFIRMED and created no daemon OCI
tree. Current read-only inspection found both task directories already protected
with exactly the current owner and SYSTEM FullControl, with valid expected
inheritance. Root's source/export/context/config read-only gates also pass.

The frozen old prepare invokes protect_directories before extraction and repeats
Set-Acl on existing directories. This is unnecessary for the already-valid second
phase. The historical receipt retained no underlying PowerShell stderr or exact
subcommand checkpoint. Therefore the exact Windows error is **not established**;
do not relabel it as a proven Set-Acl permission/propagation failure. No failing
mutator was rerun to infer a cause.

This separate three-file adapter defaults to RECONCILE_ENABLED=False. Root may
review and arm it for this exact failed run only. It binds the failed public
receipt, original protected daemon-prepare claim, all30 unchanged old source
pins, actual daemon export b0ba5c59/ce23af3b/111,132,672 bytes, current164 source
and exact new native manifest. The three executed registry files and three local
build files remain byte-exact. No original claim, receipt or code is rewritten.

Before any new write it requires existing valid directories and routing configs,
the original claim/export match and an absent daemon OCI destination. All ACL
checks use the frozen read-only program, never Set-Acl. A fresh protected,
exclusive/fsynced reconcile claim fences one local extraction of the existing
archive. The unchanged archive verifier streams and checks every hash, size and
descriptor, and the exact extracted directory is checked independently.

Afterward the adapter rechecks original claim/receipt/export/source/config bytes
and proves that the unchanged registry.prepared read gate accepts the new tree.
During that final read, its optional private-write seam is denied in memory so
missing configs fail instead of being recreated; the original function is restored
in finally. This restricts a read path without changing any executed source file
or authority check. Future ordinary registry operations still use their original
code and current permissions.

```powershell
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m07/specs-diagnostic-worker38/test_daemon_prepare_reconcile.py
# Root reviews/arms only this new adapter, then executes once:
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m07/specs-diagnostic-worker38/daemon_prepare_reconcile.py
```

The new receipt distinguishes a passed local reconciliation from the original
unconfirmed attempt. It grants no original normal-return credit and performs no
directory ACL mutation, login, registry copy, provider API, SQL, job or deployment.
It reads only the task-owned helper-routing config, never an auth/token store.
The new claim is retained on success, failure or unknown outcome. A preexisting
destination or claim refuses execution; never delete a claim or replay extraction.
Any unknown/partial result needs a separately reviewed read-only reconciliation.

All author checks are inert fake-port/public-source tests. No extraction or other
runtime operation was performed by authoring these files. Root's actual execution
and preservation receipt remain the gate before the existing daemon refresh/copy
workflow can continue. Native Ready and completed native transfer stay preserved;
screen-reader acceptance remains pending, mobile skipped and pilot running.
