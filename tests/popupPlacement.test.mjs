import test from 'node:test';
import assert from 'node:assert/strict';
import { choosePopupSide } from '../electron/services/popupPlacement.cjs';

test('popup prefers the empty side beside the pet', () => {
  assert.equal(choosePopupSide({ x: 1000, y: 700, width: 96, height: 96 }, true, { x: 0, y: 0, width: 1440, height: 900 }), 'left');
  assert.equal(choosePopupSide({ x: 10, y: 700, width: 96, height: 96 }, true, { x: 0, y: 0, width: 1440, height: 900 }), 'right');
});