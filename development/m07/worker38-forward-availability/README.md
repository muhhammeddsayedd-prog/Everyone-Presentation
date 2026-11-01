# Pre-dispatch processing availability contract

This is new, disabled source preparation only. `RENDER_ENABLED = False` refuses
even SQL rendering. There is no CLI, database connection, private-file reader,
provider request, daemon transport, rollback, redeploy or reassignment here.
The six original adoption files and the 164 product source files are unchanged.
This purpose never invokes or substitutes for the blocked AT069 transport.

The planned normal order is: pause the five configs; update the existing public
project manifest variable; deploy and verify the exact new daemon Ready with old
instances absent; pin the new native image in the database; resume the five
configs. Defer the DB pin until actual new-daemon readiness is established.
Actual worker startup validates its baked manifest and DB role/ACL/function
metadata. It does not compare DB processing flags or the DB native-image pin,
so the new daemon can start while all five configs are false and the pin is old.
Its poller still starts; the conservative zero queue/retry/outbox gate is required.

Before any new deployment dispatch claim exists, a normal, confirmed pause may
be unwound by restoring only its original five enabled flags. This is a separate
SQL forward correction of configuration, with no provider rollback. The pure
contract requires all of the following:

- The exact successful pause claim bytes and normal-return marker agree by hash.
- Current source pins and the entire paused-window database state still match.
  All lifecycle counters are zero, English stays 1.0, and the native pin is OLD.
- Two separately collected provider reads, each no older than 30 seconds, show
  the exact old production deployment active, desired and Ready; one alive old
  image instance is in dub1 with 2048 MiB, no override and a fresh health check.
- Two fresh, equal public-environment reads retain the same selected variable ID,
  type, target and all other environment metadata. Its current public value is
  either the old hash or the exact newly admitted hash. Sensitive values are
  never requested or supplied to this contract.
- The exclusive new-deployment dispatch claim is absent. Do not use this branch
  after a normal or unknown deployment dispatch, even if an old instance is still
  alive: a pending replacement could later become active.

`expected` and `transition` compare all unchanged state. `render` uses the exact
current38 transaction prefix, so five config ACCESS EXCLUSIVE locks precede the
first snapshot; history, other business tables and trace locks remain intact.
SQL checks the complete precondition inside that transaction, updates precisely
five boolean fields with exactly one affected row each, checks preservation and
returns a unique marker after commit. It never changes the native pin or jobs.

There is deliberately no executable operator. A future reviewed caller must use
the existing explicit canonical target and role rules, protect/load the actual
private claim, collect both provider reads independently, verify dispatch-claim
absence immediately before dispatch, and use a new permanent once-only SQL claim
with normal-return and two independent preservation readbacks. These pure tests
do not provide those live observations, SQL execution or recovery acceptance.
Provider observations are point-in-time evidence, not a distributed lock; the
worker project must have a single coordinated deployment operator for the window.
The environment-before input must come from the actual same-window manifest
inspection/claim, not an invented or silently refreshed baseline.

After a new deployment is active/desired, or once the native pin changes, this
old-worker branch refuses. The remaining path is forward-only: establish actual
new Ready/old absence, apply the admitted pin and resume with full preservation.
An unknown provider or SQL action must be reconciled read-only; these helpers do
not authorize replay, another deployment or any blocked transport. This small
extension reduces the pre-dispatch availability risk; it does not claim that the
later provider rollout has a completed failure-recovery proof.

Official provider semantics checked read-only on **2026-11-01 at 18:36 UTC**:

