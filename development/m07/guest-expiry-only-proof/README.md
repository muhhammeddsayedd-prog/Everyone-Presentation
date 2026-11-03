# One anonymous hosted expiry-only check

Source preparation only; `LIVE_HTTP_ENABLED=false`. No actual link, HTTP call,
producer credential, cookie, guest session, export job or downloaded byte was
created while preparing this client. Root reviews/arms the source, creates one
new short-lived link through the existing Producer Share UI and writes its URL
only into the newly protected input file. No old 4489/7f link/session is reused.

The fixed series is 0b26d206-645a-4c9c-bbee-7307265ac68c, saved external Selection
v2 is 1b20ec2d-f133-4912-8efe-df2e21a3865e in the controlled bf650022 project /
5505def3 workspace. The actual anonymous session and export must resolve to those
exact IDs. No generation, new version, identity/comment/preference, producer API,
review-link create/update/revoke/rotate or unrelated endpoint is exposed.

## Actual route contract

`apps/web/app/r/[token]/page.tsx` returns the public client shell. HTTP200 from
that page after expiry is normal and proves no guest authorization. Root's
separate browser check must observe the unavailable UI; this HTTP client does
not claim it. `apps/web/lib/guest-http.ts` exchanges the link token at POST
`/api/v1/review/open`; API mode returns a guest session token without cookies.
Subsequent requests use only X-Review-Session, credentials:omit and no Authorization
or Cookie. Requests target only the fixed same-origin alias, reject redirects
and Set-Cookie, and do not read a browser profile or Auth environment/cache.

GET session, current presentation, fixed saved version, external feedback list
and summary prove before-deadline API access. Feedback list counts are only the
observed first page unless its cursor is null; this task writes no feedback.
PDF exports are bound to version AND review_link/template/export revision
(`eps.guest_prepare_export` / `eps.guest_export_access` in the M06 migration).
Thus this new link cannot borrow an old link's PDF. Exactly one ordinary guest
prepare-export POST uses `guest-expiry-export:<run UUID>`. Its immutable export,
job and parent IDs are checked. At most 60 normal status GETs, two seconds apart
and within a three-minute polling window, await Ready; no status/error/timeout
causes another prepare POST. A cached result is labelled as cached, not new
native work. No generate_version call is made.

The existing PDF transfer validator consumes a full bounded PDF privately
(64 MiB limit/signature/length); bytes/hash are recorded without publishing bytes.
A direct same-version original-video proxy GET reads only bytes 0–1023. Its
206/Content-Range/type/length and exact received byte count are checked; the
partial checksum is NOT a full original-file hash or playback acceptance.
Existing human full-media evidence remains separate. Neither content route
needs an extra playback/download POST. The app may issue its usual short-lived
internal Storage grant when serving those normal GETs; this is not a claim of
zero backend metadata side effects.

## Two explicit phases and custody

1. Root runs local `prepare` after review, which uses the existing Windows
   current-owner/SYSTEM guard. Root writes `input.json` in that new directory:
   `{schema_version:"1.0",run_id,review_link_id,review_url,expires_at,
   no_revoke_before_expiry_probes:true}`. Do not put the URL/token in argv/output.
2. `before` creates an exclusive permanent dispatch claim before HTTP, opens one
   session, saves private session/key state before prepare, then checks the
   routes/PDF/range above before the known deadline. Raw JSON response bytes are
   saved privately before parsing; received PDF/range bytes stay protected.
3. Root waits for the actual chosen deadline, leaving this link unrevoked. No
   sleeping client, clock adjustment, expiry edit or automatic phase transition
   is provided. `after` refuses before deadline plus 2 seconds. It reads the protected
   before state, then requires 401/403/404 plus a closed denial code from old
   session/current+fixed manifest/feedback/summary/export metadata, saved PDF and
   video URLs and freshly reconstructed equivalent content paths. A fresh token
   exchange must also deny. A newly issued capability is not fabricated. An
   explicit revoked-code response is not accepted as expiry-only evidence.
4. Only after expiry probes and Root's browser observation may Root perform
   normal revocation/cleanup. This client never revokes, deletes a link, removes
   feedback or repairs a claim. Known deadline elapsed plus Root's no-revoke
   precondition is recorded; independent canonical revocation status is not
   claimed. All original inputs, claims and private failure custody are retained.

Both phases are once-only. Unknown open/prepare/export/byte/denial results stop
without retry or a replacement UUID/link. A generic safe unconfirmed receipt
never serializes private errors, URLs, tokens, headers or payload text. Source
seals, exact input hash, current file identity, duplicate-key rejection and
owner/SYSTEM ACL verification precede capability use. Private normal state is
required before the second phase. Existing helpers/consumed claims stay unchanged.

```text
node --import tsx development/m07/guest-expiry-only-proof/inbox.mts prepare
node --import tsx development/m07/guest-expiry-only-proof/inbox.mts before --run-id <public UUID> --manifest-sha <public SHA>
node --import tsx development/m07/guest-expiry-only-proof/inbox.mts after --run-id <same UUID> --manifest-sha <same SHA>
```

Offline fake-port tests cover exact methods/origin/no cookies or Authorization,
one prepare POST, bounded normal polling, full PDF versus partial-video labels,
deadline refusals and denial privacy, custody failure, lost prepare response and
permanent-claim replay refusal. Fake ports are not hosted/physical acceptance.
The original source APIs, PDF reader and private guard are reused. No dependency,
product, RLS, model, migration, provider configuration or browser change is added.
