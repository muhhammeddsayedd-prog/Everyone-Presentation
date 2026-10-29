# Scanned PDF preparation

The ordinary isolated PDF text path remains unchanged for text-rich sources.
When pages contain no extractable text, `preparePdfWithVision` inspects all real
page numbers, rasters only missing pages in a separate local Poppler container,
and reads each raster through the configured OpenAI image-capable Responses model.
Mixed PDFs preserve the existing extracted text on other pages. A native
`pdfimages` / `pdfinfo` inspection also catches digital headers over a scanned
body: OCR runs for at least35% image area with at most300 extracted characters,
or at least65% image area regardless of text length. Existing text is preserved
if OCR does not reproduce it verbatim. Remaining image coverage of at least15%
gets an explicit manual-review warning. Coverage sums physical image draw areas
and is a conservative technical heuristic; overlaps/clipping can overestimate it.
It is not a claim to understand every visual PDF layout. Any OCR result
uses `pdf_vision`; text-only results remain `pdf_text`. Both retain original file
checksum, exact page references, stable paragraph indices and UTF16 offsets.

`readPdfPage` accepts only verified JPEG bytes and source/page identity. Its strict
schema returns literal original-language text and uncertainty notes. No tools,
external URLs, translation, role extraction, generated images or hidden repair
requests are enabled. Embedded document instructions remain source text. Provider
output must resolve to the exact page and pass Unicode/size/shape validation.
Uncertainty and vision-read page warnings remain visible for source review.

Images exist only in the isolated temporary filesystem and transient worker
memory. The existing private `document_text` derivative stores the prepared text;
SQL/outbox/callbacks do not receive image bytes or URLs. A metadata-only receipt
records model/SDK/prompt/schema versions, page/image/source checksums, safe provider
request IDs, token usage and latency. It contains no source text, image data or
credentials. The `document_vision_page_processed` worker event can be captured in
the local private worker log/evidence record.

Enable explicitly with `EPS_PDF_VISION_ENABLED=true` and the immutable locally
built `EPS_PDF_RASTER_IMAGE_ID`. OpenAI uses the existing extraction model/key and
must match the job's frozen model. The original upload admission checker already
checks PDF structure without requiring text. Only the leased worker rasterizes or
calls OpenAI. The additive SQL compatibility migration must be applied before
enabling the feature so `pdf_vision` is accepted honestly as a paged PDF method.

Build using `node tools/build-pdf-raster-container.mjs`. The source-only context
contains `Dockerfile.pdf-raster` and one fixed process module. Official Node base
digest is pinned; Debian package `poppler-utils=22.12.0-2+deb12u3` supplies the observed
`pdftoppm version22.12.0`. Runtime uses the same ownership-verified, nonroot,
network-disabled, read-only, mount-free native boundary as media preparation:
2GiB memory including swap, two CPUs,64PIDs, no capabilities/new privileges,
384MiB private tmpfs and185s outer deadline. Individual raster commands have a30s
deadline. Temporary directories are created by the worker and removed only after
verifying their real path and ownership prefix; container cleanup removes its
temporary filesystem even when the process is terminated.

On this Windows workstation the native adapter uses the observed signed Docker
Inc executable at `C:\Program Files\Docker\Docker\resources\bin\docker.exe`,
the fixed local Docker Desktop Linux named pipe, and a fixed project-local empty
CLI configuration. Both the worker and native child explicitly set an empty
`PATH`; omitting it allowed this Windows runtime to inherit the parent search
path. The native child receives only system/temp fields, never OpenAI, database
or n8n credentials. `node tools/test-native-worker-environment.mjs` proves actual
Poppler rasterization inside a child created by the real worker environment
projector, using synthetic credential values and no provider/database calls.

Bounds:20MiB original PDF,200 total text pages, at most20 missing/scanned pages per
job,2048px raster long edge,4MiB per raster and32MiB aggregate raster bytes. Larger
scanned sources must be split explicitly. These are starting resource limits,
not an accuracy/capacity claim. Hosting remains deferred.

`node --import tsx tools/test-pdf-raster-container.mjs` with the built image ID in
`EPS_PDF_RASTER_IMAGE_ID` verifies actual Poppler page rasterization, source hashes,
missing-page rejection, corrupt-source rejection and owned cleanup. Its fixtures
are synthetic and make no provider accuracy claim. Tests in `pdf-vision.test.ts`
and `pdf-ocr.test.ts` cover preserved text-rich input, mixed pages, malicious
instructions/extra fields, foreign page citations, corrupt input and metadata
privacy. Actual scanned source processing through the app is a separate gate.

The installed SDK7.45.1 and current official [OpenAI image-input documentation](https://developers.openai.com/api/docs/guides/images-vision)
support inline Base64 JPEG inputs to Responses. The configured
[GPT-6.1 Sol model documentation](https://developers.openai.com/api/docs/models/gpt-6.1-sol)
lists image input and Structured Outputs support. Model access/processing must
still be demonstrated using the real account; the documentation is not live
acceptance evidence.
