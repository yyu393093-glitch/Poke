import test from 'node:test';
import assert from 'node:assert/strict';
import { getNextDropState } from '../src/features/pet/fileDropModel.js';

test('file drop advances through eating, consumed, and idle states', () => {
  assert.equal(getNextDropState('idle'), 'eating');
  assert.equal(getNextDropState('eating'), 'consumed');
  assert.equal(getNextDropState('consumed'), 'idle');
});