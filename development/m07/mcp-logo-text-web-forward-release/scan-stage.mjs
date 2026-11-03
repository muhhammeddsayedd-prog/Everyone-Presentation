/** Fixed reviewed scanner body, fresh namespace, and disabled before private reads. */
import assert from 'node:assert/strict';
import {readFile}from 'node:fs/promises';
import {createHash}from 'node:crypto';
import {Buffer}from 'node:buffer';
import {URL}from 'node:url';
const flag=await readFile(new URL('./release.py',import.meta.url),'utf8');
assert.equal([...flag.matchAll(/^RELEASE_ENABLED=True$/gmu)].length,1);
const inherited=await readFile('D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/logo-recovery-web-forward-release/scan-stage.mjs');
assert.equal(createHash('sha256').update(inherited).digest('hex'),'c9ab2c5ebbf9f677850e22d9480e5d86d8c4daf4eb690eea7497717ecd260af7');
const raw=await readFile('D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/logo-failure-trace-web-release/scan-stage.mjs');
assert.equal(createHash('sha256').update(raw).digest('hex'),'35602b3a6d6a3c237adff015ec067e2a1cdf3af9a64bc3a39d90c4bac9cb8e3a');
const before=raw.toString('utf8');
const text=before.replaceAll('logo-failure-trace-web-release','mcp-logo-text-web-forward-release').replaceAll('LOGO_FAILURE_TRACE','MCP_LOGO_TEXT_WEB_FORWARD');
assert.equal(text.replaceAll('mcp-logo-text-web-forward-release','logo-failure-trace-web-release').replaceAll('MCP_LOGO_TEXT_WEB_FORWARD','LOGO_FAILURE_TRACE'),before);
await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
