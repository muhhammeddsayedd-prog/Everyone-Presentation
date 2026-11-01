# Temporary genuine-contributor acceptance access

This new purpose is **disabled** (`MUTATIONS_ENABLED = False`). It creates no
identity, changes no password/session, and uses only the existing normal
Supabase CLI 2.122.0 login against linked project `pyibofyctwnqpvktepse`.
Ambient database credentials and access-token overrides are refused. Raw CLI
responses stay bounded in RAM; inputs, SQL and state live under a fresh,
current-user/SYSTEM-only `.local/completion-contributor/<uuid>` directory.

The authorized canonical target is project
`6da14b82-8458-451f-aa21-28cb6c85bdc5`, current name `Live Testing Project`, with
workspace `86936940-b48d-497d-b1ff-8e0da0913afa`. Its historical name was Dummy
Pilot Test. The controller checks the current fixed ID, active state and name;
it never searches for a replacement project or renames anything. The producer
must retain active writable membership and `projects.write`.

The contributor's exact temporary capabilities are `projects.read`,
`workspaces.read`, `workspaces.write`, `cast.read`, `cast.upload`, with writable
project membership. This follows the existing capability matrix and fixture
role. Broader existing capabilities cause refusal; inactive grants or inactive/
read-only existing membership cause refusal. Existing desired active rows are
preserved. Only absent rows may be inserted; there is no upsert/reactivation.

`identity.py` reads two addresses from JSON on stdin (keys `contributor_email`,
`producer_email`), never argv or tracked source. Its safe projection reports
UUIDs, capability/eligibility and membership booleans, and counts. An absent
contributor is a genuine prerequisite block; do not create an identity here.
Current discovery found no matching contributor. Protected dated receipts
remain local; this is not live restricted-actor acceptance.

After root reviews and explicitly arms this purpose, run fresh inspection and
`controller.py prepare <protected-identity.json>`. Preparation requires a
confirmed, distinct existing contributor and existing producer, both eligible,
and an inspection no older than 15 minutes. It re-reads current access and seals
the two source files, target/principal, exact original access fingerprint,
missing rows and a unique microsecond `created_at` marker into private plan
state. Changing source requires a new plan.

`controller.py grant <plan-directory>` and `revoke <plan-directory>` each create
an exclusive dispatch claim before the one normal CLI query. They never retry.
On a timeout, failure or lost response, use `readback` only; never remove a
claim, replay, or prepare another grant to resolve the unknown outcome. Escalate
an unresolved state rather than inventing success.

Grant and revoke lock the three canonical access tables for the short bounded
transaction. Grant rechecks exact original target-principal access and current
eligibility before insertion. Revoke requires every owned row's exact key,
active/write fields and marker, plus all original principal access unchanged.
It deletes only those owned rows. Both compare all canonical capability,
project-membership and client-membership rows before/after, excluding only the
new owned rows, so unrelated rows are preserved. No Auth, session, business,
job, media or application DML is present. An external access change causes
refusal rather than row repair. Readback confirms the baseline and whether the
planned rows are all granted or all absent. Every successful mutation is followed
by a separate live read-only query before a confirmation receipt is written;
the mutation row emitted before COMMIT alone never proves durable success.
Access fingerprints are private.

Tests: `./.venv-skills/Scripts/python.exe -X utf8 development/m07/completion-contributor/test_controller.py`.
These are offline guard/SQL-parser tests, not actual cloud grant or cleanup
proof. No grant/revoke has run. Root review and genuine identity remain gates.

For acceptance, the real user signs in normally (browser and authorized MCP)
with current grants; never synthesize an Auth JWT or SQL role claim. Verify
project/workspace preparation and upload allowed; shared-fact edit, Reviewed,
project create/edit, settings, sharing and retry/cancel denied. For frames, use
an actual fresh request from that contributor, confirm its own list/get result
without `operations.read`, and deny that same restricted contributor access to
an existing frame job requested by someone else. Preserve the producer's
current operator authority; producer denial is not an acceptance condition.
Do not add `operations.retry` to make the test pass. Keep
these live receipts separate from the offline tests and preserve unrelated
sessions, jobs and historical evidence.
