import { globSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const patterns = process.argv.slice(2);
if (!patterns.length) throw new Error('Supply the intended test files.');
const files = patterns.flatMap(pattern => {
  const matches = globSync(pattern);
  if (!matches.length) throw new Error(`Required test suite has no matching files: ${pattern}`);
  return matches;
});
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...new Set(files)], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
