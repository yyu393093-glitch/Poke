const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_PET_PROGRESS = {
  projectName: '官网改版', done: 2, total: 6, bottlenecks: 1, blockedDownstream: 2,
  headline: '首页设计稿正在等待品牌素材', phase: 'blocked',
};
const PHASES = new Set(['normal', 'blocked', 'waiting', 'off', 'error']);
function normalize(value = {}) {
  const result = { ...DEFAULT_PET_PROGRESS, ...value };
  const valid = typeof result.projectName === 'string' && result.projectName.trim()
    && typeof result.headline === 'string' && result.headline.trim()
    && PHASES.has(result.phase) && Number.isInteger(result.total) && result.total > 0
    && Number.isInteger(result.done) && result.done >= 0 && result.done <= result.total
    && Number.isInteger(result.bottlenecks) && result.bottlenecks >= 0
    && Number.isInteger(result.blockedDownstream) && result.blockedDownstream >= 0;
  return valid ? result : { ...DEFAULT_PET_PROGRESS };
}
function createPetProgressStore(filePath) {
  let current = { ...DEFAULT_PET_PROGRESS };
  try { current = normalize(JSON.parse(fs.readFileSync(filePath, 'utf8'))); } catch { /* use demo state */ }
  return {
    get: () => ({ ...current }),
    set: (value) => { current = normalize(value); fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, JSON.stringify(current, null, 2), 'utf8'); return { ...current }; },
    reset: () => { current = { ...DEFAULT_PET_PROGRESS }; return { ...current }; },
  };
}
module.exports = { DEFAULT_PET_PROGRESS, normalizePetProgress: normalize, createPetProgressStore };
