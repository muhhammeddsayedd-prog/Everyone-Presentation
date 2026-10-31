/** Fixed image-only Linux RLIMIT_NPROC bounds. Chromium creates multiple OS
 * threads; the five browser tasks need more capacity than the parser tasks.
 * Jobs cannot supply a task override or choose an arbitrary process limit. */
import { Buffer } from 'node:buffer';
export const NATIVE_TASK_PROCESS_LIMITS = Object.freeze({
  document: 64,
  video: 64,
  pdf_raster: 64,
  review_fit: 256,
  presentation_render: 256,
  presentation_validate: 256,
  presentation_export_render: 256,
  presentation_export_validate: 256,
});

export function nativeTaskProcessLimit(task) {
  if (typeof task !== 'string' || !Object.hasOwn(NATIVE_TASK_PROCESS_LIMITS, task)) throw new Error('NATIVE_TASK_PROCESS_LIMIT_INVALID');
  return NATIVE_TASK_PROCESS_LIMITS[task];
}

/** RLIMIT_FSIZE bounds each ordinary file, including Chromium's internal
 * files. Protocol stdout keeps its separate, smaller supervisor/SDK bound. */
export const NATIVE_TASK_FILE_SIZE_LIMITS = Object.freeze({
  document: 24 * 1024 ** 2,
  video: 64 * 1024 ** 2,
  pdf_raster: 64 * 1024 ** 2,
  review_fit: 96 * 1024 ** 2,
  presentation_render: 96 * 1024 ** 2,
  presentation_validate: 96 * 1024 ** 2,
  presentation_export_render: 96 * 1024 ** 2,
  presentation_export_validate: 96 * 1024 ** 2,
});

export function nativeTaskFileSizeLimit(task) {
  if (typeof task !== 'string' || !Object.hasOwn(NATIVE_TASK_FILE_SIZE_LIMITS, task)) throw new Error('NATIVE_TASK_FILE_SIZE_LIMIT_INVALID');
  return NATIVE_TASK_FILE_SIZE_LIMITS[task];
}

/** Read at most the protocol bound plus one byte, even if an inherited native
 * stdout descriptor appends after the supervisor's initial size check. */
export async function readBoundedNativeOutput(file, maximumBytes) {
  if (!file || typeof file.read !== 'function' || !Number.isSafeInteger(maximumBytes) || maximumBytes < 1 || maximumBytes > 96 * 1024 ** 2) throw new Error('NATIVE_TASK_OUTPUT_LIMIT_INVALID');
  const bytes = Buffer.alloc(maximumBytes + 1); let length = 0;
  while (length < bytes.length) {
    const remaining = bytes.length - length;
    const { bytesRead } = await file.read(bytes, length, remaining, length);
    if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 || bytesRead > remaining) throw new Error('NATIVE_TASK_OUTPUT_READ_INVALID');
    if (bytesRead === 0) break;
    length += bytesRead;
  }
  if (length < 1 || length > maximumBytes) throw new Error('NATIVE_TASK_OUTPUT_LIMIT_INVALID');
  return bytes.subarray(0, length);
}
