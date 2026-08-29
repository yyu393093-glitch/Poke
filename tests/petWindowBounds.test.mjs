import test from 'node:test';
import assert from 'node:assert/strict';
import { getPetWindowBounds } from '../electron/windows/petWindow.cjs';

test('expanded pet window grows upward from the bottom work area', () => {
  assert.deepEqual(getPetWindowBounds({ x: 1200, y: 900 }, true, { x: 0, y: 0, width: 1280, height: 972 }), { x: 920, y: 822, width: 360, height: 150 });
});

test('expanded pet window is clamped inside the work area', () => {
  assert.deepEqual(getPetWindowBounds({ x: 0, y: 0 }, true, { x: 0, y: 0, width: 1280, height: 972 }), { x: 0, y: 0, width: 360, height: 150 });
});
