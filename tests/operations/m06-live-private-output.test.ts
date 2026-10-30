import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { createCanvas } from '@napi-rs/canvas';
import { writePrivateGuestInspectionFile } from '../../tools/inspect-m06-live-pdf.mts';

test('guest inspection pages are OwnerSYSTEM private, bounded, deny overwrite and cannot escape the fixed output directory', { skip: process.platform !== 'win32' }, async () => {
  const folder = path.resolve('.local/m06-live/inspections', new Date().toISOString().replaceAll(':', '-'));
  const file = path.join(folder, 'a6060000-0000-4000-8000-000000000099-1.png'), bytes = createCanvas(1, 1).toBuffer('image/png');
  await writePrivateGuestInspectionFile(file, bytes); assert.deepEqual(await readFile(file), bytes);
  const expected = createHash('sha256').update(bytes).digest('hex');
  await assert.rejects(writePrivateGuestInspectionFile(file, createCanvas(2, 2).toBuffer('image/png')));
  assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), expected);
  await assert.rejects(writePrivateGuestInspectionFile(path.resolve('.local/m05-live/inspections/unrelated.png'), bytes));
  await assert.rejects(writePrivateGuestInspectionFile(path.join(folder, 'a6060000-0000-4000-8000-000000000098-1.png'), new Uint8Array([1, 2, 3])));
});
