const DROP_STATES = {
  idle: { phase: 'idle', label: '把文件拖给我' },
  eating: { phase: 'eating', label: '咕噜…吃掉文件' },
  consumed: { phase: 'consumed', label: '收到，打开协作网络' },
};
export function isSupportedDrop(file) { return Boolean(file && typeof file.name === 'string' && file.name.trim() && Number(file.size) >= 0); }
export function getDropState(state) { return DROP_STATES[state] || DROP_STATES.idle; }
export function getNextDropState(state) {
  if (state === 'idle') return 'eating';
  if (state === 'eating') return 'consumed';
  return 'idle';
}
