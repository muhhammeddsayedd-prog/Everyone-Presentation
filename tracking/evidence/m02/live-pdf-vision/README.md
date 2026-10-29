# Actual image-only PDF processing

The signed-in Studio app processed the labeled synthetic two-page English/Arabic
fixture `scanned-brief.pdf` into the saved Archive Clerk draft. The actual source
contains two raster JPEG pages and no embedded text: PDF.js and native
`pdftotext` both found zero text characters before OCR. Its 213,626 original bytes
have SHA256 `2f1508bf45a46ae81f3459b1507db58f1e9af41591a0367b643dce973823225f`.
Fixture generation/native inspection is recorded separately in
[the fixture receipt](../pdf-raster-fixture/2026-10-29T09-54-41-482Z.json).
Original PDF/images remain in ignored private local storage.

The [passed canonical readback](2026-10-29T10-28-12-764925+00-00-2e8ab32d-readback.json)
records all ten checks passing for job `e7316bb7-4c40-4460-8d17-15503ba12315`
in the Dummy Reuse Test workspace. Real local native rasterization fed two
OpenAI image-input OCR calls using GPT-6.1 Sol and SDK 7.45.1: 3,299 and 3,416 total
tokens, 6,715 combined. The subsequent real specs extraction used 2,682 tokens
(1,511 input, 1,171 output). All three durable stages were delivered through n8n.

The private prepared derivative is honestly labeled `pdf_vision`, retains actual
pages 1 and 2 and Arabic wording, and its stored checksum matches the exact private
JSON bytes. Saved extraction evidence resolves to that original and its prepared
page/paragraph text. Metadata-only receipts contain hashes, locators, usage and
expected-fixture booleans; source wording, quotations, raster bytes, credentials
and provider bodies are excluded. This readback compares stored hashes; the
capture itself makes no fresh Storage download or paid provider request.

The app's saved draft keeps required Arabic/English, Cairo and scenes 9/11.
Age and headcount remain unknown, with one provisional slot. The relative next
Monday statement is retained in `availability_requirements`, with an unresolved
exact-date clarification; `shoot_dates` is empty. No calendar date was invented.
The protected historical `b3f90268-147d-41d4-8875-2a6435df1496` job remains
`waiting_for_input/INPUT_CHANGED`, and its original workspace manual note remains.

The [OCR-only receipt](2026-10-29T10-20-19-122534+00-00-3c6c36f6-ocr-only.json)
is earlier provider-event evidence. The
[unconfirmed first readback](2026-10-29T10-22-23-211083+00-00-196ec09f-readback.json)
is retained: its capture SQL had one extra closing parenthesis. It was an evidence
query syntax failure; no processing retry or additional provider call was needed.
The exact failed SQL is preserved under
`development/m02/pdf-vision-capture-attempts/20261029T102223-failed-readback.sql`.

Dominant page-image coverage with a small digital header is separately covered
by actual native hybrid-PDF fixture tests and deterministic OCR adapter tests.
That evidence does not claim another live hybrid OCR call. The actual app proof
here covers the two image-only pages; recognition and unusual visual layouts
still require source review. Hosting remains deferred.
