export const GUEST_PDF_DOWNLOAD_ERROR = 'The PDF download could not be completed. Try again or ask the producer for a current link.';
const MAX_PDF_BYTES = 64 * 1024 * 1024;
const SIGNATURE = [37, 80, 68, 70, 45];
/** Validate before creating any browser download, including error responses. */
export async function readGuestPdfResponse(response: Response): Promise<Blob> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const rawLength = response.headers.get('content-length');
    const declared = rawLength && /^[0-9]{1,16}$/u.test(rawLength) ? Number(rawLength) : NaN;
    if (response.status !== 200 || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/pdf'
      || !Number.isSafeInteger(declared) || declared < SIGNATURE.length || declared > MAX_PDF_BYTES || !response.body) throw new Error();
    reader = response.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [], prefix = new Uint8Array(SIGNATURE.length);
    let size = 0, prefixSize = 0;
    for (;;) {
      const result = await reader.read(); if (result.done) break;
      size += result.value.byteLength;
      if (size > declared || size > MAX_PDF_BYTES) throw new Error();
      if (prefixSize < prefix.length) {
        const part = result.value.subarray(0, prefix.length - prefixSize); prefix.set(part, prefixSize); prefixSize += part.length;
        if (prefixSize === prefix.length && !SIGNATURE.every((byte, index) => prefix[index] === byte)) throw new Error();
      }
      chunks.push(new Uint8Array(result.value));
    }
    if (size !== declared || prefixSize !== prefix.length) throw new Error();
    return new Blob(chunks, { type: 'application/pdf' });
  } catch {
    if (reader) await reader.cancel().catch(() => {}); else await response.body?.cancel().catch(() => {});
    throw new Error(GUEST_PDF_DOWNLOAD_ERROR);
  } finally { reader?.releaseLock(); }
}
export function guestPdfFilename(exportId: string) {
  return /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(exportId) ? `everyone-review-${exportId}.pdf` : 'everyone-review.pdf';
}
