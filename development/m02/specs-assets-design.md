# Specs document storage boundary — proposed additive slice

Status: isolated candidate implementation, 2026-10-29. The candidate, synthetic
rollback assertions and fixed runner are separate from applied history. No
cloud Storage policy, credential or file pipeline is enabled by this document.
Applied migration10 and its historical proofs remain unchanged. The real
pasted-text path is independent of this work.

## Existing interfaces to preserve

Public upload purpose is `specs`. Submission uses the actual verified
`source_asset_id` and current `Spec.row_version`. A real file never uses the
pasted-text null-asset exception. The parser supports UTF8 text, text-rich PDF
and DOCX with a20MiB input cap and bounded page/ZIP/text/paragraph processing.
Legacy DOC and scanned/unsupported documents require honest conversion or
manual-text guidance until their actual converter/vision path exists.

Original upload bytes must be streamed and size/hash/type-checked by the trusted
backend before its completion proof can publish Ready metadata. Client filename,
MIME, checksum and `actual_size_bytes` are assertions, not authority. Full native
preparation remains a worker stage; a corrupt uploaded source can fail processing
without manufacturing extracted facts. Use a document-purpose verification key
and receipt separate from the logo key/purpose. Ordinary user RPC input cannot
assert verified/Ready by itself.

Retain each job's immutable original asset ID/object/hash as well as its Spec,
workspace, source epoch and input fingerprint. Source replacement must not alter
an old job's object or evidence origin. The current text-only retained table
needs an explicit checked text/asset union or a separate asset-input relation;
do not store placeholders or relax the existing text hash constraint silently.

## Storage authority without a universal runtime credential

The genuine PostgreSQL runtime login does not authorize the Storage HTTP API.
Do not add `service_role`, a JWT signing key, a fake Auth user or a reusable user
session to solve that boundary. Supabase's custom Storage-role example requires
JWT signing authority; its S3 user-scoped option requires a valid user JWT.
Neither supplies the required standalone narrow worker credential.

Proposed service capability:

1. An authenticated private DB function checks job/attempt/lease/current source
   and original requester authority, then reserves a short-lived random grant
   for one exact original asset/object and GET operation.
2. Persist only a token digest, object/asset/job/attempt identity, input hash,
   permission, expiry and revocation state in a private FORCE-RLS relation. No
   runtime table access is granted. Cap expiry at the current lease expiry.
3. The native worker sends the public project API key plus the opaque grant in
   a dedicated header to the normal authenticated-object Storage route.
4. A narrow boolean policy helper reads that header and enforces exact object,
   GET operation, token digest, active lease, current source pointer/input and
   current requester authority. Public/anon requests without the grant fail.
   No Auth user or user JWT is manufactured.
5. A bucket-specific restrictive guard prevents unrelated permissive policies
   from bypassing those checks. Deny listing, signing, UPDATE, DELETE, copy,
   move and upsert. An eventual derivative-upload grant is separately scoped to
   one newly reserved output and immutable INSERT, never the original object.

The grant is a capability, not a public URL. Keep it out of URLs, n8n envelopes,
job input, ordinary idempotency/audit responses, operator receipts and logs.
Lost issuance can leave a short-lived orphan grant; issue a new scoped grant
under the still-active lease rather than weakening hash-only storage.

This proposal depends on actual hosted HTTP behavior. Source-supported header
propagation alone is insufficient. Before activation prove that the deployed
Storage route accepts the public-key context, forwards the dedicated proof
header, enforces the trusted operation and never records the synthetic proof
in observable request/error logs. Fail closed if any gate cannot be proved.

## Native preparation and durable output

The worker must bound downloads, reject redirects/unrelated destinations,
verify exact source asset ID/size/SHA256 before parsing, and stop on expiry or
cancellation. File preparation uses the existing isolated native parser.

`document-preparation.v1` completion keeps an actual source ID and actual Ready
reserved `document_text` derivative ID. Preparation text and paragraph evidence
are stored privately and hash-bound to the original; they never enter public job
metadata. No fake derivative ID or guessed object path is permitted. Existing
per-stage lease/fence and immutable-source guards continue to apply.

The explicit contract amendment adds required `output_key` to
`JobOutputReservation`; this stage uses `document_text`, stable within an
attempt. It adds a closed `ServiceAssetAccess` DTO with method, headers,
asset/size/hash and expiry, and a reservation result containing the actual asset
plus that access. `JobAssetAccess.access` chooses read/write, defaulting to read.
Write means immutable POST of one reserved derivative, never original overwrite.
Actual internal paths remain
`/internal/jobs/outputs`, `/internal/jobs/outputs/complete` and
`/internal/jobs/assets/access`.

The implementation is a narrow parameterized PostgreSQL service port. The HTTP
facade and its exact-key response replay are not claimed. Private
`store_specs_preparation` persists the exact derived JSON under the current
lease; its content does not enter ordinary callback/job/outbox payloads.

## Safe working-fact replacement

The new apply branch can retire an untouched machine generation only when every
active role/slot, version, requirement, clarification, provisional marker and
Spec working field still equals the previous retained extraction. It archives
the old role/slot rows, preserves their IDs and source-job evidence, creates new
identities, and advances the workspace once in the same transaction. New source
or configuration alone never erases prior working facts. A manual difference or
late workspace change records `INPUT_CHANGED` and retains the staged extraction.

Assignment storage is not implemented yet. As with the current resize/archive
boundary, the presence of `eps.assignments` disables replacement conservatively.
M04 must replace that guard with its actual scoped assignment locks and history
integration; this slice guesses neither assignment columns nor absence of
assignment choices from unchanged slot versions.

## Required proof

Start with an owned-local rollback candidate and exact role/column/function
denials. Test missing/incorrect/expired/revoked/cross-job proof, stale lease,
source correction, requester revocation, absent or spoofed operation context,
listing and mutation rejection. Real Storage gates must use only newly owned
fixtures and distinct forbidden bytes, with unchanged-original checksum checks.

Run actual PDF and DOCX through upload, verified metadata, retained input,
native preparation, reserved derivative, real OpenAI, atomic draft publication
and reload. Exercise missing count/provisional slots, failure and restart, plus
source/manual-edit races. A local Storage catalog simulation or synthetic
provider response cannot replace those HTTP/provider outcomes.

Primary sources: [Storage access control](https://supabase.com/docs/guides/storage/security/access-control),
[private downloads](https://supabase.com/docs/guides/storage/serving/downloads),
[custom Storage roles](https://supabase.com/docs/guides/storage/schema/custom-roles),
and [S3 authentication](https://supabase.com/docs/guides/storage/s3/authentication).
The existing pinned header/operation source review is in
`tracking/discovery/storage-operation-context-research.md`; it remains distinct
from deployed HTTP acceptance.
