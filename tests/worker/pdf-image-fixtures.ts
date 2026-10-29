/** Binary PDF fixture builder. Images are caller-supplied synthetic JPEGs; no
 * text layer is created unless an explicit digital header is requested. */
export function imageOnlyPdf(images: { bytes: Uint8Array; width: number; height: number }[], header?: string): Buffer {
  const objects: Buffer[] = []; const text = (value: string) => Buffer.from(value, 'ascii');
  objects.push(text('<< /Type /Catalog /Pages 2 0 R >>'));
  objects.push(text(`<< /Type /Pages /Kids [${images.map((_, index) => `${4 + index * 3} 0 R`).join(' ')}] /Count ${images.length} >>`));
  objects.push(text('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'));
  for (const [index, image] of images.entries()) {
    const page = 4 + index * 3; const content = page + 1; const raster = page + 2;
    const escaped = (header ?? '').replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
    const operators = `${header ? `BT /F1 12 Tf 20 780 Td (${escaped}) Tj ET\n` : ''}q ${header ? '600 0 0 750 20 20' : '640 0 0 800 0 0'} cm /Im${index} Do Q`;
    objects.push(text(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 640 800] /Resources << /Font << /F1 3 0 R >> /XObject << /Im${index} ${raster} 0 R >> >> /Contents ${content} 0 R >>`));
    objects.push(text(`<< /Length ${Buffer.byteLength(operators)} >>\nstream\n${operators}\nendstream`));
    const bytes = Buffer.from(image.bytes); objects.push(Buffer.concat([text(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`), bytes, text('\nendstream')]));
  }
  const chunks: Buffer[] = [text('%PDF-1.7\n')]; const offsets = [0]; let offset = chunks[0].length;
  for (const [index, object] of objects.entries()) { offsets.push(offset); const part = Buffer.concat([text(`${index + 1} 0 obj\n`), object, text('\nendobj\n')]); chunks.push(part); offset += part.length; }
  chunks.push(text(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(value => `${String(value).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`));
  return Buffer.concat(chunks);
}
