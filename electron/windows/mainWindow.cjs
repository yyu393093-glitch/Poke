const { BrowserWindow, shell } = require('electron');
const path = require('node:path');
function createMainWindow({ show = false } = {}) {
  const win = new BrowserWindow({
    show,
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // POKE_RENDERER_URL is the shared renderer base URL: the main window must
  // always open the island, while the desktop pet appends its own /pet route.
  const rendererBase = process.env.POKE_RENDERER_URL || 'http://127.0.0.1:5173';
  win.loadURL(new URL('/network', rendererBase).toString());
  return win;
}
module.exports = { createMainWindow };
