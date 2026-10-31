# Compatible English web rollout

Root executes this controller against the existing pilot only. Preparation and
the build mode are local. No deployment, Git mutation, token extraction, secret
transfer or cloud calls were performed by the preparing agent.

The payload is the owner's current main files from the existing sparse staging
helper, fixed to
`tracking/evidence/m07/controlled-pilot/2026-10-31T16-50-08-878Z-36c50faa-web-source.json`.
The new English helper is explicitly required. Complete root/stage file hashes
must match the successful final production build, and private/unrelated paths
are excluded by the existing stage helper. No redesign worktree is copied.

```powershell
$env:DEBUG=$null
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-web-release34/test_web.py
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-web-release34/web.py build
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-web-release34/web.py prepare <build-receipt-path>
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-web-release34/web.py inspect
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-web-release34/web.py deploy
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-web-release34/web.py readback
```

Deploy targets only the existing production alias/project using the established
CLI 65.8.0 login store. It preserves a once-only claim before invoking CLI. A
timeout, error or missing returned URL must never trigger another deploy call.
Read-only provider inspection can reconcile an ambiguous attempt using project,
claim time and the public `epsEnglishWeb34` source metadata marker; CLI internal
retry behavior is not characterized by this controller. No new claim replaces
an existing ambiguous one.

Readback can be repeated while the deployment builds. It accepts only an actual
Ready deployment with the same exact source marker on its URL and the stable
pilot alias. Canonical Supabase remains exact history33/English disabled through
deploy and independent readback; the database state must remain unchanged. Root
must finish this before migration34 or a controlled job is enabled. The Ready
receipt is provider/source compatibility proof, not authenticated app, OpenAI,
guest playback, PDF, screen-reader or full release acceptance.
