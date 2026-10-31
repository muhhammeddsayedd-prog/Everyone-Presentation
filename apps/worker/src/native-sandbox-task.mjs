// Runs only inside the fresh no-credential deny-all microVM, with hard rlimits,
// capped private tmpfs and dedicated UID65432. Supervisor redirects stdout to a mode0600
// file; this protocol must never be launched through a provider log pipe.
import { readFile } from 'node:fs/promises';
import { nativeIdentityMatches } from './native-identity.mjs';
const task = process.argv[2];
try {
  const status = await readFile('/proc/self/status', 'utf8');
  if (!nativeIdentityMatches(process.getuid(), process.getgid()) || !/^NoNewPrivs:\s+1$/mu.test(status) || !/^CapEff:\s+0+$/mu.test(status) || !/^CapBnd:\s+0+$/mu.test(status)
    || Object.keys(process.env).sort().join(',') !== 'HOME,LANG,LC_ALL,NODE_ENV,PATH,PLAYWRIGHT_BROWSERS_PATH,TMPDIR') throw new Error('isolation');
  if (task === 'document') await import('./prepare-process.mjs');
  else if (task === 'video') await import('./video-process.mjs');
  else if (task === 'pdf_raster') await import('./pdf-raster-process.mjs');
  else {
    const maximum = task === 'review_fit' ? 8 * 1024 ** 2 : task.endsWith('validate') ? 280 * 1024 ** 2 : 192 * 1024 ** 2;
    let length = 0; const chunks = []; for await (const chunk of process.stdin) { length += chunk.length; if (length > maximum) throw new Error('limit'); chunks.push(chunk); }
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (task === 'review_fit') {
      const { measureReviewFit } = await import('./review-fit.ts');
      process.stdout.write(JSON.stringify({ ok: true, result: await measureReviewFit(value.review, { timeoutMs: value.timeout_ms }) }));
    } else {
      if (!['presentation_render', 'presentation_validate', 'presentation_export_render', 'presentation_export_validate'].includes(task)) throw new Error('task');
      const pdf = await import('./presentation-pdf.ts'); const images = new Map(value.images.map(([id, bytes]) => [id, new Uint8Array(Buffer.from(bytes, 'base64'))]));
      let result;
      if (task === 'presentation_render') result = await pdf.renderPresentationPdf(value.snapshot, images, { timeoutMs: value.timeout_ms });
      else if (task === 'presentation_export_render') result = await pdf.renderPresentationExportPdf(value.snapshot, images, value.access, { timeoutMs: value.timeout_ms });
      else if (task === 'presentation_validate') result = await pdf.validatePresentationPdf(value.snapshot, images, Buffer.from(value.bytes, 'base64'), { timeoutMs: value.timeout_ms });
      else result = await pdf.validatePresentationExportPdf(value.snapshot, images, Buffer.from(value.bytes, 'base64'), value.access, { timeoutMs: value.timeout_ms });
      process.stdout.write(JSON.stringify({ ok: true, result: task.endsWith('render') ? { ...result, bytes: Buffer.from(result.bytes).toString('base64') } : result }));
    }
  }
} catch (error) { const code = typeof error?.code === 'string' && /^(?:FIT|PDF)_[A-Z_]{1,80}$/u.test(error.code) ? error.code : 'NATIVE_TASK_FAILED'; process.stdout.write(JSON.stringify({ ok: false, code })); process.exitCode = 1; }
