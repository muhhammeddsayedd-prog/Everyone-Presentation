import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Verifies this snapshot in place; no writes, network access or dependencies.
const root = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFile(join(root, path), 'utf8');
const manifest = JSON.parse(await read('manifest.json'));
assert.equal(manifest.schema_version, 1, 'Unsupported manifest version');

function inside(path) {
  assert.equal(typeof path, 'string');
  assert(path.length > 0 && !isAbsolute(path), 'Expected a relative path');
  const target = resolve(root, path);
  const local = relative(root, target);
  assert(local !== '..' && !local.startsWith('../') && !local.startsWith('..\\'), 'Path escapes kit');
  return target;
}

async function filesIn(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink(), 'Snapshot must not contain symbolic links');
    const path = prefix + entry.name;
    if (entry.isDirectory()) result.push(...(await filesIn(join(directory, entry.name), path + '/')));
    else {
      assert(entry.isFile(), 'Unexpected filesystem entry');
      result.push(path);
    }
  }
  return result.sort();
}

assert(Array.isArray(manifest.files) && manifest.files.length > 0, 'Empty manifest');
const listed = new Set();
for (const file of manifest.files) {
  assert(!listed.has(file.path), 'Duplicate manifest path');
  listed.add(file.path);
  assert(/^[a-f0-9]{64}$/.test(file.sha256), 'Invalid checksum');
  const bytes = await readFile(inside(file.path));
  assert.equal(bytes.length, file.bytes, `Size mismatch: ${file.path}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, `Hash mismatch: ${file.path}`);
}
assert.deepEqual(await filesIn(root), [...listed, 'manifest.json'].sort(), 'File inventory differs');

function cssTokens(css, selector) {
  const block = css.replace(/\/\*[\s\S]*?\*\//g, '').match(selector)?.[1];
  assert(block, 'Missing CSS theme block');
  const tokens = {};
  for (const [, key, value] of block.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    assert(!Object.hasOwn(tokens, key), 'Duplicate CSS token');
    tokens[key] = value.trim();
  }
  return tokens;
}

function jsonTokens(groups) {
  const entries = Object.values(groups).flatMap((group) => Object.entries(group));
  const tokens = Object.fromEntries(entries);
  assert.equal(Object.keys(tokens).length, entries.length, 'Duplicate JSON token');
  return tokens;
}

const css = await read('assets/brand/tokens.css');
const tokens = JSON.parse(await read('assets/brand/tokens.json'));
const dark = cssTokens(css, /:root\s*\{([^}]+)\}/);
const light = cssTokens(css, /:root\[data-theme="light"\]\s*\{([^}]+)\}/);
assert(Object.keys(dark).length > 100, 'Dark token set incomplete');
assert(Object.keys(light).length > 20, 'Light token set incomplete');
assert.deepEqual(jsonTokens(tokens.themes.dark), dark, 'Dark CSS/JSON mismatch');
assert.deepEqual(jsonTokens(tokens.themes.light_overrides), light, 'Light CSS/JSON mismatch');
assert.equal(
  (await read('reference/market-radar/apps/web/styles/tokens.css')).replace(/\r\n/g, '\n'),
  css.replace(/\r\n/g, '\n'),
  'App token mirror differs',
);

const guides = [
  'README.md',
  'REUSE_GUIDE.md',
  'COMPONENTS.md',
  'FONT_SETUP.md',
  'ASSET_CATALOG.md',
  'AI_HANDOFF.md',
  'reference/CONTEXT.md',
];
let localLinks = 0;
for (const guide of guides) {
  for (const [, href] of (await read(guide)).matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = href.replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    await stat(inside(join(dirname(guide), decodeURIComponent(target))));
    localLinks += 1;
  }
}

process.stdout.write(
  JSON.stringify(
    {
      status: 'PASS',
      checkedFiles: listed.size,
      copiedSources: manifest.files.filter((file) => file.source_path).length,
      darkTokens: Object.keys(dark).length,
      lightOverrides: Object.keys(light).length,
      localLinks,
      scope: 'Snapshot integrity and static consistency; no browser or application execution',
    },
    null,
    2,
  ) + '\n',
);
