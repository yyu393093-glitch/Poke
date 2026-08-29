import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PET_PROGRESS, derivePetProgress, normalizePetProgress, getOffProgress } from '../src/components/petModel.js';

test('pet progress exposes the allowed summary fields', () => {
  assert.deepEqual(derivePetProgress([
    { id: 'n_brand', status: 'doing', isBottleneck: true },
    { id: 'n_design', status: 'doing', isBottleneck: false },
    { id: 'n_dev', status: 'todo', isBottleneck: false },
  ]), { ...DEFAULT_PET_PROGRESS, done: 0, total: 3 });
});

test('pet progress falls back when local data is invalid', () => {
  assert.deepEqual(normalizePetProgress({ projectName: '', done: -1 }), DEFAULT_PET_PROGRESS);
});

test('pet progress supports the off state', () => {
  assert.equal(getOffProgress(DEFAULT_PET_PROGRESS).phase, 'off');
});
