// Prints a local HS256 access token for a seeded user (integrated check only).
import { createHmac } from 'node:crypto';
const [sub = 'c7000000-0000-4000-8000-0000000000a1', email = 'producer-a@example.invalid'] = process.argv.slice(2);
const secret = process.env.EPS_INT_JWT_SECRET; if (!secret) throw new Error('EPS_INT_JWT_SECRET required');
const b = v => Buffer.from(JSON.stringify(v)).toString('base64url');
const head = b({ alg: 'HS256', typ: 'JWT' }), body = b({ sub, email, role: 'authenticated', aud: 'authenticated', is_anonymous: false, exp: Math.floor(Date.now() / 1000) + 8 * 3600 });
console.log(`${head}.${body}.${createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')}`);
