/** Fixed image-only Linux RLIMIT_NPROC bounds. Chromium creates multiple OS
 * threads; the five browser tasks need more capacity than the parser tasks.
 * Jobs cannot supply a task override or choose an arbitrary process limit. */
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
