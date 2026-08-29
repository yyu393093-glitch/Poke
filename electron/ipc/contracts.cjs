const MAX_TEXT = 4000;
function assertPlainObject(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Payload must be an object'); }
function validateKeys(value, allowed) { const unknown = Object.keys(value).filter((key) => !allowed.includes(key)); if (unknown.length) throw new Error(`Unknown field: ${unknown[0]}`); }
function text(value, field) { if (typeof value !== 'string' || value.trim() === '' || value.length > MAX_TEXT) throw new Error(`Invalid ${field}`); return value.trim(); }
function validatePokePayload(value) { assertPlainObject(value); validateKeys(value, ['from', 'to', 'teamId']); return { from: text(value.from, 'from'), to: text(value.to, 'to'), teamId: text(value.teamId, 'teamId') }; }
function validateChatPayload(value) { assertPlainObject(value); validateKeys(value, ['sessionId', 'teamId', 'query', 'useTeamKnowledge']); const result = { sessionId: text(value.sessionId, 'sessionId'), teamId: text(value.teamId, 'teamId'), query: text(value.query, 'query') }; if (value.useTeamKnowledge !== undefined && typeof value.useTeamKnowledge !== 'boolean') throw new Error('Invalid useTeamKnowledge'); result.useTeamKnowledge = value.useTeamKnowledge === true; return result; }
const PET_MODES = new Set(['collapsed', 'peek', 'panel']);
function validatePetSnapshot(value) {
  assertPlainObject(value);
  validateKeys(value, ['progress', 'nodes', 'edges', 'pokes', 'notifications', 'currentUser']);
  for (const key of ['nodes', 'edges', 'pokes', 'notifications']) {
    if (!Array.isArray(value[key])) throw new Error(`Invalid snapshot ${key}: must be an array`);
  }
  return value;
}
function validatePetMode(value) {
  assertPlainObject(value);
  validateKeys(value, ['mode', 'flipX', 'flipY']);
  if (!PET_MODES.has(value.mode)) throw new Error('Invalid mode');
  return { mode: value.mode, flipX: value.flipX === true, flipY: value.flipY === true };
}
function validatePetMove(value) {
  assertPlainObject(value);
  validateKeys(value, ['dx', 'dy']);
  if (![value.dx, value.dy].every(Number.isFinite) || Math.abs(value.dx) > 200 || Math.abs(value.dy) > 200) throw new Error('Invalid pet move delta');
  return { dx: value.dx, dy: value.dy };
}
module.exports = { MAX_TEXT, validatePokePayload, validateChatPayload, validatePetSnapshot, validatePetMode, validatePetMove };
