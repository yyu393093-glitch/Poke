const { validatePokePayload, validateChatPayload, validatePetSnapshot, validatePetMode, validatePetMove } = require('./contracts.cjs');
const { sendPoke } = require('../services/pokeService.cjs');
const { sendChat } = require('../services/chatService.cjs');
function registerHandlers({ ipcMain, showMain, showAssistant, toggleAssistant, setAlwaysOnTop, setPetExpanded, setPetPaused, resetPet, showPetMenu, broadcastPoke, broadcastPetProgress, broadcastPetSnapshot, setPetMode, movePetBy }) {
  ipcMain.handle('main:open', () => showMain());
  ipcMain.handle('pet:set-expanded', (_event, expanded) => setPetExpanded(Boolean(expanded)));
  ipcMain.on('pet:click', () => showMain());
  ipcMain.on('pet:menu', () => showPetMenu());
  ipcMain.handle('pet:set-paused', (_event, paused) => setPetPaused(Boolean(paused)));
  ipcMain.handle('pet:reset', () => { const progress = resetPet(); broadcastPetProgress(progress); return progress; });
  ipcMain.handle('assistant:open', () => showAssistant());
  ipcMain.handle('assistant:toggle', () => toggleAssistant());
  ipcMain.handle('assistant:set-always-on-top', (_event, enabled) => setAlwaysOnTop(Boolean(enabled)));
  ipcMain.handle('poke:send', async (_event, payload) => { const result = await sendPoke(validatePokePayload(payload)); broadcastPoke(result); return result; });
  ipcMain.handle('chat:send', async (_event, payload) => sendChat(validateChatPayload(payload)));
  ipcMain.handle('pet:progress', (_event, progress) => broadcastPetProgress(progress));
  ipcMain.handle('pet:snapshot', (_event, snapshot) => broadcastPetSnapshot(validatePetSnapshot(snapshot)));
  ipcMain.handle('pet:set-mode', (_event, mode) => setPetMode(validatePetMode(mode)));
  ipcMain.handle('pet:move-by', (_event, delta) => movePetBy(validatePetMove(delta)));
}
module.exports = { registerHandlers };
