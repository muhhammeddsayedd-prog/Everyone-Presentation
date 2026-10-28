# Document preparation worker module

This package implements the isolated M02 document preparation **library**. It is not an HTTP worker service, and it is not connected to n8n, cloud storage, a live job lease, or OpenAI. No provider request is needed to parse supported source bytes.

## Supported source paths

| Input MIME | Actual behavior |
|---|---|
| `text/plain` | Strict UTF-8 decoding; English, Arabic and mixed text retained. CRLF/CR becomes LF. Original source hash covers the unchanged bytes. |
| `application/pdf` | PDF.js text extraction with page references and paragraph offsets; no page rendering, JavaScript actions or browser navigation. |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Sequential archive validation, then Mammoth raw-text extraction. Paragraph order is retained; presentation formatting is omitted. |
| `application/msword` | `DOCUMENT_CONVERSION_REQUIRED`: save legacy `.doc` as DOCX/text-rich PDF or paste text. No converter is configured. |
| Image-only/scanned PDF with no extracted text | `DOCUMENT_VISION_REQUIRED`: scanned-page rendering/vision is not configured; use text-rich PDF or manual pasted text. |

A PDF with some text-free pages returns a warning identifying those pages. This is partial text preparation, not proof that image-based requirements have been read. Complex PDF reading order and fonts require verification on authorized representative samples.

## Interface and ownership

`prepareDocument({ bytes, mimeType, sourceAssetId })` returns:

- A SHA256 of the original source bytes and the verified source asset reference supplied by the caller.
- Prepared source text and `extractionMethod` (`plain_text`, `pdf_text`, `docx_text`).
- Paragraphs with stable zero-based `index`, nullable one-based PDF `page`, exact `text`, and zero-based UTF-16 `start`/exclusive `end` offsets into the returned text.
- Explicit preparation warnings. Parser exceptions are replaced with actionable typed errors; raw private source/parser details are not logged.

The source asset ID is an opaque reference, not a path. This function accepts no network URL, filename path, SQL, shell command or executable task from uploaded material. Source text is returned as data even when it contains instructions or HTML-like text.

The paragraph `index` matches the OpenAI integration and source-reference contract directly. A deterministic seam test feeds an actual prepared PDF into the extraction evidence validator and verifies exact source asset, paragraph, page and quote resolution; this uses no provider request.

`prepareAndStoreDocument(input, scope, storage)` separates parsing from output publication. The injected `DocumentStoragePort` must implement the real authenticated service operations:

1. Reserve an app-allocated `document_text` output for the current job/attempt/lease, with expected size and parent source asset.
2. Write the derived JSON artifact through the reservation, retaining source hash, prepared text and paragraph map.
3. Complete/verify the reserved output's actual size/checksum and current ownership.
4. Only after completion succeeds, return the callback projection matching `contracts/json-schema/document-preparation.schema.json`: source/text asset IDs, no page assets for the currently supported methods, paragraph count, method and warnings.

The library's non-empty scope validation does **not** authenticate a service, validate a lease, authorize an arbitrary asset or establish a fencing guarantee. Those checks belong in the still-unimplemented service/storage adapter. No storage authorization URL or lease token is logged or persisted by this module. Failed/unverified output publication cannot return a successful callback.

## Limits and parser controls

`src/types.ts` owns the current conservative limits: 20 MiB source bytes, 200 PDF pages and 2,000,000 UTF-16 text code units. DOCX preflight additionally limits 1,000 ZIP entries, 16 MiB per expanded entry, 40 MiB total expansion and 200:1 per-entry expansion ratio.

Before Mammoth sees a DOCX, every entry is streamed sequentially. Actual expanded byte counts and incremental CRC32 must match the central entry metadata; a central-directory count alone is not accepted. Unsafe/duplicate paths, symbolic links, encrypted/unsupported compression, macros, XML DTD/entity declarations, and external non-hyperlink relationship parts are rejected. Relationships are parsed with a namespace/entity-aware XML parser; XML attribute character references cannot bypass the external-part check. No ZIP entry is written to disk. CRC detects corruption; it is not cryptographic authentication.

DOCX XML parts currently require valid UTF-8. A damaged or differently encoded part returns conversion/re-save guidance rather than guessed text.

PDF.js receives a new typed byte array only. External binary resource access is denied; font fetching, WASM, XFA and image/render paths are disabled. Password-required documents fail and readable encrypted documents with permissions are rejected. Parsing uses `stopAtErrors`; no action/annotation scripts are evaluated. PDF.js resources are destroyed after success or failure.

Current parser API details were checked against the installed pinned source and primary documentation:

- [Mammoth](https://github.com/mwilliamson/mammoth.js): version 1.13.0 `extractRawText(input)` has one argument. Passing `{externalFileAccess:false}` as an extra argument would be ignored. Its reader defaults external access off; preflight independently rejects external non-hyperlink parts. No HTML conversion output is rendered.
- [Mozilla PDF.js](https://mozilla.github.io/pdf.js/examples/): version 6.4.299 no longer exposes `isEvalSupported` in its initialization contract/build. The module does not claim that an obsolete flag provides protection. It uses the current documented data-only text path and deny factory.
- [yauzl](https://github.com/thejoshwolfe/yauzl): lazy entries and actual stream-size validation are used, with additional CRC checks because yauzl does not perform CRC validation.
- [xmldom](https://github.com/xmldom/xmldom): the exact installed compatible `0.8.15` is declared directly for relationship parsing instead of relying on an undeclared transitive dependency.
- [Node CRC32](https://nodejs.org/api/zlib.html#zlibcrc32data-value): incremental byte checksums use Node's supported `zlib.crc32`. The function is present in the required Node 24 runtime and predates it.

These byte/text checks do not provide a hard CPU, wall-clock or process-memory boundary. Before exposing the module as a production worker, run parser tasks in an independently bounded process/container with enforced timeout, memory/CPU/egress limits, non-root identity, and authenticated job-scoped input/output service access. PDF.js can allocate parser structures before a text-length check runs. No sandbox/resource-exhaustion endurance proof is claimed here.

## Validation

Run from the repository root after the root lockfile is installed:

```powershell
npm.cmd exec -- tsx --test tests/worker/documents.test.ts
npm.cmd exec -- eslint apps/worker tests/worker --max-warnings 0
npm.cmd run typecheck
```

Observed final results on Windows / Node 24.18.0: **10/10 document tests passed**, worker ESLint passed with zero warnings, and repository TypeScript check passed. The fixtures are generated genuine ZIP/DOCX and PDF structures, not parser stubs. They exercise Arabic/mixed UTF-8, real PDF/DOCX extraction, actual source offsets/page references, no-text PDF handling, corrupt/legacy input, byte/page/text/expansion limits, encrypted/unsafe/entity archives, relationship namespace/character-reference bypasses, CRC corruption, output publication failure and the real preparation-to-extraction evidence seam.

The initial focused test failed because implementation did not exist. Independent review then reproduced two real preflight gaps: XML relationship regex bypass and unchecked CRC. Each received a failing regression before its fix; the final ten-test run passed. Initial control-character regex lint errors and XML nullable-attribute type errors were corrected without suppressing their checks. The originally one-based paragraph ordinal was replaced with the shared zero-based index before any integrated consumer was published.

No cloud objects, migrations, workflows, provider calls, production fonts or deployments were changed or verified by these tests. This package prepares useful M02 work while the integrated pipeline remains incomplete.
