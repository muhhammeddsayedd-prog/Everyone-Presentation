# Current production cutover pointer - 2026-11-03

The [14:44:32 UTC web readback](evidence/m07/presentation-pdf-metadata-web-forward-release/2026-11-03T14-44-32-244101Z-b5e29aa2-7f3e-4a7a-8fe2-e1246a0ab705-readback.json) confirms Ready `dpl_4gdhR5Le7K9pMnPSNpbHzkNjWjoo`, source `514447f5e82d97b18cf45807eebe77287e17044a` and stable-alias equality. Exact-Main quality passed 1,030 tests/types/lint/production guard. Worker Fxd/OCR daemon with retained native3d, canonical history42 and all five enabled processing configurations remain unchanged. This web release adds no new worker/native build, heartbeat or startup-window observation.

The [Root HTTP/UI receipt](evidence/m07/completion-release/Root-4gdh-production-metadata-and-UI.json) records permitted PDF metadata without private locators, independent anonymous401 and refreshed Selection v2 Ready20. The existing-Claude metadata read remains pending. Earlier owner generation/PDF/video/feedback and guest-expiry/temporary-access cleanup retain their dated scopes; they are not pending worker cutover actions and need no replay.

Full M07 remains false. AT060 representative200-video measurements remain open; AT069's historical policy block remains unreplayed. Nonproduction AT070 recovery carries, while Narrator/contributor/mobile are skipped, not passed. The [current matrix](evidence/m07/ACCEPTANCE_MATRIX.md) and [handoff](HANDOFF.md) own remaining metadata, final privacy/push, operator-document and access-cleanup disposition.

## Historical cutover record retained unchanged

The November2 identities, native pin, times and pending labels below describe that completed cutover only. Preserve its receipts; do not use its old IDs or commands as current deployment instructions.

# Production cutover checkpoint - 2026-11-02

Current state from the nine committed worker phase receipts below and Root's
production web readback at 02:34:07 UTC. Worker and web are in production;
remaining end-to-end acceptance is tracked by Root's main matrix and handoff.

- All five processing configurations are enabled again. Pin and resume passed
  with normal returns and two matching readbacks at 02:24:16 and 02:28:39 UTC.
- Worker project APP_ENV and release mode are production; the public native
  manifest is a317b0c7398ab12d960271f9d9d8ce98d846ed390a77fc0bb02c50b9b6df9943.
- New production deployment dpl_Cp1TW1vP3JiLJoL5G3Zx2yfei97M uses daemon
  sha256:2d66eed2c5f584f3f261d2f241062cbb9fa088bbbc32437aed1ce0b6adf2c594.
  Submission returned normally; two metadata reads observed READY and exact bindings.
- Readiness passed at 02:20:07 UTC: one new ready/alive instance
  dmni_01m6d0523mz7hc2s6mqw035ys2, old instances absent, and the complete actual
  first ten-minute startup window admitted. Instance start was 02:06:59.277 UTC;
  the window ended at 02:16:59.277 UTC.
- Future frame work now uses database native pin
  sha256:46de2f0c0772e10d712fba514788d24041d6741faa8966b6fe9c554fe47e4af4.
- New production web deployment dpl_J3hmctcHndRp8zDVAPYfcnjEgpzG returned
  normally at 02:29:51 UTC. Root's stable alias, direct deployment and environment
  readbacks passed at 02:34:07 UTC. Root observed the new UI, actual Planned
  project creation and an existing Casting workspace; the shared client name was restored.

| Phase | Actual receipt | Result |
| --- | --- | --- |
| Read-only preflight | [01:47:41](evidence/m07/completion-worker/2026-11-02T01-47-41-594208Z-rollout39-complete-preflight.json) | observed |
| Preparation | [01:51:23](evidence/m07/completion-worker/2026-11-02T01-51-23-347269Z-rollout39-complete-prepare.json) | prepared |
| Pause | [01:55:10](evidence/m07/completion-worker/2026-11-02T01-55-10-472671Z-rollout39-pause.json) | passed |
| Production environment | [02:02:47](evidence/m07/completion-worker/2026-11-02T02-02-47-144040Z-rollout39-env.json) | passed |
| Deployment | [02:06:57](evidence/m07/completion-worker/2026-11-02T02-06-57-221015Z-rollout39-deploy.json) | submitted, normal return |
| Deployment readback | [02:07:48](evidence/m07/completion-worker/2026-11-02T02-07-48-488179Z-rollout39-readback-deploy.json) | observed, normal return retained |
| Readiness and startup | [02:20:07](evidence/m07/completion-worker/2026-11-02T02-20-07-299859Z-rollout39-ready.json) | passed, complete startup window |
| Future-work native pin | [02:24:16](evidence/m07/completion-worker/2026-11-02T02-24-16-275686Z-rollout39-pin.json) | passed, normal return and two readbacks |
| Resume | [02:28:39](evidence/m07/completion-worker/2026-11-02T02-28-39-166492Z-rollout39-resume.json) | passed, normal return and two readbacks |

All worker phases used the same reviewed complete_preparation entry. Cached
platform lastCheckedAt metadata stays separate from the completed startup-log
acceptance. These deployment effects do not close full app release or AT069.

Remaining acceptance includes owner MCP/manual checks, guest and auth-protocol
proof. Contributor access was still absent at 01:41 UTC. Chrome file selection
is blocked by its Allow file URLs setting. Root retains these boundaries in the
main progress, matrix and handoff; no full release closure is claimed here.
