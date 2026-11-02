/** Fresh disabled collector-context purpose; no consumed entry or claim replay. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
export const EXECUTION_ENABLED=true;
export async function runCases(ctx,cfg){
 assert(EXECUTION_ENABLED,'WORKER40_OBSERVATION_PROOF_DISABLED');assert.equal(ctx.root,'D:/Everyone/Presentation/Everyone-Presentation-Studio');assert.notEqual(ctx.system,'7701520506262638626');assert.equal(ctx.report.dispatch_once_claim_created,true);
 const file=cfg.admin_callback_file,folder=path.join(ctx.root,'.local/worker-source-identity-sql-observation-compiled');assert.equal(path.dirname(file),folder);assert(/^callback-[a-f0-9-]{36}\.mjs$/u.test(path.basename(file)));const info=await lstat(file);assert(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1&&info.size<128*1024);assert.equal(await realpath(file),file);assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),cfg.admin_callback_sha256);
 await(await import(pathToFileURL(file).href)).runCases(ctx,cfg);
}
