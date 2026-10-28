# Document preparation worker module

This package implements document preparation, a separate parser-process adapter
and a [single-attempt specs executor](SPECS_EXECUTOR.md). The executor uses the
OpenAI adapter when explicitly called with a claimed extraction attempt. No HTTP
worker service, authenticated gateway, live database lease or n8n runtime is
connected yet. No provider request is needed to parse supported source bytes.

## Supported source paths

| Input MIME | Actual behavior |
|---|---|
| `text/plain` | Strict UTF-8 decoding; English, Arabic and mixed text retained. CRLF/CR becomes LF. Original source hash covers the unchanged bytes. |
| `application/pdf` | PDF.js text extraction with page references and paragraph offsets; no page rendering, JavaScript actions or browser navigation. |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Sequential archive validation, then Mammoth raw-text extraction. Paragraph order is retained; presentation formatting is omitted. |
| `application/msword` | `DOCUMENT_CONVERSION_REQUIRED`: save legacy `.doc` as DOCX/text-rich PDF or paste text. No converter is configured. |
| Image-only/scanned PDF with no extracted text | `DOCUMENT_VISION_REQUIRED`: scanned-page rendering/vision is not configured; use text-rich PDF or manual pasted text. |

A PDF with some text-free pages returns a warning identifying those pages. This is partial text preparation, not proof that image-based requirements have been read. Complex PDF reading order and fonts require verification on authorized representative samples.

Direct pasted text uses `preparePastedText(text)`, or the explicit input
`{ sourceKind: 'pasted_text', text, sourceAssetId: null }` with
`prepareDocumentIsolated` / `prepareAndStoreDocument`. It hashes the original
UTF8 encoding before LF normalization, preserves Arabic/mixed text and stable
paragraph offsets, and rejects empty/whitespace, invalid Unicode, binary control
characters and normal byte/text/paragraph limits. No source file/asset is created
or assumed. Asset-mode calls retain their mandatory real `sourceAssetId`.
The fixed subprocess protocol distinguishes these modes and accepts no path,
URL or executable option. A URL appearing inside supplied text remains data.

## Interface and ownership

`prepareDocument({ bytes, mimeType, sourceAssetId })` returns:

- A SHA256 of the original source bytes and the verified source asset reference supplied by the caller.
- Prepared source text and `extractionMethod` (`plain_text`, `pdf_text`, `docx_text`).
- Paragraphs with stable zero-based `index`, nullable one-based PDF `page`, exact `text`, and zero-based UTF-16 `start`/exclusive `end` offsets into the returned text.
- Explicit preparation warnings. Parser exceptions are replaced with actionable typed errors; raw private source/parser details are not logged.

`PreparedDocument.sourceAssetId` and the document-preparation callback's
`source_asset_id` are nullable only for direct pasted text. A stored text
derivative for that mode has `parent_asset_id: null`; job/attempt/lease ownership
must still be verified by the real storage port. A null original source does not
make a derivative Ready or bypass output reservation/completion. The current
port tests use injected synthetic storage; real document storage and service
callback authorization remain unimplemented.

The source asset ID is an opaque reference, not a path. This function accepts no network URL, filename path, SQL, shell command or executable task from uploaded material. Source text is returned as data even when it contains instructions or HTML-like text.

The paragraph `index` matches the OpenAI integration and source-reference contract directly. A deterministic seam test feeds an actual prepared PDF into the extraction evidence validator and verifies exact source asset, paragraph, page and quote resolution; this uses no provider request.

`prepareDocumentIsolated(input, { signal, timeoutMs })` runs the same parser in a fixed Node24 child. `prepareAndStoreDocument(input, scope, storage, options?)` uses that bounded process by default, snapshots its stage references, then separates parsing from output publication. The injected `DocumentStoragePort` must implement the real authenticated service operations:

1. Reserve an app-allocated `document_text` output for the current job/attempt/lease, with expected size and parent source asset.
2. Write the derived JSON artifact through the reservation, retaining source hash, prepared text and paragraph map.
3. Complete/verify the reserved output's actual size/checksum and current ownership.
4. Only after completion succeeds, return the callback projection matching `contracts/json-schema/document-preparation.schema.json`: source/text asset IDs, no page assets for the currently supported methods, paragraph count, method and warnings.

The library's non-empty scope validation does **not** authenticate a service, validate a lease, authorize an arbitrary asset or establish a fencing guarantee. Those checks belong in the still-unimplemented service/storage adapter. No storage authorization URL or lease token is logged or persisted by this module. Failed/unverified output publication cannot return a successful callback.

## Limits and parser controls

