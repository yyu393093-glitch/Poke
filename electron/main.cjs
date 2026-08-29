const { app, Tray, Menu, globalShortcut, ipcMain, nativeImage, screen } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createMainWindow } = require('./windows/mainWindow.cjs');
const { createFloatWindow } = require('./windows/floatWindow.cjs');
const { createPetWindow } = require('./windows/petWindow.cjs');
const { registerHandlers } = require('./ipc/handlers.cjs');
const { DEFAULT_CONFIG } = require('./services/configStore.cjs');
const { createPetPositionStore } = require('./services/petPositionStore.cjs');
const { DEFAULT_PET_PROGRESS, normalizePetProgress, createPetProgressStore } = require('./services/petProgressStore.cjs');
const { isPokeRendererAssetResponse } = require('./services/rendererHealth.cjs');

let mainWindow;
let floatWindow;
let pet;
let tray;
let rendererProcess;
let quitting = false;
let petPaused = false;
let petProgress = { ...DEFAULT_PET_PROGRESS };
let petStore;
let positionStore;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

async function rendererServesPoke(url) {
  try {
    const response = await fetch(`${url}/assets/pet/capybara-idle.png`);
    return isPokeRendererAssetResponse({ status: response.status, contentType: response.headers.get('content-type') });
  } catch { return false; }
}

async function ensureRendererServer() {
  if (app.isPackaged) return;
  if (process.env.POKE_RENDERER_URL) return;
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  for (let port = 4321; port <= 4330; port += 1) {
    const url = `http://127.0.0.1:${port}`;
    if (await rendererServesPoke(url)) { process.env.POKE_RENDERER_URL = url; return; }
    try { await fetch(url); continue; } catch { /* this port is available */ }
    rendererProcess = spawn(npmCommand, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], {
      cwd: path.join(__dirname, '..'), windowsHide: true, stdio: 'ignore',
    });
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (await rendererServesPoke(url)) { process.env.POKE_RENDERER_URL = url; return; }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Local Poke renderer did not start on port ${port}`);
  }
  throw new Error('No local port available for the Poke renderer');
}

function focusMain() {
  if (!mainWindow || mainWindow.isDestroyed()) mainWindow = createMainWindow({ show: false });
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  return true;
}
function showAssistant() {
  if (!floatWindow || floatWindow.isDestroyed()) floatWindow = createFloatWindow(DEFAULT_CONFIG);
  floatWindow.show(); floatWindow.focus(); return true;
}
function toggleAssistant() {
  if (!floatWindow || floatWindow.isDestroyed()) return showAssistant();
  if (floatWindow.isVisible()) { floatWindow.hide(); return false; }
  return showAssistant();
}
function setAlwaysOnTop(enabled) { floatWindow?.setAlwaysOnTop(enabled); return enabled; }
function setPetExpanded(expanded) { pet?.setExpanded(Boolean(expanded)); return Boolean(expanded); }
function setPetPaused(paused) { petPaused = Boolean(paused); pet?.win.webContents.send('pet:paused', petPaused); return petPaused; }
function resetPet() { petProgress = petStore?.reset() || { ...DEFAULT_PET_PROGRESS }; petStore?.set(petProgress); return petProgress; }
function broadcastPetProgress(progress) {
  petProgress = normalizePetProgress(progress); petStore?.set(petProgress);
  if (pet && !pet.win.isDestroyed()) pet.win.webContents.send('pet:progress-updated', petProgress);
  return petProgress;
}
function broadcastPoke(result) { if (floatWindow && !floatWindow.isDestroyed()) floatWindow.webContents.send('poke:received', result); }
function showPetMenu() {
  if (!pet?.win || pet.win.isDestroyed()) return;
  Menu.buildFromTemplate([
    { label: '打开协作网络', click: focusMain },
    { label: petPaused ? '恢复动画' : '暂停动画', click: () => setPetPaused(!petPaused) },
    { label: '重置演示', click: () => broadcastPetProgress(resetPet()) },
    { type: 'separator' },
    { label: '退出戳戳', click: () => { quitting = true; app.quit(); } },
  ]).popup({ window: pet.win });
}
function createTray() {
  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip('戳戳 Poke');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开协作网络', click: focusMain },
    { label: '打开 AI 助手', click: showAssistant },
    { type: 'separator' },
    { label: '完全退出客户端', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('click', focusMain);
}

if (gotLock) {
  app.whenReady().then(async () => {
    await ensureRendererServer();
    petStore = createPetProgressStore(path.join(app.getPath('userData'), 'pet-progress.json'));
    petProgress = petStore.get();
    mainWindow = createMainWindow({ show: false });
    mainWindow.on('close', (event) => { if (!quitting) { event.preventDefault(); mainWindow.hide(); } });
    positionStore = createPetPositionStore(path.join(app.getPath('userData'), 'pet-position.json'), () => screen.getPrimaryDisplay().workArea);
    const petConfig = { position: positionStore.get() };
    pet = createPetWindow({ config: petConfig, onClick: focusMain, onContextMenu: showPetMenu, onMove: (position) => positionStore.set(position) });
    pet.win.webContents.once('did-finish-load', () => pet.win.webContents.send('pet:progress-updated', petProgress));
    createTray();
    registerHandlers({ ipcMain, showMain: focusMain, showAssistant, toggleAssistant, setAlwaysOnTop, setPetExpanded, setPetPaused, resetPet, showPetMenu, broadcastPoke, broadcastPetProgress });
    globalShortcut.register('Alt+A', showAssistant);
    screen.on('display-metrics-changed', () => { const position = positionStore.set(pet.win.getBounds()); pet.win.setPosition(position.x, position.y); });
    app.on('activate', focusMain);
  }).catch((error) => { console.error(error); app.quit(); });
}
app.on('second-instance', focusMain);
app.on('before-quit', (event) => { if (!quitting) { event.preventDefault(); mainWindow?.hide(); floatWindow?.hide(); } });
app.on('will-quit', () => { globalShortcut.unregisterAll(); rendererProcess?.kill(); });
