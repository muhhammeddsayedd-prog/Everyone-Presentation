/** Tab-local recovery metadata only. Signed URLs, credentials and video bytes are never saved. */
export type VideoUploadIntent = {
  id: string; name: string; size: number; lastModified: number; mime: string;
  reserveKey: string; completeKey: string; hash?: string; sessionId?: string; jobId?: string;
  status: 'waiting' | 'uploading' | 'queued' | 'failed';
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const mimeTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];
export function videoMime(file: Pick<File, 'name' | 'type'>): string {
  if (file.type) {
    if (!mimeTypes.includes(file.type)) throw new Error('Choose an MP4, MOV, WebM or MKV video.');
    return file.type;
  }
  const extension = file.name.toLowerCase().split('.').pop();
  const inferred = ({ mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska' } as Record<string, string>)[extension ?? ''];
  if (!inferred) throw new Error('This file has no supported video type. Choose an MP4, MOV, WebM or MKV video.');
  return inferred;
}
export function saveVideoIntents(items: VideoUploadIntent[]): string {
  return JSON.stringify(items.map(({ id, name, size, lastModified, mime, reserveKey, completeKey, hash, sessionId, jobId, status }) =>
    ({ id, name, size, lastModified, mime, reserveKey, completeKey, hash, sessionId, jobId, status })));
}
export function restoreVideoIntents(serialized: string | null): VideoUploadIntent[] {
  if (!serialized || serialized.length > 300_000) return [];
  try {
    const values: unknown = JSON.parse(serialized);
    if (!Array.isArray(values) || values.length > 200) return [];
    return values.filter((value): value is VideoUploadIntent => {
      if (!value || typeof value !== 'object') return false;
      const v = value as Record<string, unknown>;
      return ['id', 'reserveKey', 'completeKey'].every(key => typeof v[key] === 'string' && uuid.test(v[key] as string))
        && typeof v.name === 'string' && v.name.length > 0 && v.name.length <= 255
        && typeof v.size === 'number' && Number.isSafeInteger(v.size) && v.size > 0 && v.size <= 256 * 1024 * 1024
        && typeof v.lastModified === 'number' && Number.isSafeInteger(v.lastModified) && v.lastModified >= 0
        && typeof v.mime === 'string' && mimeTypes.includes(v.mime)
        && ['waiting', 'uploading', 'queued', 'failed'].includes(v.status as string)
        && (v.status !== 'queued' || typeof v.hash === 'string' && typeof v.sessionId === 'string' && typeof v.jobId === 'string')
        && (v.hash === undefined || typeof v.hash === 'string' && /^[0-9a-f]{64}$/u.test(v.hash))
        && ['sessionId', 'jobId'].every(key => v[key] === undefined || typeof v[key] === 'string' && uuid.test(v[key] as string));
    }).map(value => JSON.parse(saveVideoIntents([value]))[0] as VideoUploadIntent);
  } catch { return []; }
}
export function matchesVideo(intent: VideoUploadIntent, file: Pick<File, 'name' | 'size' | 'lastModified'>): boolean {
  return intent.name === file.name && intent.size === file.size && intent.lastModified === file.lastModified;
}
