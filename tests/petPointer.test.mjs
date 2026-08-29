import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPetPointer } from '../src/features/pet/petPointer.js';

test('短按桌宠保留为点击', () => {
  assert.equal(classifyPetPointer({ x: 100, y: 100 }, { x: 102, y: 101 }), 'click');
});

test('指针移动超过阈值才进入拖动', () => {
  assert.equal(classifyPetPointer({ x: 100, y: 100 }, { x: 105, y: 100 }), 'drag');
  assert.equal(classifyPetPointer({ x: 100, y: 100 }, { x: 102, y: 102 }), 'click');
});
