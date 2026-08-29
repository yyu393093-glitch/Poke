import { request } from './gameApi.js';
import { desktopBridge } from '../platform/desktopBridge.js';

export function sendPoke(payload) {
  if (desktopBridge.isDesktop()) return desktopBridge.sendPoke(payload);
  return request('/api/poke', { method: 'POST', body: JSON.stringify(payload) });
}
