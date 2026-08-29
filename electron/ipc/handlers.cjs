const { validatePokePayload, validateChatPayload } = require('./contracts.cjs');
const { sendPoke } = require('../services/pokeService.cjs');
const { sendChat } = require('../services/chatService.cjs');
function registerHandlers({ ipcMain, getFloatWindow, showAssistant, toggleAssistant, setAlwaysOnTop, broadcastPoke }) { ipcMain.handle('assistant:open', () => showAssistant()); ipcMain.handle('assistant:toggle', () => toggleAssistant()); ipcMain.handle('assistant:set-always-on-top', (_event, enabled) => setAlwaysOnTop(Boolean(enabled))); ipcMain.handle('poke:send', async (_event, payload) => { const valid = validatePokePayload(payload); const result = await sendPoke(valid); broadcastPoke(result); return result; }); ipcMain.handle('chat:send', async (_event, payload) => sendChat(validateChatPayload(payload))); return getFloatWindow; }
module.exports = { registerHandlers };