`src/types.ts` owns the current conservative limits: 20 MiB source bytes, 200 PDF pages, 2,000,000 UTF-16 text code units and10,000 paragraphs (the extraction adapter's input bound). DOCX preflight additionally limits 1,000 ZIP entries, 16 MiB per expanded entry, 40 MiB total expansion and 200:1 per-entry expansion ratio.

Before Mammoth sees a DOCX, every entry is streamed sequentially. Actual expanded byte counts and incremental CRC32 must match the central entry metadata; a central-directory count alone is not accepted. Unsafe/duplicate paths, symbolic links, encrypted/unsupported compression, macros, XML DTD/entity declarations, and external non-hyperlink relationship parts are rejected. Relationships are parsed with a namespace/entity-aware XML parser; XML attribute character references cannot bypass the external-part check. No ZIP entry is written to disk. CRC detects corruption; it is not cryptographic authentication.

DOCX XML parts currently require valid UTF-8. A damaged or differently encoded part returns conversion/re-save guidance rather than guessed text.

PDF.js receives a new typed byte array only. External binary resource access is denied; font fetching, WASM, XFA and image/render paths are disabled. Password-required documents fail and readable encrypted documents with permissions are rejected. Parsing uses `stopAtErrors`; no action/annotation scripts are evaluated. PDF.js resources are destroyed after success or failure.

Current parser API details were checked against the installed pinned source and primary documentation:

- [Mammoth](https://github.com/mwilliamson/mammoth.js): version 1.13.0 `extractRawText(input)` has one argument. Passing `{externalFileAccess:false}` as an extra argument would be ignored. Its reader defaults external access off; preflight independently rejects external non-hyperlink parts. No HTML conversion output is rendered.
- [Mozilla PDF.js](https://mozilla.github.io/pdf.js/examples/): version 6.4.299 no longer exposes `isEvalSupported` in its initialization contract/build. The module does not claim that an obsolete flag provides protection. It uses the current documented data-only text path and deny factory.
- [yauzl](https://github.com/thejoshwolfe/yauzl): lazy entries and actual stream-size validation are used, with additional CRC checks because yauzl does not perform CRC validation.
- [xmldom](https://github.com/xmldom/xmldom): the exact installed compatible `0.8.15` is declared directly for relationship parsing instead of relying on an undeclared transitive dependency.
- [Node CRC32](https://nodejs.org/api/zlib.html#zlibcrc32data-value): incremental byte checksums use Node's supported `zlib.crc32`. The function is present in the required Node 24 runtime and predates it.

The parser-process adapter admits at most two children per worker process, sets a256MiB V8 old-space limit, enforces a30s maximum deadline, bounds stdout/stderr, kills cancelled/timed-out children and waits for their close before releasing a slot. It snapshots the caller's bytes, verifies source hash/paragraph offsets and accepts only the fixed result/error protocol. It starts a fixed executable/entry with no shell or caller-supplied path/command/URL. The environment is scrubbed: no provider keys, NODE_OPTIONS or env file is inherited. Source/result bytes cross private pipes and are not logged or written to disk.

Node24 permissions permit reads only under worker source/dependencies, deny ordinary filesystem writes and child/worker creation, and allow native addons needed by the pinned PDF dependency. This is defense in depth: Node's permission model is explicitly not a malicious-code sandbox, V8 old-space is not an RSS limit, and this adapter does not enforce OS CPU/native-memory/network egress. Production still needs a non-root container/job boundary with those limits and authenticated scoped service access. PDF.js can allocate native/parser structures before text checks run. No OS sandbox or endurance proof is claimed. See [Node permissions](https://nodejs.org/docs/latest-v24.x/api/permissions.html), [child processes](https://nodejs.org/docs/latest-v24.x/api/child_process.html) and [native TypeScript execution](https://nodejs.org/docs/latest-v24.x/api/typescript.html), checked2026-10-28 against Node24 behavior.

## Validation

Run from the repository root after the root lockfile is installed:

```powershell
npm.cmd exec -- tsx --test tests/worker/documents.test.ts
npm.cmd exec -- eslint apps/worker tests/worker --max-warnings 0
npm.cmd run typecheck
```

The earlier Windows/Node24.18.0 checkpoint passed10/10 direct document tests. The c2df325 checkpoint passed17/17 worker tests: the same genuine PDF/DOCX fixtures also crossed the actual child process, with deadline/cancellation/recovery, two-child admission and paragraph allocation checks. The direct-pasted-text follow-up passes22/22, retaining all seventeen and adding five real preparation/process/contract seams. These are generated genuine source structures, not parser stubs or cloud/provider acceptance. The direct tests retain Arabic/mixed text, evidence offsets, unsupported/corrupt/no-text paths, archive/CRC/relationship checks and output verification coverage.

The initial focused test failed because implementation did not exist. Independent review then reproduced two real preflight gaps: XML relationship regex bypass and unchecked CRC. Each received a failing regression before its fix; the final ten-test run passed. Initial control-character regex lint errors and XML nullable-attribute type errors were corrected without suppressing their checks. The originally one-based paragraph ordinal was replaced with the shared zero-based index before any integrated consumer was published.

No cloud objects, migrations, workflows, provider calls, production fonts or deployments were changed or verified by these tests. This package prepares useful M02 work while the integrated pipeline remains incomplete.
