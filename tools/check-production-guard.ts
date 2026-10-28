import assert from 'node:assert/strict';
import { readRuntimeConfig } from '../apps/web/lib/config';
assert.throws(() => readRuntimeConfig({ NODE_ENV: 'production', APP_ENV: 'development', CENTRAL_ADAPTER_MODE: 'local_fixture' }));
assert.throws(() => readRuntimeConfig({ NODE_ENV: 'development', APP_ENV: 'production', CENTRAL_ADAPTER_MODE: 'local_fixture' }));
console.log('PASS: NODE_ENV and APP_ENV production fixture denial');
