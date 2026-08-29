import test from 'node:test';
import assert from 'node:assert/strict';
import { isPokeRendererAssetResponse } from '../electron/services/rendererHealth.cjs';

test('renderer health accepts the Poke mascot asset response', () => {
  assert.equal(isPokeRendererAssetResponse({ status: 200, contentType: 'image/png' }), true);
});

test('renderer health rejects a different dev server returning HTML', () => {
  assert.equal(isPokeRendererAssetResponse({ status: 200, contentType: 'text/html' }), false);
});