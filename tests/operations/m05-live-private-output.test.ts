import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { createCanvas } from '@napi-rs/canvas';
import { writePrivateInspectionFile } from '../../tools/inspect-m05-live-pdf.mts';

test('Windows private inspection writer creates a protected synthetic PNG under a scrubbed environment and denies overwrite', { skip: process.platform !== 'win32' }, async () => {
  const folder = path.resolve('.local/m05-live/inspections', new Date().toISOString().replaceAll(':', '-'));
  const file = path.join(folder, 'a5050000-0000-4000-8000-000000000099-1.png');
  const bytes = createCanvas(1, 1).toBuffer('image/png');
  await writePrivateInspectionFile(file, bytes);
  assert.deepEqual(await readFile(file), bytes);
  const expected = createHash('sha256').update(bytes).digest('hex');
  await assert.rejects(writePrivateInspectionFile(file, createCanvas(2, 2).toBuffer('image/png')));
  assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), expected);
  await assert.rejects(writePrivateInspectionFile(path.resolve('.local/unrelated.png'), bytes));
});
