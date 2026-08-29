const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage, screen } = require('electron');
const path = require('node:path');
const { createMainWindow } = require('./windows/mainWindow.cjs');
const { createFloatWindow } = require('./windows/floatWindow.cjs');
const { registerHandlers } = require('./ipc/handlers.cjs');
const { DEFAULT_CONFIG } = require('./services/configStore.cjs');
let mainWindow; let floatWindow; let tray; let quitting = false; let floatBall = false;
function focusMain() { if (mainWindow?.isMinimized()) mainWindow.restore(); mainWindow?.show(); mainWindow?.focus(); }
function showAssistant() { if (!floatWindow || floatWindow.isDestroyed()) floatWindow = createFloatWindow(DEFAULT_CONFIG); floatWindow.show(); floatWindow.focus(); floatBall = false; return true; }
function toggleAssistant() { if (!floatWindow || floatWindow.isDestroyed()) return showAssistant(); if (floatWindow.isVisible()) { floatWindow.hide(); return false; } return showAssistant(); }
function setAlwaysOnTop(enabled) { floatWindow?.setAlwaysOnTop(enabled); return enabled; }
function createTray() { tray = new Tray(nativeImage.createEmpty()); tray.setToolTip('Poke'); tray.setContextMenu(Menu.buildFromTemplate([{ label: '打开悬浮助手', click: showAssistant }, { label: '打开主程序', click: focusMain }, { type: 'separator' }, { label: '完全退出客户端', click: () => { quitting = true; app.quit(); } }])); tray.on('click', toggleAssistant); }
function broadcastPoke(result) { if (!floatWindow || floatWindow.isDestroyed()) return; floatWindow.webContents.send('poke:received', result); }
app.whenReady().then(() => { if (!app.requestSingleInstanceLock()) return app.quit(); mainWindow = createMainWindow(); createTray(); registerHandlers({ ipcMain, getFloatWindow: () => floatWindow, showAssistant, toggleAssistant, setAlwaysOnTop, broadcastPoke }); globalShortcut.register('Alt+A', toggleAssistant); app.on('activate', focusMain); });
app.on('second-instance', focusMain); app.on('before-quit', (event) => { if (!quitting) { event.preventDefault(); mainWindow?.hide(); floatWindow?.hide(); } });
app.on('will-quit', () => globalShortcut.unregisterAll());
