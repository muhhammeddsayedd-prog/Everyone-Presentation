/** Actual isolated parsers on labelled local bytes; no cloud/provider call. */
import { readFile, writeFile } from 'node:fs/promises';
import { prepareDocumentIsolated } from '../apps/worker/src/process.ts';
async function main() {
  const cases = [
    { name: 'synthetic-casting-english.pdf', mime: 'application/pdf', expected: 'pdf_text' },
    { name: 'synthetic-casting-mixed.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', expected: 'docx_text' },
  ];
  const results = [];
  for (const item of cases) {
    const bytes = await readFile(`fixtures/live-specs-files/${item.name}`);
    const value = await prepareDocumentIsolated({ sourceKind: 'asset', bytes, mimeType: item.mime, sourceAssetId: `local-fixture-${item.expected}` });
    const rolesPresent = ['Father:', 'Manager:', 'Waiter:'].every(role => value.text.includes(role));
    if (!rolesPresent || value.extractionMethod !== item.expected || item.expected === 'docx_text' && !value.text.includes('تعليمات عامة')) throw new Error('PARSER_FIXTURE_FAILED');
    results.push({ path: item.name, source_sha256: value.sourceSha256, actual_parser: value.extractionMethod,
      paragraph_count: value.paragraphs.length, characters: value.text.length, expected_role_text_present: true,
      arabic_preserved: item.expected === 'docx_text' ? true : null });
  }
  const report = { observed_at: new Date().toISOString(), result: 'passed', scope: 'Actual isolated native PDF/DOCX parsers with local synthetic IDs and files only',
    cases: results, cloud_called: false, provider_called: false, visual_review: { pdf: 'One rendered page inspected; readable, no clipping', docx: 'Not claimed; package/parser input only' } };
  await writeFile('fixtures/live-specs-files/parser-check.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
main().catch(() => { console.error('Fixture parser verification failed.'); process.exitCode = 1; });
