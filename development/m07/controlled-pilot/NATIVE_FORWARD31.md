# Native adoption after canonical31

This is a new operator family. The previous canonical30 operators and their
completed claims remain frozen. `WORKER_FORWARD31_PLAN.json` binds actual source
`09b6d4b8`, native `77eee0ee` and baked manifest `083f81c7`. Imports and pure tests
do not perform staging, credential transfer, deployment or DML. Actual adoption
still requires root's fresh preflight, apply and independent readback.

The actual canonical31 apply `a99247a4` and independent readback `222f51dc` are
pinned, including the `2e894606` continuation source. The current adoption is
native `5e250047`, manifest `ea963472`, source `3790b2b3`; these are the previous
successful adoption, rather than the older `7846` baseline. New files use
separate `worker-forward31` and `future-frame-forward31` claim directories.

The plan now pins native Ready `03b11db9`, full native smoke `8f08a192` and the
file-limits daemon image/import receipt. The smoke proves five pages with six
frame draws, five logo draws, four links and eleven validated image draws for
both ordinary and guest PDFs; all ten resources cleaned up and the probe lock
was released. The daemon proof records a private Ready amd64 image and uncached
UID1000/no-network import. These observations are distinct from adoption,
deployment and hosted core acceptance. Earlier failed probes remain historical.

Before any provider operation, the source-bound canonical31 receipts and source
files are revalidated. Fresh read-only checks require exact history31, ACK and
hook bodies, private ACK permissions, all eight hook security checks, the
established twelve-operation runtime and zero active jobs/leased outbox rows.
The observed full state is retained unchanged; validation projects only the
known migration31 delta and separately checked native pin into the frozen
predecessor invariant. No OAuth core gate or provider activation method is called.

Root first prepares both existing empty private directories using DACL-only
access-section operations: `.local/m07-pilot/worker-forward31` and
`.local/m07-pilot/future-frame-forward31`. The helpers require exact protected
current-owner/SYSTEM FullControl ACLs. They only read and validate ACLs; they
never create private directories, call `Set-Acl`, access SACLs or escalate.

Root keeps submissions quiescent while adopting the image. The intended order is:

1. Verify the sealed public plan/helper pins and obtain independent review.
2. Inspect and apply the single public `EPS_NATIVE_MANIFEST_SHA256` update, then
   perform its independent readback. It uses the existing variable ID and fixed
   value. All 28 IDs, creation timestamps, unselected update timestamps and
   selected metadata must remain exact; only the manifest variable's update
   timestamp may advance. Sensitive values are never read, uploaded or hashed.
3. Inspect and apply the future-frame pin, then independently read it back.
   Fresh quiescence is required after any intervening Specs/video processing.
   Under config and business-table locks the SQL changes only
   `eps.frame_extraction_config.native_image_id`; all job/outbox, Settings,
   candidate/media/frame and Ready-version fingerprints and protected M02 facts
   must remain exact. Existing job inputs are never rewritten or retried.
4. Root separately deploys the matching daemon and verifies its actual runtime,
   then resumes the remaining hosted core checks. These operators do not deploy.

After the directory preparation and final source review, root invokes the new
helpers individually:

```powershell
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m07/controlled-pilot/worker-forward31.py inspect
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m07/controlled-pilot/worker-forward31.py apply
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m07/controlled-pilot/worker-forward31.py readback
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m07/controlled-pilot/future-frame-forward31.py inspect
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m07/controlled-pilot/future-frame-forward31.py apply
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m07/controlled-pilot/future-frame-forward31.py readback
```

Each apply creates an exclusive, fsynced permanent claim before one logical
write. Unknown outcomes permit readback only; no automatic resume, claim deletion
or replay. Passed results require the original baseline, claim-bound process
return and two preserving reads. Vercel CLI65 may retry the same-ID/same-value
PATCH up to three times for network/5xx failures, and can perform authentication
maintenance; no one-wire-request claim is made. Supabase CLI retries remain
uncharacterized. Separate attempt counters identify Vercel, frame SQL and
canonical read-only commands; remote I/O deadlines remain bounded.

The actual image/native/import proofs are pinned; no adoption, daemon runtime,
hosted core or OAuth acceptance is credited by source preparation. OAuth remains
disabled until the separate actual hosted-core and authorization gates pass.
AT072 and M03 semantic acceptance remain pending; mobile is skipped.
