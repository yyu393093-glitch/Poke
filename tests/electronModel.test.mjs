import test from 'node:test';
import assert from 'node:assert/strict';

const contracts = await import('../electron/ipc/contracts.cjs');
const state = await import('../electron/windows/floatWindowState.cjs');
const config = await import('../electron/services/configStore.cjs');

 test('Poke IPC ??????? payload', () => {
  assert.deepEqual(contracts.validatePokePayload({ from: '??', to: 'n_brand', teamId: 'team-demo' }), { from: '??', to: 'n_brand', teamId: 'team-demo' });
  assert.throws(() => contracts.validatePokePayload({ from: '??', to: 'n_brand' }), /teamId/);
  assert.throws(() => contracts.validatePokePayload({ from: '??', to: 'n_brand', teamId: 'team-demo', url: 'https://x' }), /Unknown/);
 });

 test('Chat IPC ??????????', () => {
  assert.deepEqual(contracts.validateChatPayload({ sessionId: 's1', teamId: 'team-demo', query: '??', useTeamKnowledge: false }).query, '??');
  assert.throws(() => contracts.validateChatPayload({ sessionId: 's1', teamId: 'team-demo', query: '' }), /query/);
  assert.throws(() => contracts.validateChatPayload({ sessionId: 's1', teamId: 'team-demo', query: 'x'.repeat(4001) }), /query/);
 });

 test('?????????????', () => {
  assert.equal(state.nextFloatState('NOT_CREATED', 'OPEN'), 'VISIBLE');
  assert.equal(state.nextFloatState('VISIBLE', 'TOGGLE_HOTKEY'), 'BALL');
  assert.equal(state.nextFloatState('BALL', 'OPEN'), 'VISIBLE');
  assert.equal(state.nextFloatState('VISIBLE', 'CLOSE'), 'HIDDEN');
  assert.equal(state.nextFloatState('HIDDEN', 'QUIT'), 'DESTROYED');
  assert.throws(() => state.nextFloatState('DESTROYED', 'OPEN'), /Invalid/);
 });

 test('??????????????????', () => {
  const safe = config.normalizeWindowConfig({ position: { x: -5000, y: 10000 }, size: { width: 20, height: 5000 }, alwaysOnTop: 'yes' }, { x: 0, y: 0, width: 1440, height: 900 });
  assert.deepEqual(safe, { position: { x: 0, y: 0 }, size: { width: 420, height: 600 }, alwaysOnTop: false, globalHotkey: 'Alt+A', isMinToFloatBall: false });
 });
