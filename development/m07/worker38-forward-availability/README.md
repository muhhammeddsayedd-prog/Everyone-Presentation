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
