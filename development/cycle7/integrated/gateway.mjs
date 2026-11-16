// Local central gateway for cycle-7 integrated checks. NEVER points at a shared or cloud project.
//
//   /rest/v1/*   -> PostgREST container in front of the disposable replica (JWT verified by PostgREST)
//   /auth/v1/user -> verifies the local HS256 token and returns the user (what verifyCentralUser calls)
//   /auth/v1/token?grant_type=refresh_token -> re-issues a token for the same user (browser session refresh)
//   /auth/v1/logout -> 204
//   /storage/v1/*  -> 501 (byte storage is out of scope; uploads are completed through the API metadata path)
//
// Usage: EPS_INT_JWT_SECRET=<hex> node development/cycle7/integrated/gateway.mjs [port=55481] [postgrest=http://127.0.0.1:55480]
import http from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';

const port = Number(process.argv[2] ?? 55481);
const upstream = new URL(process.argv[3] ?? 'http://127.0.0.1:55480');
const secret = process.env.EPS_INT_JWT_SECRET;
if (!secret || secret.length < 32) throw new Error('EPS_INT_JWT_SECRET is required.');

const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
export function sign(claims) {
  const head = b64({ alg: 'HS256', typ: 'JWT' }); const body = b64(claims);
  return `${head}.${body}.${createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')}`;
}
function verify(token) {
  const [head, body, mac] = String(token ?? '').split('.');
  if (!head || !body || !mac) return null;
  const expected = createHmac('sha256', secret).update(`${head}.${body}`).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) return null;
  return claims;
}
const objects = new Map();
const bearer = req => (req.headers.authorization ?? '').replace(/^Bearer\s+/iu, '');
function send(res, status, body) { res.writeHead(status, { 'content-type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); }
const userOf = claims => ({ id: claims.sub, aud: 'authenticated', role: 'authenticated', email: claims.email ?? null, is_anonymous: false,
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-11-16T00:00:00Z' });

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://gateway');
  if (url.pathname === '/auth/v1/user') {
    const claims = verify(bearer(req));
    return claims?.role === 'authenticated' ? send(res, 200, userOf(claims)) : send(res, 401, { code: 401, msg: 'invalid JWT' });
  }
  if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
    let raw = ''; req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      const claims = verify(JSON.parse(raw || '{}').refresh_token);
      if (!claims) return send(res, 401, { error: 'invalid_grant' });
      const exp = Math.floor(Date.now() / 1000) + 3600; const access = sign({ ...claims, exp, kind: undefined });
      return send(res, 200, { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: sign({ ...claims, kind: 'refresh', exp: exp + 86400 }), user: userOf(claims) });
    });
    return undefined;
  }
  if (url.pathname === '/auth/v1/logout') { res.writeHead(204); return res.end(); }
  // Minimal Storage stand-in: the harness registers "uploaded" objects (metadata only, no bytes), and
  // object/info answers the completion check exactly as Storage would. Everything else stays unavailable.
  if (url.pathname === '/__c7/objects' && req.method === 'POST') {
    let raw = ''; req.on('data', chunk => { raw += chunk; });
    req.on('end', () => { const item = JSON.parse(raw); objects.set(`${item.bucket}/${item.key}`, item); send(res, 201, { ok: true }); });
    return undefined;
  }
  const info = /^\/storage\/v1\/object\/info\/(?:authenticated\/)?([^/]+)\/(.+)$/u.exec(url.pathname);
  if (info && req.method === 'GET') {
    const item = objects.get(`${info[1]}/${decodeURIComponent(info[2])}`);
    if (!item) return send(res, 404, { statusCode: '404', error: 'not_found', message: 'Object not found' });
    return send(res, 200, { id: item.key, name: item.key, version: '1', size: item.size, content_type: item.content_type, cache_control: 'no-cache', etag: 'c7', metadata: {}, last_modified: new Date().toISOString(), created_at: new Date().toISOString() });
  }
  const sign = /^\/storage\/v1\/object\/upload\/sign\/([^/]+)\/(.+)$/u.exec(url.pathname);
  if (sign && req.method === 'POST') { req.resume(); return send(res, 200, { url: `/object/upload/sign/${sign[1]}/${sign[2]}?token=c7-local-upload-token` }); }
  if (url.pathname.startsWith('/storage/v1/')) return send(res, 501, { error: 'storage bytes are not available in the integrated check' });
  if (!url.pathname.startsWith('/rest/v1/')) return send(res, 404, { error: 'not found' });
  const headers = { ...req.headers }; delete headers.host; delete headers.apikey;
  const target = new URL(url.pathname.slice('/rest/v1'.length) + url.search, upstream);
  const proxy = http.request(target, { method: req.method, headers }, upstreamRes => {
    res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers); upstreamRes.pipe(res);
  });
  proxy.on('error', () => send(res, 502, { error: 'postgrest unavailable' }));
  req.pipe(proxy);
  return undefined;
}).listen(port, '127.0.0.1', () => console.log(JSON.stringify({ gateway: `http://127.0.0.1:${port}`, upstream: upstream.origin })));
