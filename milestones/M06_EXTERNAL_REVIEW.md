# M06 — Guest review, feedback and external PDF delivery

**Dependencies:** M05 immutable series/versions/PDF; M01 auth and audience policies. **Next:** M07. **Runnable slice:** a client/agency guest follows a link, reviews latest ready content, comments/preferences, downloads PDF and plays that PDF's original videos.

## Required context

Read baseline/progress/handoff; PRD; guest/link/PDF sections of architecture and decisions; data security/transactions/schema for links/sessions/feedback/exports/grants; API/MCP contracts and OpenAPI guest routes; PDF workflow; guest and presentation page contracts; TEST_STRATEGY/RELEASE_EVIDENCE; operations configuration/runbook. Use final canonical playback path `/m/:grantToken/versions/:versionId/media/:assetId`.

## Exact review rules

BR-025–BR-031. Links are bearer credentials, no sign-in, default 30 days from creation. They follow the newest successfully ready version in the same series/output/audience; draft or failed/internal/other-output content never appears. Generation does not renew expiry. Reviewers see content before entering name; name required before first feedback, company optional, browser remembers label. Names are self-declared; separate guest-session identity controls own-comment edits.

All external reviewers of the same presentation series see each other's external feedback across links. Internal production notes never enter guest payloads. Preferences are Preferred/Maybe/Not preferred per viewed assignment snapshot/version; they do not change Option/Main/Backup. A new ready version does not move the guest mid-comment; offer a refresh/update and preserve feedback's original version.

PDF download is on by default and configurable per link. Download-disable stops new PDF preparation/download but cannot erase previously downloaded files and does not revoke otherwise active video viewing. Revocation/expiry/token rotation denies future requests. Link extension propagates expiry to non-revoked grants, including naturally expired grants; separately revoked access stays revoked.

## Build sequence

1. Implement link create/update/revoke/rotate/list under correct capability and series scope. Store permanent token digest, not raw bearer value. Return full URL at creation and allow immediate Copy; later rotation produces a new link token. Use explicitly documented encrypted short-lived idempotency replay for creation responses, with expiry/deletion and no plaintext logging.
2. Implement guest token resolution/session exchange with high-entropy opaque credentials, rate limits, no-store headers, referrer/log hygiene and explicit expiry/revocation checks. Validate guest session on each read/mutation. Token session cannot access internal project/library routes.
3. Implement guest viewer on mobile/desktop. A valid link before any ready version shows Preparing/no-ready state. A ready link resolves the monotonic latest-ready pointer. Include version label, correct carousel/video, per-candidate feedback panel, role navigation, optional download and update-available indicator.
4. Implement name/company entry before feedback; remember label safely in browser without confusing it with authentication. Allow edit/delete or resolve actions only as the API contract grants (own guest responses vs authorized internal moderation). Identical typed names in two browsers remain separate guest identities.
5. Implement comments/replies and preferences pinned to immutable version-slide/assignment snapshot. Filter all feedback by series/version and visibility on server. Guest request DTO cannot set internal visibility, impersonate another guest or choose arbitrary project identifiers. Internal user can see/make allowed internal notes without leaking them externally.
6. Implement guest PDF preparation as async cached export for `(version, review_link, template, export_revision)`. Use the existing frozen manifest, not re-extraction or mutable profile data. The worker mints a one-time fixed-version media grant through authenticated service operation; persistence stores digest and parent/version scope. Worker embeds URLs; raw grant is not stored in job/outbox/logs. Private cached PDF naturally contains its link.
7. Implement grant playback route in a fresh browser. It validates token, parent link view access/expiry/revocation, fixed version and asset membership. It serves the original version's media with controlled range/streaming behavior. Do not redirect to newer profile video. No general library access is granted.
8. Implement export invalidation/recovery: failed attempt's grant revoked; retry creates a valid new grant/artifact; link rotation invalidates old sessions/grants/export caches; expiry edits update non-revoked grants without rewriting PDF content. Download-disable gates export prepare/download regardless of cache.
9. Implement producer review dashboard: link audience/expiry/download state, copy-on-create/rotation, feedback by version and role, shared preference counts without automatic cast decisions. If a guest changed preference, update their one preference for that slide/version rather than create duplicate votes.

## Access and API contracts

Use exact guest open/identify, feedback list/comment/preference, export prepare/status/download and fixed media operations from OpenAPI, plus internal link management. API/MCP operation parity is preserved; a producer-delegated Claude can create/revoke/extend links and read feedback. There is no separate human approval condition. Actual email/messaging delivery is outside the initial connector scope; creating/copying a URL is the supported app action.

Enforce series scope server-side even if a guest supplies a valid version ID from another project. Session must not be sufficient after parent link revoked/expired. If storage signed URLs are used under the hood, document/test maximum residual URL lifetime; prefer request-authorized proxy for strict request-time checks. Already delivered bytes cannot be recalled.

## Acceptance

- Fresh browser link opens without account; name required only for first feedback. Name/company remembered without granting unrelated access.
- Two external reviewers through different links to the same series see external comments/preferences; internal note never appears in guest API/HTML or PDF. Same-name guests cannot edit one another's comments.
- Feedback on V1 remains on V1 after V2. Repeated candidate in another slot gets independent preference; guest preferred choice never changes casting position.
- Link follows newest ready permitted version; render race/failure, different output or different audience cannot change it to invalid content.
- Defaults exactly 30 days, generation does not extend; expired/revoked/rotated link/session denied. Extension updates still-authorized original PDF media without reviving revoked grant.
- Prepare/download an actual guest PDF then open original video in fresh browser. Generate newer version with different media; old PDF still plays old media. Revoke/expire parent and confirm future playback denied.
- Disable downloads and confirm preparing/download endpoints denied while ordinary viewing and existing authorized video playback continue. An already saved PDF remains saved.
- Link-grant/export creation replay/retry does not expose plaintext secrets in logs or create mismatched version tokens. Cached artifact scoped to intended link, not another guest audience.
- Keyboard/mobile navigation, loading/waiting/failed PDF states and rate-limit responses remain understandable.

## Handoff and Codex prompt

Record actual private test PDF/export IDs, two-browser feedback results, expiry/rotation tests, scope tests, screenshots and route/DB evidence without raw tokens. M07 inherits a working human/internal/external app; its task is full external API/MCP/client and production proof, not fixing undocumented guest semantics.

> Implement M06's complete guest-review and link-scoped delivery journey. Respect no-sign-in access, self-declared identity, shared external feedback, latest-ready scoped links and original-version PDF media. Prove cross-browser playback, history, expiry/revoke/extension and download-toggle behavior with real artifacts. Update progress and operational handoff.
