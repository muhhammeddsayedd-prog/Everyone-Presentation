/** Reproducible synthetic application inputs, not a document delivery tool.
 * No private account, provider output or asset identity is embedded. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { docx } from '../tests/worker/document-fixtures.ts';
import { unzipSync, zipSync } from 'fflate';
const directory = new URL('../fixtures/live-specs-files/', import.meta.url);
const original = await readFile(new URL('../fixtures/live-specs-mixed.txt', import.meta.url), 'utf8');
const wordBytes = zipSync(unzipSync(docx(original.trimEnd().split('\n\n'))), { mtime: new Date('2026-10-27T00:00:00Z') });
const english = original.replace('تعليمات عامة: الأداء طبيعي. الموقع القاهرة. هذه بيانات اختبار وليست حقائق عن مرشحين.',
  'General instructions: Natural performance. Location Cairo. This is test data, not candidate facts.')
  .replaceAll('—', '-').replaceAll('–', '-');
if (/[^\x09\x0a\x0d\x20-\x7e]/u.test(english)) throw new Error('PDF_FIXTURE_REQUIRES_ASCII');
const lines: string[] = [];
for (const paragraph of english.trimEnd().split('\n')) {
  if (!paragraph) { lines.push(''); continue; }
  let line = '';
  for (const word of paragraph.split(' ')) {
    if ((line + ' ' + word).trim().length > 78) { lines.push(line); line = word; }
    else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
}
const pages: string[][] = [];
for (let offset = 0; offset < lines.length; offset += 46) pages.push(lines.slice(offset, offset + 46));
const objects = ['<< /Type /Catalog /Pages 2 0 R >>',
  `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
for (const [index, page] of pages.entries()) {
  const escaped = (value: string) => value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
  const content = `BT /F1 11 Tf 14 TL 72 720 Td\n${page.map((line, i) => `${i ? 'T* ' : ''}(${escaped(line)}) Tj`).join('\n')}\nET`;
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + index * 2} 0 R >>`,
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
}
let pdf = '%PDF-1.7\n'; const offsets = [0];
for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
await mkdir(directory, { recursive: true });
const files = [{ name: 'synthetic-casting-mixed.docx', bytes: wordBytes }, { name: 'synthetic-casting-english.pdf', bytes: Buffer.from(pdf) }];
const manifest = { source: 'fixtures/live-specs-mixed.txt', synthetic: true, expected_roles: ['Father', 'Manager', 'Waiter'],
  expected_headcounts: [1, 1, 3], expected_slots: 5, pdf_pages: pages.length,
  files: files.map(file => ({ path: file.name, bytes: file.bytes.byteLength, sha256: createHash('sha256').update(file.bytes).digest('hex') })),
  docx_visual_render: 'Not claimed; internal OOXML/parser test input, not a delivered Word document' };
for (const file of files) await writeFile(new URL(file.name, directory), file.bytes);
await writeFile(new URL('manifest.json', directory), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest));
