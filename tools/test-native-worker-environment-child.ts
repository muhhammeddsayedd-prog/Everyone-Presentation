import assert from 'node:assert/strict';
import { rasterPdfPages } from '../apps/worker/src/pdf-raster.ts';
import { nativeDockerEnvironment } from '../apps/worker/src/video-container.ts';
import { pdf } from '../tests/worker/document-fixtures.ts';
const imageId = 'sha256:52110c040822f1f1ecfd087518daa7583569c64a641dbdfe6585b5e8b7a98979';
async function main() {
for (const name of ['PATH', 'Path']) if (process.env[name] !== '') throw Object.assign(new Error('The worker child unexpectedly inherited a path.'), { code: name === 'PATH' ? 'WORKER_UPPER_PATH_PRESENT' : 'WORKER_MIXED_PATH_PRESENT' });
const native = nativeDockerEnvironment(process.env);
assert.equal(native.PATH, '');
for (const name of ['OPENAI_API_KEY', 'EPS_SPECS_PG_PASSWORD', 'N8N_DISPATCH_SECRET', 'DOCKER_HOST']) if (native[name] !== undefined) throw Object.assign(new Error('The native child unexpectedly inherited a secret or endpoint.'), { code: 'NATIVE_PRIVATE_ENVIRONMENT_PRESENT' });
const value = await rasterPdfPages(pdf(['Synthetic scrubbed worker raster fixture']), 'synthetic-scrubbed-source', [1], { imageId });
assert.equal(value.pages.length, 1); assert(value.pages[0].bytes.length > 0);
process.stdout.write(JSON.stringify({ native_image_id: imageId, rasterizer_version: value.rasterizer_version, actual_raster_page: value.pages[0].page, width: value.pages[0].width, height: value.pages[0].height, sha256: value.pages[0].sha256, native_cli_secret_names_present: false }) + '\n');
}
void main().catch(error => { const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[A-Z_]{1,100}$/u.test(error.code) ? error.code : 'SCRUBBED_NATIVE_UNCONFIRMED'; process.stdout.write(JSON.stringify({ failed: true, code })); process.exitCode = 1; });
