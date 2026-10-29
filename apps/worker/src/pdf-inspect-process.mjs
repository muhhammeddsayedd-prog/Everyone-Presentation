import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import process from 'node:process';
import { inspectPdfText } from './pdf.ts';
const chunks = []; let count = 0;
try {
  for await (const chunk of process.stdin) { count += chunk.length; if (count > 28 * 1024 * 1024 + 4096) throw new Error('limit'); chunks.push(chunk); }
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!input || Object.keys(input).sort().join(',') !== 'bytes,source_asset_id' || typeof input.bytes !== 'string' || typeof input.source_asset_id !== 'string') throw new Error('input');
  const bytes = Buffer.from(input.bytes, 'base64'); if (bytes.toString('base64') !== input.bytes || bytes.length > 20 * 1024 * 1024) throw new Error('input');
  process.stdout.write(JSON.stringify({ ok: true, result: { source_asset_id: input.source_asset_id, source_sha256: createHash('sha256').update(bytes).digest('hex'), ...await inspectPdfText(bytes) } }));
} catch (error) { process.stdout.write(JSON.stringify({ ok: false, code: typeof error?.code === 'string' ? error.code : 'SOURCE_UNREADABLE' })); }
