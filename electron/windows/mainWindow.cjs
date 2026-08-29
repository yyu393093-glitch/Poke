const { BrowserWindow, shell } = require('electron');
const path = require('node:path');
function createMainWindow() { const win = new BrowserWindow({ width: 1440, height: 900, minWidth: 1100, minHeight: 700, webPreferences: { preload: path.join(__dirname, '..', 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } }); win.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('https://')) shell.openExternal(url); return { action: 'deny' }; }); const url = process.env.POKE_RENDERER_URL || 'http://127.0.0.1:5173/network'; win.loadURL(url); return win; }
module.exports = { createMainWindow };
