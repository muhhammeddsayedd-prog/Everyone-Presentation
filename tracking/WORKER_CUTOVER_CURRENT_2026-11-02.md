# Worker cutover checkpoint — 2026-11-02

Current state from the six committed phase receipts below and Root's read-only
instance observation at 02:12:35 UTC. This is an in-progress checkpoint.

- Five processing configurations are paused, with the normal pause return and
  two matching readbacks recorded.
- Worker project APP_ENV and release mode are production; the public native
  manifest is a317b0c7398ab12d960271f9d9d8ce98d846ed390a77fc0bb02c50b9b6df9943.
- New production deployment dpl_Cp1TW1vP3JiLJoL5G3Zx2yfei97M uses daemon
  sha256:2d66eed2c5f584f3f261d2f241062cbb9fa088bbbc32437aed1ce0b6adf2c594.
  Submission returned normally; two metadata reads observed READY and exact bindings.
- Root observed one new ready/alive instance dmni_01m6d0523mz7hc2s6mqw035ys2
  and no old instance. It started at 02:06:59.277 UTC; the complete first ten-minute
  startup window ends at 02:16:59.277 UTC. Full startup admission is still pending.
- The database native pin remains
  sha256:50082f72d4438653d4c831a1f9a360d61e64d19b3568ed1c2a2456d486f0d77c
  until startup admission, future-work pin and resume succeed.
- Web remains at the prior `8m` deployment. Final web release is pending.

| Phase | Actual receipt | Result |
| --- | --- | --- |
| Read-only preflight | [01:47:41](evidence/m07/completion-worker/2026-11-02T01-47-41-594208Z-rollout39-complete-preflight.json) | observed |
| Preparation | [01:51:23](evidence/m07/completion-worker/2026-11-02T01-51-23-347269Z-rollout39-complete-prepare.json) | prepared |
| Pause | [01:55:10](evidence/m07/completion-worker/2026-11-02T01-55-10-472671Z-rollout39-pause.json) | passed |
| Production environment | [02:02:47](evidence/m07/completion-worker/2026-11-02T02-02-47-144040Z-rollout39-env.json) | passed |
| Deployment | [02:06:57](evidence/m07/completion-worker/2026-11-02T02-06-57-221015Z-rollout39-deploy.json) | submitted, normal return |
| Deployment readback | [02:07:48](evidence/m07/completion-worker/2026-11-02T02-07-48-488179Z-rollout39-readback-deploy.json) | observed, normal return retained |

Root runs readiness after the full window, then pin and resume through the
reviewed complete_preparation entry. Cached platform lastCheckedAt metadata is
separate from the required complete startup-log observation. No ready/pin/resume,
full app release or AT069 acceptance is claimed by this checkpoint.
