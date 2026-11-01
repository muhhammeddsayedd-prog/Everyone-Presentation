# Exact main production web purpose

Disabled source preparation only. Root reviews and arms `RELEASE_ENABLED` before
any provider read/configuration/deployment. This purpose uses the already logged
in normal Vercel CLI65.8.0 store and the existing web project/team/origin. It does
not run historical operator mains, consume their claims, extract credentials,
touch worker/native sources, or change database/OAuth registrations.

`stage.py <full-main-commit> [main-workspace]` makes a bounded immutable Git archive
of the existing sparse web product paths. It rejects symlinks, duplicates and
unselected files, scans fixed private-value families in memory, and seals source
bytes. The selected product paths must be clean and identical to main; later
controller/docs-only commits are permitted. This is a source-family check, not
full PII/privacy or browser acceptance. Stage has no cloud side effects.

The template now pins the immutable308-file `c8d0ff3` product stage after the
reviewed MCP fixes were committed. Its source hash is
`1043d03f7da32f5a0636d38126ca0bf38d97febfb886a78d974a4cd648e3f33e`.
The quality receipt binds its exact commit/source hash, result `passed`, failed
and skipped0, and commands `{test:0,typecheck:0,lint:0,production_guard:0}`. The
949 tests/typecheck/lint are explicitly carried forward from actual root run
`41676ea4`: its three reviewed seals match committed bytes exactly and the only
selected product change since its tested HEAD is the reviewed catalogue seal.
`quality.py` rechecks the complete immutable archive against those facts and runs
only the tiny production fixture-denial guard afresh. Original checks retain
their actual timestamps; no new full-suite execution is claimed. The
canonical gate requires the actual applied39 normal marker and equal independent
readbacks. Protected `.local/production-web-release/inputs.json` also supplies
only the existing publishable build key; runtime secrets stay in Vercel.

Prepare pins two equal current project/environment/8m observations and the exact
e494/2cef source metadata on compatible rollback deployment
`dpl_8mFQY4SkHiHmSVo6hR8QPLSdgwaS`. Build is an isolated normal production Next
build, with no private runtime environment, .env copy or prebuilt deployment.

Configure changes production `APP_ENV` and `EPS_RELEASE_MODE` only. Shared rows
are split by retaining their original ID/value for preview/development, then
creating a production-only row with value `production`. Each write has its own
permanent claim, normal-return receipt and two independent readbacks. Existing
blank/absent pilot deadline is retained; a nonblank production deadline is blanked
with the same scoped procedure. All other variable metadata and project settings
must remain exact. Private values are never decrypted or written.

Deploy uses `vercel deploy --prod --yes --no-wait` with fixed project/team and
source/build/canonical/run metadata. No automatic helper replay is allowed.
The CLI/provider may internally retry the same unique-key create, same-ID patch
or deployment; those transport retries are not claimed absent. An unknown outer
outcome stops later writes and retains every claim. `environment-readback` or
`readback` can inspect, but never infer a missing normal process return. Ready
requires two equal stable-alias reads and direct deployment identity, plus exact
configuration/settings preservation. HTTP/authenticated/Claude/guest/processing
acceptance remains separate. No rollback is executed by this purpose; 8m stays
the known compatible deployment anchor.

```powershell
.venv-skills/Scripts/python.exe -X utf8 -B development/m07/production-web-release/test_release.py
# Local source staging after final MCP/main source is settled:
.venv-skills/Scripts/python.exe -X utf8 -B development/m07/production-web-release/stage.py FULL_COMMIT
.venv-skills/Scripts/python.exe -X utf8 -B development/m07/production-web-release/quality.py SOURCE_RECEIPT_PATH
# Root arms only after source review; every action uses new purpose files:
.venv-skills/Scripts/python.exe -X utf8 -B development/m07/production-web-release/release.py prepare
.venv-skills/Scripts/python.exe -X utf8 -B development/m07/production-web-release/release.py build
.venv-skills/Scripts/python.exe -X utf8 -B development/m07/production-web-release/release.py configure
.venv-skills/Scripts/python.exe -X utf8 -B development/m07/production-web-release/release.py deploy
.venv-skills/Scripts/python.exe -X utf8 -B development/m07/production-web-release/release.py readback
```

Ten pure tests pass: scoped preview preservation, private-value exclusion,
unknown/missing production states, archive traversal/link/duplicate denial,
claim replay denial and missing normal-return handling, Ready identity and
carried-forward quality drift rejection. Actual local archive staging and the
fixed14-family scan passed. An actual offline admission accepted the sealed
source, carried-forward949 and applied39 using a synthetic publishable key held
only in memory, with provider calls forced to fail. Initial staging lacked the
security helper's tools import path and exited before archive/cloud activity;
the scoped import setup was corrected. No environment/deployment/build/worker
mutation or application acceptance is claimed by this preparation.
