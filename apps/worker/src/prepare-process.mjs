// Fixed one-document stdin/stdout protocol. Never accepts paths, commands,
// callback URLs or runtime options. No environment file or provider key is read.
import { prepareDocument } from './prepare.ts';
import process from 'node:process';
import { Buffer } from 'node:buffer';
const maximumInput = Math.ceil(20 * 1024 * 1024 / 3) * 4 + 4096;
const chunks = []; let total = 0;
try {
  for await (const chunk of process.stdin) {
    total += chunk.length;
    if (total > maximumInput) throw new Error('Protocol limit.');
    chunks.push(chunk);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!value || Object.keys(value).sort().join(',') !== 'bytes,mimeType,sourceAssetId' || typeof value.bytes !== 'string'
    || typeof value.mimeType !== 'string' || value.mimeType.length > 200 || typeof value.sourceAssetId !== 'string'
    || !value.sourceAssetId.trim() || value.sourceAssetId.length > 200) throw new Error('Invalid parser protocol.');
  const bytes = Buffer.from(value.bytes, 'base64');
  if (bytes.toString('base64') !== value.bytes) throw new Error('Invalid byte encoding.');
  const result = await prepareDocument({ bytes, mimeType: value.mimeType, sourceAssetId: value.sourceAssetId });
  process.stdout.write(JSON.stringify({ ok: true, result }));
} catch (error) {
  // The parent accepts only known codes and supplies its own safe wording.
  const code = error && typeof error === 'object' && typeof error.code === 'string' ? error.code : 'DOCUMENT_PROCESS_FAILED';
  process.stdout.write(JSON.stringify({ ok: false, code }));
}
