import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFrameSeconds } from '../../apps/web/lib/candidate-frame-times.ts';
test('frame UI preserves millisecond precision and explicit source-relative zero',()=>{
  assert.deepEqual(parseFrameSeconds('0, 1.234, 15.05'),[0,1234,15050]);
});
test('frame UI rejects silent rounding, duplicates, empty and unbounded timestamps',()=>{
  for(const value of ['', '1,', '-1','1.0001','1e2','1,1.000','1800','1800.001',Array(11).fill('1').join(',')]) assert.throws(()=>parseFrameSeconds(value));
});
