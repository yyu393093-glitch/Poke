import test from 'node:test';
import assert from 'node:assert/strict';
import { getPetWindowBounds } from '../electron/windows/petWindow.cjs';

test('expanded pet window grows upward from the bottom work area', () => {
  assert.deepEqual(getPetWindowBounds({ x: 1200, y: 900 }, true, { x: 0, y: 0, width: 1280, height: 972 }), { x: 992, y: 832, width: 280, height: 140 });
});

test('expanded pet window is clamped inside the work area', () => {
  assert.deepEqual(getPetWindowBounds({ x: 0, y: 0 }, true, { x: 0, y: 0, width: 1280, height: 972 }), { x: 0, y: 0, width: 280, height: 140 });
});