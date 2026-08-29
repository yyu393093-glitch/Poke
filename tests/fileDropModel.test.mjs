import test from 'node:test';
import assert from 'node:assert/strict';
import { getDropState, isSupportedDrop } from '../src/features/pet/fileDropModel.js';

test('file drop accepts a user-selected local file and ignores folders', () => {
  assert.equal(isSupportedDrop({ name: 'brief.pdf', size: 1024, type: 'application/pdf' }), true);
  assert.equal(isSupportedDrop({ name: '', size: 0, type: '' }), false);
});

test('file drop follows idle, eating, and consumed states', () => {
  assert.deepEqual(getDropState('idle'), { phase: 'idle', label: '把文件拖给我' });
  assert.deepEqual(getDropState('eating'), { phase: 'eating', label: '咕噜…吃掉文件' });
  assert.deepEqual(getDropState('consumed'), { phase: 'consumed', label: '收到，打开协作网络' });
});
