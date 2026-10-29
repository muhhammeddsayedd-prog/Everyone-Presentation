# M05 native fixed-version artifacts

Local implementation and synthetic artifact proof. Hosting remains deferred.
The connected app, canonical database, n8n publication and real downloaded PDF
have separate root-owned acceptance; these local tests do not establish them.

## Frozen content and retained templates

`presentation-stage-executor.ts` accepts the agreed nine-field lease input and
sixteen-field authenticated stage readback. It verifies the canonical hashes of
the small eight-field job input, private snapshot, separately derived closed
manifest and frozen inventory. Later stages use persisted predecessor results;
they never query current profile facts or replace a captured display field.

The retained1.0.0 renderer, registry, original brand SVG and six fonts remain
byte-identical. The separately registered1.1.0 renderer adds explicit Pending
category plus all eleven labelled requirements, including `Not provided`, and
uses a white currentColor variant of the original logo. The variant adds only
the root color attribute; its registry records the original SVG hash and retains
all path geometry. The same licensed fonts remain the documented IBM Plex Sans
development substitution for unavailable General Sans.

Current1.1.0 content SHA256 is
`bbe72bf2bb08f37fe394c75563e2eca3ab8da72b1775db75704d47ae54f4f638`.
Its renderer SHA256 is
`f58d10501fac36e1f2f5b80b2f3e814901972084acf94fe4047434e42db7225c`.
The original implementation remains available through the closed version
dispatcher. An old series is not silently repinned to the new template.

## Four stages and scoped files

| Stage | Work and durable result |
|---|---|
| prepare_presentation | Validate frozen structures, hashes, real image bytes and retained template/font assets; metadata-only preparation receipt |
| render_presentation | Load exact verified images as data URIs; measure fonts/images/field bounds; generate actual PDF and canonical UTF8 manifest; reserve, upload, download/checksum and finalize both outputs |
| validate_presentation | Re-read both completed artifacts; compare exact manifest bytes; independently inspect actual PDF pages, embedded font/glyphs, field text, image draws/geometry and video annotations |
| publish_presentation | Return the closed nine-field canonical render result referencing the same manifest/PDF IDs; the DB owns Ready and monotonic latest publication |

Results use `presentation-preparation.v1`, `presentation-rendering.v1`,
`presentation-validation.v1` and `presentation-render-result.v1`. No image,
PDF bytes, source text, raw grant or secret enters callbacks or n8n envelopes.

The two adapters reuse the existing scoped access/reserve/complete functions.
They add no database login or broad table access. Outputs use the private
`eps-presentation-outputs` bucket and exact
`jobs/{job}/attempts/{attempt}/{asset}.json|pdf` destinations. POST is restricted
to the active attempt, with `x-upsert:false`. A ready result is downloaded and
verified; it is never overwritten. A lost completion acknowledgement can reuse
identical ready bytes. A rerender with different PDF bytes fails closed under
the same output reservation; a recovered new attempt gets fresh output IDs.
Committed render results let validation/publication resume without rerendering.

Source reads match the frozen bucket/key, size, MIME and checksum. Only the
fixed Supabase origin and finite leased headers are accepted; redirects,
arbitrary headers and paths are rejected. Post-upload verification permits a
pending output's null stored SHA only while checking its actual bytes before
finalization. Ordinary source and ready-artifact reads require the frozen SHA.

## Native verification and links

The worker uses pinned Playwright1.64.1 and PDF.js6.4.299. Chromium receives only
the OS allowlist from `nativeBrowserEnvironment`, with an offline context,
disabled page scripts, blocked service workers and denied network routes.
The PDF inspector is a bounded child process with restricted filesystem reads,
no credential environment and no network-resource factory. Its output contains
only fixed checks, counts and hashes; extracted text remains in memory.

PDF creation uses CSS page sizing, full print backgrounds and tagged output.
These options follow the [Playwright PDF API](https://playwright.dev/docs/api/class-page#page-pdf).
Actual files measure1200 by675.12 points for the1600 by900 CSS layout on this
Chromium build. Validation records the actual finite dimensions, requires every
page to agree and permits at most0.5 point of native unit rounding around the
nominal1200 by675 points; it does not round the stored proof.

Validation reads actual text, annotations and image operators through the
[PDF.js page API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html).
Each field and label is checked within its fresh measured rectangle. Arabic
uses exact per-line visual ordering from pinned MIT `bidi-js`1.1.0, preserving
soft wraps, glyph multiplicity, numbers and punctuation. This follows the
library's [per-line Unicode bidi interface](https://github.com/lojjic/bidi-js).
The test suite rejects changed numeric order and negation. It uses no word or
character bags. Actual image draws must match source dimensions and the
aspect-contained measured rectangles; font data and nonspace glyphs must be
present. PDF JavaScript, attachments and unexpected annotations are rejected.

The trusted DB configuration captures the local app origin in the immutable
snapshot/job. Video URLs are exactly
`{origin}/presentations/versions/{versionId}/media/{assetId}`. They remain bound
to that saved version and its inventory. No temporary Storage URL, guest token
or invented M06 export/grant is placed in a canonical PDF. Current local origins
make these local testing links; production hosting is still undecided.

## Evidence and limits

The [final native receipt](../../tracking/evidence/m05/native/2026-10-29T22-05-38.046Z-synthetic.json)
records four actual synthetic PDFs and eleven PNG pages, with24 public source
hashes unchanged before/after. The
[visual addendum](../../tracking/evidence/m05/native/2026-10-29T22-05-38.046Z-visual-review.json)
binds all eleven final PNG hashes to independently viewed pages. Checks cover
zero/one/two/three actual geometric frames, wide/tall aspect preservation,
transparent logos, white branding, mixed Arabic/English soft wraps, complete
Pending requirements and no-role fallback. The earlier1.0.0 black-on-black
brand failure and pre-fix1.1.0 source receipts remain retained historical proof.

Meaningful controlled tests additionally cover canonical artifact bytes,
source/hash/unsafe-origin denial, overflow without clipping, exact four-stage
publication, lost callback acknowledgement without recomputation, output reuse
without overwrite, cancellation/stale scopes, disabled-mode routing and finite
gateway authority.

The [SQL-capture PDF receipt](../../tracking/evidence/m05/native/2026-10-29T22-04-53.263Z-sql-capture-pdf.json)
additionally binds the DB agent's exact unchanged synthetic capture files to
actual eight-page Selection and six-page Shortlist PDFs. Independent page
calculation is cover plus6 assignments and1 Pending, and cover plus3 assignments
and2 Pending. The saved page lists preserve repeated people as separate
assignment pages. All fourteen resulting page images were inspected in the
[SQL visual addendum](../../tracking/evidence/m05/native/2026-10-29T22-04-53.263Z-sql-visual-review.json).
That tool does not call SQL or modify the captured snapshot/manifest. The DB
fixture harness supplies the separate actual inclusion/ordering transaction
proof. These empty-media captures complement the actual geometric-image cases;
neither set substitutes for the other's acceptance scope.

Explicit ceilings are1000 total pages including cover,8MiB snapshot/manifest,
16MiB presentation read envelope,128MiB aggregate compressed image bytes,
40 million decoded pixels per image and64MiB PDF. Rendering and inspection are
bounded. Exceeding a limit is a technical failure, never omitted pages, invented
media, smaller hidden type or a content pass. Representative PDFs were tested;
maximum capacity, endurance, hosting and production download acceptance were
not established here.
