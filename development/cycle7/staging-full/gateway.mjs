// API gateway for the cycle-7 staging stack (the role Kong/the hosted API gateway plays). It only routes:
//   /auth/v1/*    -> GoTrue (eps-c7stg-auth)       real sign-in, sessions, token verification
//   /rest/v1/*    -> PostgREST (eps-c7stg-rest)    JWT verified by PostgREST, RLS/grants enforced by Postgres
//   /storage/v1/* -> Storage API (eps-c7stg-storage) real private buckets, policies on storage.objects
// Publishable-key translation as on hosted Supabase: a request whose apikey is the configured sb_publishable_ key
// and that carries no user JWT is forwarded as the anon role; a user JWT passes through unchanged. Any other apikey
// is refused. No business logic, no service-role injection.
// Usage: node gateway.mjs [port=55511]   (upstreams are the containers' published loopback ports)
import http from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../..');
const keys = JSON.parse(readFileSync(path.join(root, '.local/cycle7/stg/keys.json'), 'utf8'));
const PUBLISHABLE = 'sb_publishable_c7staginglocal01';
const port = Number(process.argv[2] ?? 55511);
const routes = [['/auth/v1', 'http://127.0.0.1:55512', ''], ['/rest/v1', 'http://127.0.0.1:55513', ''], ['/storage/v1', 'http://127.0.0.1:55514', '']];
const log = [];

http.createServer((req, res) => {
  const route = routes.find(([prefix]) => req.url === prefix || req.url.startsWith(prefix + '/') || req.url.startsWith(prefix + '?'));
  if (!route) { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{"message":"no route"}'); }
  const apikey = req.headers.apikey;
  const auth = String(req.headers.authorization ?? '');
  const signedUpload = /^\/storage\/v1\/object\/(upload\/sign|sign)\//.test(req.url) && req.method !== 'POST' || /[?&]token=/.test(req.url);
  if (apikey !== undefined && apikey !== PUBLISHABLE) { res.writeHead(401, { 'content-type': 'application/json' }); return res.end('{"message":"Invalid API key"}'); }
  if (apikey === undefined && !signedUpload && !/^\/auth\/v1\/(health|settings)/.test(req.url) && !auth.startsWith('Bearer ey')) {
    res.writeHead(401, { 'content-type': 'application/json' }); return res.end('{"message":"No API key found in request"}');
  }
  const headers = { ...req.headers };
  delete headers.host;
  const bearer = auth.replace(/^Bearer\s+/i, '');
  if (!bearer || bearer === PUBLISHABLE) headers.authorization = `Bearer ${keys.anon}`;
  if (route[0] !== '/auth/v1') delete headers.apikey; else headers.apikey = keys.anon;
  const target = new URL(route[1] + route[2] + req.url.slice(route[0].length));
  const upstream = http.request(target, { method: req.method, headers }, up => {
    res.writeHead(up.statusCode ?? 502, up.headers); up.pipe(res);
    log.push(`${req.method} ${req.url.split('?')[0]} ${up.statusCode}`); if (log.length > 500) log.shift();
  });
  upstream.on('error', () => { if (!res.headersSent) { res.writeHead(502); } res.end(); });
  req.pipe(upstream);
}).listen(port, '127.0.0.1', () => console.log(JSON.stringify({ gateway: `http://127.0.0.1:${port}`, publishable_key: PUBLISHABLE })));
