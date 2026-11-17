// Derives the staging stack's keys from .local/cycle7/stg/secrets.json and writes Docker env files.
// Usage: node keys.mjs env <dir>   |   node keys.mjs token <user-id> <email>   (prints nothing secret to stdout for `env`)
import { createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const [, , command, dir] = process.argv;
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../..');
const secrets = JSON.parse(readFileSync(path.join(root, '.local/cycle7/stg/secrets.json'), 'utf8'));
const b64 = v => Buffer.from(JSON.stringify(v)).toString('base64url');
export function sign(claims) { const h = b64({ alg: 'HS256', typ: 'JWT' }), b = b64(claims); return `${h}.${b}.${createHmac('sha256', secrets.jwt).update(`${h}.${b}`).digest('base64url')}`; }
const far = Math.floor(Date.now() / 1000) + 3600 * 24 * 365;
export const anon = sign({ role: 'anon', iss: 'supabase', iat: Math.floor(Date.now() / 1000), exp: far });
export const service = sign({ role: 'service_role', iss: 'supabase', iat: Math.floor(Date.now() / 1000), exp: far });

if (command === 'env') {
  mkdirSync(path.join(dir, 'env'), { recursive: true });
  const db = `postgres://supabase_auth_admin:${secrets.pg}@eps-c7stg-db:5432/postgres`;
  const env = {
    'db.env': { POSTGRES_PASSWORD: secrets.pg, JWT_SECRET: secrets.jwt, JWT_EXP: '3600', POSTGRES_HOST: '/var/run/postgresql', POSTGRES_PORT: '5432', POSTGRES_DB: 'postgres' },
    'auth.env': { GOTRUE_API_HOST: '0.0.0.0', GOTRUE_API_PORT: '9999', API_EXTERNAL_URL: 'http://127.0.0.1:55511/auth/v1', GOTRUE_DB_DRIVER: 'postgres',
      GOTRUE_DB_DATABASE_URL: db, GOTRUE_SITE_URL: 'http://127.0.0.1:3000', GOTRUE_URI_ALLOW_LIST: 'http://127.0.0.1:3000/**', GOTRUE_DISABLE_SIGNUP: 'true',
      GOTRUE_JWT_ADMIN_ROLES: 'service_role', GOTRUE_JWT_AUD: 'authenticated', GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated', GOTRUE_JWT_EXP: '3600',
      GOTRUE_JWT_SECRET: secrets.jwt, GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true', GOTRUE_MAILER_AUTOCONFIRM: 'true', GOTRUE_EXTERNAL_PHONE_ENABLED: 'false' },
    'storage.env': { ANON_KEY: anon, SERVICE_KEY: service, AUTH_JWT_SECRET: secrets.jwt, AUTH_JWT_ALGORITHM: 'HS256', PGRST_JWT_SECRET: secrets.jwt,
      DATABASE_URL: `postgres://supabase_storage_admin:${secrets.pg}@eps-c7stg-db:5432/postgres`, FILE_SIZE_LIMIT: '524288000', STORAGE_BACKEND: 'file',
      FILE_STORAGE_BACKEND_PATH: '/var/lib/storage', TENANT_ID: 'stub', REGION: 'local', GLOBAL_S3_BUCKET: 'stub', ENABLE_IMAGE_TRANSFORMATION: 'false',
      DB_INSTALL_ROLES: 'false', STORAGE_PUBLIC_URL: 'http://127.0.0.1:55511' },
    'rest.env': { PGRST_DB_URI: `postgres://authenticator:${secrets.pg}@eps-c7stg-db:5432/postgres`, PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon',
      PGRST_JWT_SECRET: secrets.jwt, PGRST_DB_USE_LEGACY_GUCS: 'false', PGRST_APP_SETTINGS_JWT_SECRET: secrets.jwt, PGRST_APP_SETTINGS_JWT_EXP: '3600' },
  };
  for (const [file, values] of Object.entries(env)) writeFileSync(path.join(dir, 'env', file), Object.entries(values).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
  writeFileSync(path.join(dir, 'keys.json'), JSON.stringify({ anon, service }));
  console.log('env files written');
} else if (command === 'token') {
  const [, , , sub, email] = process.argv; const exp = Math.floor(Date.now() / 1000) + 3600;
  process.stdout.write(sign({ sub, email, role: 'authenticated', aud: 'authenticated', exp }));
}
