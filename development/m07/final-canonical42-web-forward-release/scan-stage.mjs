/** Same reviewed scanner; this fresh entry must be armed before private reads. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const flag = await readFile(new URL('./release.py', import.meta.url), 'utf8');
assert.equal([...flag.matchAll(/^RELEASE_ENABLED=True$/gmu)].length, 1);
const previous = await readFile('D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/mcp-logo-text-web-forward-release/scan-stage.mjs');
assert.equal(createHash('sha256').update(previous).digest('hex'), 'babaec86e121ca6ae8c9609552ea45074a267826ab41913025c31581cafc6670');
const raw = await readFile('D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/logo-failure-trace-web-release/scan-stage.mjs');
assert.equal(createHash('sha256').update(raw).digest('hex'), '35602b3a6d6a3c237adff015ec067e2a1cdf3af9a64bc3a39d90c4bac9cb8e3a');
const before = raw.toString('utf8');
const text = before.replaceAll('logo-failure-trace-web-release', 'final-canonical42-web-forward-release').replaceAll('LOGO_FAILURE_TRACE', 'FINAL_CANONICAL42_WEB_FORWARD');
assert.equal(text.replaceAll('final-canonical42-web-forward-release', 'logo-failure-trace-web-release').replaceAll('FINAL_CANONICAL42_WEB_FORWARD', 'LOGO_FAILURE_TRACE'), before);
await import('data:text/javascript;base64,' + Buffer.from(text).toString('base64'));
