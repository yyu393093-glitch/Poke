const { BrowserWindow } = require('electron');
const path = require('node:path');

const COLLAPSED = { width: 72, height: 72 };
const EXPANDED = { width: 280, height: 140 };
const SIZES = {
  collapsed: { width: 72, height: 72 },
  peek: { width: 444, height: 300 },
  panel: { width: 464, height: 500 },
};

function getAnchoredModeBounds(anchor, mode, { flipX = false, flipY = false } = {}) {
  const size = SIZES[mode] || SIZES.collapsed;
  return {
    x: flipX ? anchor.x + anchor.width - size.width : anchor.x,
    y: flipY ? anchor.y + anchor.height - size.height : anchor.y,
    width: size.width,
    height: size.height,
  };
}

function getPetAnchorFromBounds(bounds, { flipX = false, flipY = false } = {}) {
  return {
    x: flipX ? bounds.x + bounds.width - COLLAPSED.width : bounds.x,
    y: flipY ? bounds.y + bounds.height - COLLAPSED.height : bounds.y,
    width: COLLAPSED.width,
    height: COLLAPSED.height,
  };
}

function createPetWindow({ config, onClick, onContextMenu, onMove, onExpandedChange }) {
  let anchorBounds = { x: config.position.x, y: config.position.y, ...COLLAPSED };
  let placement = { flipX: false, flipY: false };
  let currentMode = 'collapsed';
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
    currentMode = SIZES[mode] ? mode : 'collapsed';
    placement = mode === 'collapsed' ? placement : { flipX, flipY };
    win.setBounds(getAnchoredModeBounds(anchorBounds, mode, placement), true);
    return { mode, flipX, flipY };
  }

  function moveBy({ dx, dy }) {
    anchorBounds = { ...anchorBounds, x: Math.round(anchorBounds.x + dx), y: Math.round(anchorBounds.y + dy) };
    win.setBounds(getAnchoredModeBounds(anchorBounds, currentMode, placement), false);
    return { x: anchorBounds.x, y: anchorBounds.y };
  }

  win.on('move', () => {
    const bounds = win.getBounds();
    anchorBounds = getPetAnchorFromBounds(bounds, placement);
    config.position = { x: anchorBounds.x, y: anchorBounds.y };
    onMove?.(config.position);
  });
  win.webContents.on('ipc-message', (_event, channel) => {
    if (channel === 'pet:click') onClick?.();
    if (channel === 'pet:context-menu') onContextMenu?.();
    if (channel === 'pet:expand') setExpanded(true);
    if (channel === 'pet:collapse') setExpanded(false);
  });

  return { win, setExpanded, setMode, moveBy, sizes: { COLLAPSED, EXPANDED } };
}

module.exports = { COLLAPSED, EXPANDED, SIZES, getAnchoredModeBounds, getPetAnchorFromBounds, createPetWindow };
