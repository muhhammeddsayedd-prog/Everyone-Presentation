# M06 implementation and acceptance plan

Started 30 October 2026 from `fa7233e`; hosting remains deferred. Existing
Everyone tokens, retained slide layouts, actual media and licensed fonts remain
the design sources. No new candidate imagery or factual inference is introduced.

The producer's Share and review page manages one exact output/audience series,
copy-on-create/rotation URLs, expiry/download controls and version-labelled
feedback. Internal notes default to private visibility. Guest review has a
separate shell without internal navigation or sign-in. Viewing precedes name
entry. Candidate role/slot and all ten fields stay visible; missing values and
Pending remain explicit. At narrow widths the feedback panel follows the slide.
Keyboard navigation, image retry, Preparing/unavailable/queued/failed states,
and a deliberate new-version action are required. Unsent comments get a discard
confirmation; unknown writes keep their frozen request/idempotency key.

The guest browser exchanges its raw URL token once. An HttpOnly cookie is keyed
by a public session UUID; subsequent requests select that context, avoiding a
global cookie that silently switches identities across review tabs. The URL is
replaced with public resume metadata. Display name/company are remembered as
convenience labels only. Original-PDF playback has a separate version/asset
cookie and a credential-free resume URL. No raw token enters local storage,
source, jobs, outbox, public evidence or application logs.

An anonymous digest-only database RPC would permit pass-the-hash access. The
implemented boundary therefore additionally verifies a backend HMAC over the
closed operation/input, timestamp and one-use nonce. The private database key
is distinct from the server AES-GCM encrypted-creation-replay key. Both remain
server-side. A database-generated key is transported only as PGP ciphertext to
an ephemeral retained public recipient, following the project's established
bootstrap boundary; unknown writes use read-only recovery. Replayed or unsigned
requests fail before resource access.

Guest responses are closed external projections. Every read/write verifies the
parent link, current generation, session expiry, exact external series and Ready
version/slide/asset membership. Own-comment identity uses the session UUID, never
a display-name comparison. External reviewers across links share feedback;
internal notes stay out of their DTOs and artifacts. Preferences cannot mutate
casting positions. Guest media uses app-authorized range-capable proxies with
short scoped Storage capabilities, preserving request-time parent checks.

Export jobs render frozen content with access URLs replaced only. Link disable
denies preparation/download, while previous PDF video access follows viewing
permission. Parent expiry changes propagate to non-revoked grants; rotation and
revocation invalidate old access. Actual delivered bytes cannot be recalled.

Acceptance separates synthetic/local SQL, controlled browser, native PDF,
canonical release/readback and actual two-guest app evidence. Broader M03
independently labelled English/mixed semantic evaluation remains unverified.

Official references checked 30 October 2026: [Supabase functions](https://supabase.com/docs/guides/database/functions),
[Storage access control](https://supabase.com/docs/guides/storage/security/access-control),
and [MDN cookie reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).
No provider/model/SDK or hosting replacement is selected by this milestone.
