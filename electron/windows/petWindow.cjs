const { BrowserWindow } = require('electron');
const path = require('node:path');

const COLLAPSED = { width: 72, height: 72 };
const EXPANDED = { width: 280, height: 140 };
const SIZES = {
  collapsed: { width: 72, height: 72 },
  peek: { width: 380, height: 360 },
  panel: { width: 380, height: 500 },
};

function createPetWindow({ config, onClick, onContextMenu, onMove, onExpandedChange }) {
  const win = new BrowserWindow({
    x: config.position.x,
    y: config.position.y,
    width: COLLAPSED.width,
    height: COLLAPSED.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    focusable: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL(`${process.env.POKE_RENDERER_URL || 'http://127.0.0.1:5173'}/pet`);
  win.once('ready-to-show', () => win.showInactive());
  win.webContents.on('did-fail-load', () => win.webContents.send('pet:load-error'));

  function setExpanded(expanded) {
    const bounds = win.getBounds();
    const size = expanded ? EXPANDED : COLLAPSED;
    const nextX = expanded ? bounds.x - (EXPANDED.width - COLLAPSED.width) : bounds.x + (EXPANDED.width - COLLAPSED.width);
    win.setBounds({ x: nextX, y: bounds.y, width: size.width, height: size.height }, true);
    onExpandedChange?.(expanded);
  }

  function setMode(mode, { flipX = false, flipY = false } = {}) {
    const size = SIZES[mode] || SIZES.collapsed;
    const bounds = win.getBounds();
    const x = flipX ? bounds.x + bounds.width - size.width : bounds.x;
    const y = flipY ? bounds.y + bounds.height - size.height : bounds.y;
    win.setBounds({ x, y, width: size.width, height: size.height }, true);
    return { mode, flipX, flipY };
  }

  win.on('move', () => {
    const bounds = win.getBounds();
    config.position = { x: bounds.x, y: bounds.y };
    onMove?.(config.position);
  });
  win.webContents.on('ipc-message', (_event, channel) => {
    if (channel === 'pet:click') onClick?.();
    if (channel === 'pet:context-menu') onContextMenu?.();
    if (channel === 'pet:expand') setExpanded(true);
    if (channel === 'pet:collapse') setExpanded(false);
  });

  return { win, setExpanded, setMode, sizes: { COLLAPSED, EXPANDED } };
}

module.exports = { COLLAPSED, EXPANDED, SIZES, createPetWindow };
