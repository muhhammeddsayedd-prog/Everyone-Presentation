/** Same fixed scanner, fresh OFF-before-private-read purpose. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const flag = await readFile(new URL('./release.py', import.meta.url), 'utf8');
assert.equal([...flag.matchAll(/^RELEASE_ENABLED=True$/gmu)].length, 1);
const parent = await readFile('D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/final-canonical42-web-forward-release/scan-stage.mjs');
assert.equal(createHash('sha256').update(parent).digest('hex'), 'cc2c224acf1e45fb8dbd596304269099d3e32f574b67e18463c90670111984e4');
const raw = await readFile('D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/logo-failure-trace-web-release/scan-stage.mjs');
assert.equal(createHash('sha256').update(raw).digest('hex'), '35602b3a6d6a3c237adff015ec067e2a1cdf3af9a64bc3a39d90c4bac9cb8e3a');
const before = raw.toString('utf8');
const text = before.replaceAll('logo-failure-trace-web-release', 'presentation-pdf-metadata-web-forward-release').replaceAll('LOGO_FAILURE_TRACE', 'PRESENTATION_PDF_METADATA_WEB_FORWARD');
assert.equal(text.replaceAll('presentation-pdf-metadata-web-forward-release', 'logo-failure-trace-web-release').replaceAll('PRESENTATION_PDF_METADATA_WEB_FORWARD', 'LOGO_FAILURE_TRACE'), before);
await import('data:text/javascript;base64,' + Buffer.from(text).toString('base64'));
