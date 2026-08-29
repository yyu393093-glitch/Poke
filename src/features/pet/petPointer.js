export function classifyPetPointer(start, current, threshold = 4) {
  return Math.hypot(current.x - start.x, current.y - start.y) > threshold ? 'drag' : 'click';
}
