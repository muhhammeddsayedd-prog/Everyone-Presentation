# Authorized pilot project creation

The owner explicitly authorized one new **Dummy Pilot Test** under the existing
**Dummy Client**, with the existing owner acting as
`0a79a703-caba-47e5-93d4-42e32197037a`. These spaces are intentional. The existing
**Dummy Reuse Test** supplies its active owner membership's write flags. This is
an operator creation of canonical central records, not a duplicate database,
workspace bootstrap, enrollment or global capability grant.

The fixed target is `pyibofyctwnqpvktepse`, database/operator `postgres`, exact
coordinated migration history30. The pinned public hosted-read receipt
`tracking/evidence/m07/controlled-pilot/2026-10-30-hosted-core-reads.json` observed
the real signed-in principal with zero fixture actors. Its partial core result
does **not** supply completed hosted-core acceptance. Live eligibility and
`projects.read`/`projects.write` plus the existing writable source-project
membership are independently required by this helper.

Root executes after independent source review:

```powershell
python -X utf8 development/m07/controlled-pilot/dummy-pilot-project.py inspect
python -X utf8 development/m07/controlled-pilot/dummy-pilot-project.py apply
```

Importing the module is inert. The author has run pure synthetic tests and
local parser/source checks only, never these operator modes. `inspect` uses
only a read-only transaction. `apply` refuses any remembered target name,
including an archived or case-folded match. An existing project is inspect/
readback only; no INSERT, UPDATE, reactivation or permission repair is replayed.

The helper validates the existing protected CLI environment, fixed project link,
repository config, public acting-principal receipt, SQL source hashes and all30
migration filenames before any CLI call. It reuses existing authorized CLI
management access through pinned `supabase@2.122.0 db query --linked` with an
explicit project reference and workdir. It never reads credential files, sends
credentials as arguments, creates API keys, changes a provider or configures a
Claude client. Raw CLI stdout/stderr stays in memory and never enters receipts.

Before mutation it creates an exclusive, fsynced, permanent claim in ignored
`.local/m07-pilot/dummy-pilot-project/`. The claim binds the actual before-state,
fixed actor/name/target, source hashes and rendered SQL digest. A fresh second
read must equal that baseline. Exactly one logical create command is issued;
there is no automatic helper redispatch. No exact HTTP wire-attempt claim is
made about CLI internals. The SQL's name guard and table locks independently
refuse duplicate application.

`DUMMY_PILOT_PROJECT_OBSERVE.sql` is a pinned SELECT-only fragment. The runner
renders it into the readback/create wrappers; a raw unrendered template is not
an executable operator command. The create wrapper takes a self-exclusive lock
on projects/memberships and shared locks on all fingerprinted business tables,
locks the existing eligible Auth principal and protected M02 job, refuses
unknown INSERT triggers/rules on its two write tables, and repeats the full
baseline check under those locks. It inserts exactly one DB-generated UUID
project and one matching active/writable membership. The second observation
must identify exactly those new rows, zero workspace rows, and identical old
state before COMMIT. There is no new client, Auth row, app-capability grant,
casting role, workspace, queue action, migration, seed or reset.

Ordered count/SHA256 fingerprints cover all old clients/projects/project and
client memberships, capability grants, Settings, workspaces, casting roles,
slots and assignments, candidate facts, candidate media/frame/support rows,
workspace candidates, frozen frame requests, asset metadata, specs, immutable
versions/slides/pins and Ready asset metadata. All old projects are preserved,
including the existing Archive Clerk and Dummy project casting content. The
protected M02 job and its manual instruction are checked separately. Auth rows,
secret/key/lease/token-grant tables are never fingerprinted or published. No
private content leaves SQL: only selected safe context fields, counts, hashes
and the existing protected-job projection are accepted.

Two independent readbacks are attempted after the single command, including a
lost reply. They can verify the actual result against the original claim without
repeating creation. A normal CLI return is recorded in a second exclusive,
claim-bound command-termination marker. A Python parent timeout cannot prove
Windows descendants ended: no termination marker is issued, the result stays
unconfirmed even if rows match, and the permanent claim prevents a new apply.
Root must reconcile its owned process before considering another operator
action. No broad process killing is provided.

```powershell
python -X utf8 development/m07/controlled-pilot/dummy-pilot-project.py readback
```

Without an original claim, readback is observation only and grants no creation
or preservation credit. After an unknown process timeout, readback cannot clear
the process gate automatically. Existing project IDs come only from actual DB
observations; no placeholder cloud identity is invented.

Source grounding: canonical30's selected schema catalogue in
`tracking/evidence/m07/issuer-release30-executable/2026-10-30T16-12-27-148436Z-2767ba69-canonical-apply-attempt.json`
confirms the project/membership columns and only the existing project UPDATE
invalidation trigger. The transaction/lock design follows
[PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html).
The current [Supabase changelog](https://supabase.com/changelog) was checked;
the recent timezone/TLS notes do not alter this UTC-pinned fixed-schema DML.

Offline tests are `test_dummy_pilot_project.py`. They establish only the closed
metadata/state-machine guards. Parser success does not establish live target,
data preservation, creation, browser visibility, worker availability or full
hosted pilot acceptance. Root's actual inspect/create/readback receipts and
browser verification supply those later boundaries.
