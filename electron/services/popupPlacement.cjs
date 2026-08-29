const POPUP_WIDTH = 256;
const GAP = 12;
function choosePopupSide(bounds, expanded, workArea) {
  if (!expanded) return 'left';
  const leftSpace = bounds.x - workArea.x;
  const rightSpace = workArea.x + workArea.width - (bounds.x + bounds.width);
  if (leftSpace >= POPUP_WIDTH + GAP) return 'left';
  if (rightSpace >= POPUP_WIDTH + GAP) return 'right';
  return leftSpace >= rightSpace ? 'left' : 'right';
}
module.exports = { choosePopupSide };