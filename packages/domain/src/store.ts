import { mkdir, open, readFile, rename, rmdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { DomainError } from './types.ts';

/** A synthetic development adapter. Never an alternate production database. */
export class FixtureStore<T> {
  readonly root: string;
  readonly file: string;
  private initial: () => T;
  constructor(root: string, initial: () => T) {
    this.root = resolve(root);
    this.file = join(this.root, 'synthetic-studio.json');
    this.initial = initial;
  }

  async transaction<R>(write: boolean, action: (state: T) => Promise<R> | R): Promise<R> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const lockPath = join(this.root, 'synthetic-studio.lock');
    const token = randomUUID();
    const deadline = Date.now() + 5_000;
    for (;;) {
      try { await mkdir(lockPath, { mode: 0o700 }); break; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        if (Date.now() >= deadline) throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Local fixture storage is locked. Retry or inspect the local lock owner.', 503, {}, true);
        await new Promise(done => setTimeout(done, 15));
      }
    }
    await writeFile(join(lockPath, 'owner.json'), JSON.stringify({ token, pid: process.pid }), { mode: 0o600 });
    try {
      let state: T;
      try { state = JSON.parse(await readFile(this.file, 'utf8')) as T; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Local fixture state is unreadable; preserve the file and inspect it.', 503);
        state = this.initial();
        await this.atomicWrite(this.file, Buffer.from(JSON.stringify(state)));
      }
      const result = await action(state);
      if (write) await this.atomicWrite(this.file, Buffer.from(JSON.stringify(state)));
      return structuredClone(result);
    } finally {
      const owner = JSON.parse(await readFile(join(lockPath, 'owner.json'), 'utf8')) as { token: string };
      if (owner.token === token) {
        await unlink(join(lockPath, 'owner.json'));
        await rmdir(lockPath);
      }
    }
  }

  async atomicWrite(path: string, bytes: Uint8Array): Promise<void> {
    const temporary = `${path}.${randomUUID()}.tmp`;
    const handle = await open(temporary, 'wx', 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); }
    finally { await handle.close(); }
    try { await rename(temporary, path); }
    catch (error) { await unlink(temporary).catch(() => undefined); throw error; }
  }
}
