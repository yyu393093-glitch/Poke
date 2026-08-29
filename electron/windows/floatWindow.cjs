const { BrowserWindow } = require('electron');
const path = require('node:path');
const { DEFAULT_CONFIG } = require('../services/configStore.cjs');
function createFloatWindow(config = DEFAULT_CONFIG) { const win = new BrowserWindow({ x: config.position.x || undefined, y: config.position.y || undefined, width: config.size.width, height: config.size.height, minWidth: 280, minHeight: 240, alwaysOnTop: config.alwaysOnTop, frame: true, resizable: true, webPreferences: { preload: path.join(__dirname, '..', 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } }); win.loadURL(`${process.env.POKE_RENDERER_URL || 'http://127.0.0.1:5173'}/assistant`); return win; }
module.exports = { createFloatWindow };
