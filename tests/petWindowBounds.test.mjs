import test from 'node:test';
import assert from 'node:assert/strict';
import { getAnchoredModeBounds, getPetAnchorFromBounds, SIZES } from '../electron/windows/petWindow.cjs';

const anchor = { x: 700, y: 700, width: 72, height: 72 };

for (const flip of [
  { flipX: false, flipY: false },
  { flipX: true, flipY: false },
  { flipX: false, flipY: true },
  { flipX: true, flipY: true },
]) {
  test(`peek 在 flipX=${flip.flipX}, flipY=${flip.flipY} 时保持桌宠屏幕坐标`, () => {
    const bounds = getAnchoredModeBounds(anchor, 'peek', flip);
    assert.deepEqual(getPetAnchorFromBounds(bounds, flip), anchor);
  });
}

test('peek、panel、collapsed 切换始终使用同一桌宠锚点', () => {
  const flip = { flipX: true, flipY: true };
  const peek = getAnchoredModeBounds(anchor, 'peek', flip);
  const panel = getAnchoredModeBounds(getPetAnchorFromBounds(peek, flip), 'panel', flip);
  const collapsed = getAnchoredModeBounds(getPetAnchorFromBounds(panel, flip), 'collapsed', flip);

  assert.deepEqual(getPetAnchorFromBounds(peek, flip), anchor);
  assert.deepEqual(getPetAnchorFromBounds(panel, flip), anchor);
  assert.deepEqual(collapsed, anchor);
  assert.equal(SIZES.peek.width, 444);
  assert.equal(SIZES.panel.width, 464);
});