- [Daemon environment variables](https://vercel.com/docs/daemons#environment-variables-and-oidc)
  are deployment-scoped; image/command/environment changes require a new
  production deployment. A project variable update does not rewrite the old
  deployment's stored environment, including its replacement instances.
- [Managing daemon deployments](https://vercel.com/docs/daemons/managing-daemons#deploying-changes-to-a-daemon)
  describes new instances starting while old ones receive SIGTERM. Old-instance
  liveness alone therefore does not prove the old deployment remains desired.
- [Managing environment variables](https://vercel.com/docs/environment-variables/managing-environment-variables)
  says project-variable edits apply to new deployments.

No dormant mode or preview-daemon support is inferred from these documents.
The existing production entrypoint starts the poller immediately after startup
verification. The Docker import gate is a module-import check, not an actual
credentialed startup or hosted Ready observation.

Inert checks only:
`.venv-skills/Scripts/python.exe -X utf8 -B development/m07/worker38-forward-availability/test_availability.py`.

## Executable pre-deployment driver — disabled preparation

`driver.py` adds only the fixed canonical query/metadata transport and durable
protocol around the existing pure contract. Both `APPLY_ENABLED` in the driver
and `RENDER_ENABLED` in availability.py must be explicitly armed by Root before
preparation. The driver does not bypass either gate. Its source check accepts
only the reviewed pure file with that one boolean flipped; every other byte and
the state.py690 SQL fence remain exact. All five files in this folder are sealed
at preparation and must then remain unchanged through correction/readback.

After the web rollout is Ready, execute `prepare` BEFORE the actual database
pause. Preparation reads the existing original pause plan, compares it to the
full currently enabled old795/English1.0 canonical snapshot, checks the four
original core adoption prerequisites, collects two fresh current-production old
daemon reads and two fresh environment observations, and saves their exact
same-window environment baseline in a protected new plan. It changes no flag,
environment, daemon, grant or token. It requires no new deployment claim.

The worker projection uses the pinned normal CLI65.8 production `daemons inspect`
descriptor: its deploymentId identifies the current production daemon, its desired
count and configuration identify the desired workload, and its single current
instance supplies liveness/image/region/memory/start/last-check data. This is one
current production observation on each of two separate CLI calls, not an invented
second control-plane API. The pure contract checks both observations at <=30s.
[Vercel's daemon CLI documentation](https://vercel.com/docs/daemons/managing-daemons#inspecting-daemons-from-the-cli)
states these commands target production. Raw CLI payloads stay in memory.

`apply` is usable only after a normally confirmed pause and before any new daemon
deployment claim. It checks the protected raw pause claim and return marker,
unchanged full admission/source pins, exact original enabled baseline, current
paused state, old native pin, zero lifecycle and fresh worker/environment reads.
A new exclusive correction claim precedes the only SQL mutation. The existing
pure renderer supplies all locks/preconditions/five updates/preservation checks;
only its final result-column alias is mapped to the existing canonical Supabase
query helper's expected name. The helper retains its explicit linked project
target, normal private CLI session, role checks and bounded output. No alternate
database transport, acting identity or service credential is introduced.

Passed correction requires a persisted normal-return marker, two equal independent
full snapshots and fresh preserving provider observations. `readback` never issues
the mutation, infers a missing normal return or retries a claim. Unknown dispatch,
lost return recording or state drift remains unconfirmed, even if read-only checks
observe the flags restored. Original pause/manifest/adoption claims remain exact.
The public receipt contains source/reference hashes and booleans, with no source
facts, public build keys, private row payloads or auth tokens.

The driver has no daemon deploy, stop, restart, reassign, rollback, environment
PATCH or AT069 transport operation. Once a daemon deployment claim exists, every
correction/readback refuses this branch. After new Ready/old absence, progress is
forward-only through the separately admitted DB pin and normal resume. A failed
provider read is not silently treated as healthy or absent. No post-dispatch
availability recovery is claimed here.

Inert driver tests:
`.venv-skills/Scripts/python.exe -X utf8 -B development/m07/worker38-forward-availability/test_driver.py`.
Six port-only cases cover both gates, preparation before pause, exact normal
claim/return/two-readback ordering, unknown or unsaved return without replay,
deployment/database drift refusal, and current-production worker projection.
The seven existing pure cases remain separate. Authoring ran no CLI, SQL, provider,
build or private claim/auth-store operation; this remains source preparation.

Root's read-only native CLI preflight found that a running instance may omit
`stoppedAt`. The purpose-local projection now maps only omitted/null stoppedAt
to None, matching the existing frozen projector. Its native omitted-field
regression failed with KeyError before the fix and passes afterward. A non-null
stop time, dead instance, stale health or changed deployment still refuses. That
preflight created no plan, correction claim, flag or environment mutation.
