# Exact guest self-test link metadata

Source-only preparation. No child cloud, database or browser action. This helper never receives, reads or stores the bearer URL, cookies, token/session digests, IP/UA, guest identity or transcript. It fixes series93fb7425/current Ready4f1b81a1/Dummy Pilot Test and the exact label `English rollout self-test — revoke after check`, requiring exactly one matching link across both active and revoked rows. No link is created, changed or revoked here.

Root may invoke one before read and one after read following source review:

```powershell
.venv-skills/Scripts/python.exe -X utf8 -B development/m03/english-guest34/observe.py before
.venv-skills/Scripts/python.exe -X utf8 -B development/m03/english-guest34/observe.py after <exact-review-link-id-from-before>
```

Each phase has a separate permanent claim and one bounded, pinned Supabase2.122.0 linked-CLI read under a15-second read-only SQL statement limit. Protected query/claim files use the established Windows owner/SYSTEM helper; its three security sources and CLI reader are pinned. The after read additionally requires the exact returned link UUID. Ambiguous labels/scope, changed Ready pointer, wrong link or unexpected/private fields fail closed. Raw CLI output is never logged.

**Do not delay UI revocation for this observer.** Before mode records the actual state, even if revocation already happened; in that case its desired-before-state flag is false and it does not prove an earlier active observation. After mode reports whether revocation is actually present. A metadata read alone does not prove guest browser playback, download or post-revoke access denial.

Session counts examine at most101 indexed rows for this link. Counts are exact only through100; above that, totals are null with truncation true. `unexpired_row_count` describes stored expiry metadata, not currently authorized sessions: a revoked link may retain unexpired session rows. No raw sessions or identity fields are returned.

The previous completed old-cohort/Reviewed preservation receipt is source-pinned as a reference; this lightweight observation does not repeat it or claim a new preservation comparison. Canonical34/English1.0 and fixed Ready metadata are checked. Every bearer URL remains exclusively in the root CUA runtime.

Inert verification:

```powershell
.venv-skills/Scripts/python.exe -X utf8 -B -m unittest discover -s development/m03/english-guest34 -p test_observe.py
```
