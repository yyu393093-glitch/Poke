const fs = require('node:fs');
const path = require('node:path');
function normalizePosition(value, workArea) {
  const x = Number.isFinite(value?.x) ? value.x : workArea.x + workArea.width - 88;
  const y = Number.isFinite(value?.y) ? value.y : workArea.y + workArea.height - 88;
  return { x: Math.min(Math.max(x, workArea.x), workArea.x + workArea.width - 72), y: Math.min(Math.max(y, workArea.y), workArea.y + workArea.height - 72) };
}
function createPetPositionStore(filePath, getWorkArea) {
  return {
    get: () => { try { return normalizePosition(JSON.parse(fs.readFileSync(filePath, 'utf8')), getWorkArea()); } catch { return normalizePosition({}, getWorkArea()); } },
    set: (value) => { const position = normalizePosition(value, getWorkArea()); fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, JSON.stringify(position), 'utf8'); return position; },
  };
}
module.exports = { createPetPositionStore, normalizePosition };
