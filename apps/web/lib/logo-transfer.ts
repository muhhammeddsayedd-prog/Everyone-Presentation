/** The server validates the exact configured Storage origin and reservation key.
 * Browser transfer adds no app credentials to that scoped external capability. */
export function logoTransferDestination(value: string, appOrigin: string, uploadId: string) {
  const reject = () => { throw new Error('This upload destination is unavailable. Start a new logo upload.'); };
  if (typeof value !== 'string' || value.length > 16_384) reject();
  let target: URL;
  try { target = new URL(value, appOrigin); } catch { return reject(); }
  if (target.username || target.password || target.hash) reject();
  if (target.origin === appOrigin) {
    if (target.pathname !== `/api/dev/uploads/${encodeURIComponent(uploadId)}/bytes` || target.search) reject();
    return { url: target.href, credentials: 'same-origin' as const };
  }
  if (target.protocol !== 'https:' || !target.pathname.startsWith('/storage/v1/object/upload/sign/eps-brand-assets/')
    || target.searchParams.getAll('token').length !== 1 || !target.searchParams.get('token')
    || Array.from(target.searchParams.keys()).some(key => key !== 'token')) reject();
  return { url: target.href, credentials: 'omit' as const };
}
