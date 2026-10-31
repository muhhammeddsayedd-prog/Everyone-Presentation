import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { verifyNativeSourceSeal } from '../../apps/worker/src/native-source-seal.ts';
// @ts-expect-error reviewed build-only ESM has no generated declaration
import { workerContextFiles } from '../../tools/worker-hosting-build.mjs';
const contracts = ['candidate-extraction', 'frame-selection', 'slide-wording', 'specs-extraction'].map(stem => `contracts/json-schema/${stem}.schema.json`).sort();
const sha = (value: string) => createHash('sha256').update(value).digest('hex');

test('the sparse context includes exactly the runtime JSON-schema import closure', async () => {
  const actual = (await workerContextFiles()).map((row: { path: string }) => row.path).filter((p: string) => p.startsWith('contracts/')).sort();
  const imported = new Set<string>();
  for (const file of await readdir(new URL('../../packages/integrations/src/', import.meta.url))) if (file.endsWith('.ts')) {
    const source = await readFile(new URL('../../packages/integrations/src/' + file, import.meta.url), 'utf8');
    for (const match of source.matchAll(/from ['"]\.\.\/\.\.\/\.\.\/(contracts\/json-schema\/[A-Za-z0-9.-]+\.json)['"]/gu)) imported.add(match[1]);
  }
  assert.deepEqual([...imported].sort(), contracts); assert.deepEqual(actual, contracts);
});
test('only the four exact public runtime contracts enter a source seal, and unknown contracts fail before reading', () => {
  for (const path of [...contracts, 'contracts/json-schema/job-event.schema.json', 'contracts/json-schema/specs-extraction.schema.json.bak', 'contracts/private.schema.json']) {
    const files = [{ path, sha256: sha('{}'), bytes: 2 }]; const source = { files, source_sha256: sha(JSON.stringify(files)) }; let reads = 0;
    const verify = () => verifyNativeSourceSeal(source, source.source_sha256, () => { reads++; return Buffer.from('{}'); });
    if (contracts.includes(path)) { assert.doesNotThrow(verify); assert.equal(reads, 1); } else { assert.throws(verify); assert.equal(reads, 0); }
  }
});
test('both production images merge workspace-local dependencies and copy only the four required schema files', async () => {
  for (const kind of ['daemon', 'native-sandbox']) {
    const docker = await readFile(new URL(`../../apps/worker/Dockerfile.${kind}`, import.meta.url), 'utf8');
    assert(docker.includes('npm ci --omit=dev --ignore-scripts --workspace @eps/worker --include-workspace-root=false'));
    for (const copy of ['COPY --from=dependencies /opt/eps/apps ./apps', 'COPY --from=dependencies /opt/eps/packages ./packages']) {
      assert(docker.includes(copy), kind + ': ' + copy); assert(docker.indexOf(copy) > docker.indexOf('COPY packages ./packages'));
    }
    for (const path of contracts) assert(docker.includes(path), kind + ': ' + path);
    assert(!docker.includes('COPY contracts ./contracts') && !docker.includes('COPY contracts/ ./contracts'));
  }
});
test('daemon production import closure is checked without network under its final nonprivileged UID', async () => {
  const docker = await readFile(new URL('../../apps/worker/Dockerfile.daemon', import.meta.url), 'utf8');
  const command = 'RUN --network=none /usr/local/bin/node --import tsx --input-type=module -e "await import(\'./apps/worker/src/runtime-main.ts\')"';
  assert(docker.includes(command)); assert(docker.indexOf(command) > docker.indexOf('USER 1000:1000'));
});
