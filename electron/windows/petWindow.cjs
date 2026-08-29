const { BrowserWindow, screen } = require('electron');
const path = require('node:path');

const COLLAPSED = { width: 96, height: 96 };
const EXPANDED = { width: 360, height: 150 };

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
    focusable: false,
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
    const workArea = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y }).workArea;
    const nextBounds = getPetWindowBounds(bounds, expanded, workArea);
    win.setBounds(nextBounds, true);
    onExpandedChange?.(expanded);
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

  return { win, setExpanded, sizes: { COLLAPSED, EXPANDED } };
}

function getPetWindowBounds(bounds, expanded, workArea) {
  const size = expanded ? EXPANDED : COLLAPSED;
  const widthDelta = EXPANDED.width - COLLAPSED.width;
  const heightDelta = EXPANDED.height - COLLAPSED.height;
  const rawX = expanded ? bounds.x - widthDelta : bounds.x + widthDelta;
  const rawY = expanded ? bounds.y - heightDelta : bounds.y + heightDelta;
  const maxX = workArea.x + workArea.width - size.width;
  const maxY = workArea.y + workArea.height - size.height;
  return { x: Math.min(Math.max(rawX, workArea.x), maxX), y: Math.min(Math.max(rawY, workArea.y), maxY), width: size.width, height: size.height };
}

module.exports = { COLLAPSED, EXPANDED, createPetWindow, getPetWindowBounds };

