# M02 actual file workflow — 29 October 2026

The connected local app completed actual PDF and Arabic DOCX uploads through
private Supabase Storage, the native worker, Studio WF01/n8n and OpenAI.
The [canonical metadata receipt](2026-10-29T07-27-45-389593+00-00-f054a457-metadata.json)
records three committed stages per job, delivered outbox events, retained
originals, grounded document evidence and a saved draft with three roles/five slots.

| Source | Job | Preparation | Paragraphs | Provider tokens |
|---|---|---|---:|---:|
| PDF | `c50391c2-da84-4ee0-9fd8-a2782eed234e` | `pdf_text` | 1 | 3,384 |
| Arabic DOCX | `ff514619-4106-4221-8663-6429241f687b` | `docx_text` | 6 | 3,286 |

The DOCX preparation preserves Arabic. These are actual service/app results;
stored metadata hashes are not a separate fresh byte-download or restore proof.

The [migration 13 readback](../../cloud-specs-read-operation/2026-10-29T07-22-46-245766Z-0a6a9099-readback.json)
records the narrow compatibility fix for deployed Storage 1.80.2's
`object.get_authenticated_info` lookup operation. Existing actor/workspace,
purpose and lease predicates remain; no write or public access was added.
Earlier failed attempts and diagnostic receipts remain historical.

The [four actual denial GETs](../specs-runtime/2026-10-29T07-29-20-473Z-storage-denials.json)
denied missing and invalid grants for both Ready originals. Each returned
HTTP 400 with a canonical legacy error match. Source bodies were unread;
only bounded error JSON was inspected. No user JWT, provider call, database
call or object mutation was involved in that denial probe.

[Corrupt-file verification](../specs-protection/corrupt-file-verification.json)
combines actual rejection/usable-control observations with unchanged canonical
specs, roles, slots and job count. The [initial failed comparison](../specs-protection/corrupt-file-comparison.json)
is retained: its UI assertions used an incomplete accessibility diff. The later
verification did not repeat the upload or claim an observed HTTP 422 response.

[Manual-edit protection](../specs-protection/manual-edit-comparison.json) passed
for job `b3f90268-147d-41d4-8875-2a6435df1496`: a manual note autosaved while
extraction was active. Preparation/extraction completed with 3,152 recorded
provider tokens; publication waited for input with `INPUT_CHANGED`, preserving
the note, all role/slot facts and prior extraction evidence. Jobs
`33c246e8-6df1-489d-8092-dcd093598182` and
`966446c1-1bb4-421b-8915-94fb543460eb` completed before manual input and receive
no credit for that protection check.

M01/M02 are not fully verified. Hosting is deferred; production release remains
unverified. Follow the [current handoff](../../../HANDOFF.md) and
[progress ledger](../../../../PROGRESS.md) for remaining acceptance.
