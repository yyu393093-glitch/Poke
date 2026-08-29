const { contextBridge, ipcRenderer } = require('electron');
const channels = {
  openMain: 'main:open', petExpanded: 'pet:set-expanded', petMenu: 'pet:menu', petClick: 'pet:click', petReset: 'pet:reset', petPause: 'pet:set-paused', petProgress: 'pet:progress', petLoadError: 'pet:load-error',
  openAssistant: 'assistant:open', toggleAssistant: 'assistant:toggle', setAlwaysOnTop: 'assistant:set-always-on-top', sendPoke: 'poke:send', sendChat: 'chat:send', onPoke: 'poke:received', onSession: 'session:updated', onProgress: 'pet:progress-updated',
};
function subscribe(channel, listener) { const handler = (_event, value) => listener(value); ipcRenderer.on(channel, handler); return () => ipcRenderer.removeListener(channel, handler); }
const api = {
  isDesktop: true,
  openMain: () => ipcRenderer.invoke(channels.openMain),
  petSetExpanded: (expanded) => ipcRenderer.invoke(channels.petExpanded, Boolean(expanded)),
  petClick: () => ipcRenderer.send(channels.petClick),
  petOpenMenu: () => ipcRenderer.send(channels.petMenu),
  petReset: () => ipcRenderer.invoke(channels.petReset),
  petSetPaused: (paused) => ipcRenderer.invoke(channels.petPause, Boolean(paused)),
  onPetProgress: (listener) => subscribe(channels.onProgress, listener),
  onPetLoadError: (listener) => subscribe(channels.petLoadError, listener),
  openAssistant: () => ipcRenderer.invoke(channels.openAssistant),
  toggleAssistant: () => ipcRenderer.invoke(channels.toggleAssistant),
  setAssistantAlwaysOnTop: (enabled) => ipcRenderer.invoke(channels.setAlwaysOnTop, Boolean(enabled)),
  sendPoke: (payload) => ipcRenderer.invoke(channels.sendPoke, payload),
  sendChat: (payload) => ipcRenderer.invoke(channels.sendChat, payload),
  onPokeReceived: (listener) => subscribe(channels.onPoke, listener),
  onSessionUpdated: (listener) => subscribe(channels.onSession, listener),
};
contextBridge.exposeInMainWorld('pokeDesktop', api);
