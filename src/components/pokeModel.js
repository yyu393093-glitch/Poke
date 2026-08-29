export const CHANNEL_LABEL = { feishu: '飞书', wecom: '企业微信', dingtalk: '钉钉' };

export function getPokePresentation(demoMode) {
  return demoMode
    ? { fakeIM: true, flyingLamp: true, toast: false }
    : { fakeIM: false, flyingLamp: false, toast: true };
}

export function buildPokeEvent(response, context) {
  return {
    id: response.pokeId || `poke-${Date.now()}`,
    from: context.from,
    to: context.to,
    receiver: context.receiver,
    message: response.message,
    reply: response.reply || null,
    channel: response.channel,
    time: context.time,
    pushStatus: response.pushStatus || 'success',
  };
}

export function getPushToast({ channel, pushStatus }) {
  const label = CHANNEL_LABEL[channel] || 'IM';
  return pushStatus === 'fail'
    ? `${label}催办发送失败，请稍后重试`
    : `已向对方${label}发送催办消息`;
}

export function getPokeFallback(demoMode, node, currentUser, pokeId = `demo-${Date.now()}`) {
  if (!demoMode) return null;
  return {
    message: `${node.owner}好，${currentUser}负责的工作正在等待「${node.name}」，方便确认一下进度吗？🙏`,
    reply: '收到，10分钟内发你🙌',
    channel: 'feishu',
    pokeId,
    pushStatus: 'success',
  };
}

export function getFloatingWindowOffset(detailWidth = 320, gap = 20) {
  return { right: detailWidth + gap, bottom: gap };
}

export function clampFloatingWindowPosition(position, viewport, windowSize) {
  return {
    x: Math.min(Math.max(0, position.x), Math.max(0, viewport.width - windowSize.width)),
    y: Math.min(Math.max(0, position.y), Math.max(0, viewport.height - windowSize.height)),
  };
}

export function getFloatingWindowCenter(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function getTrackedFlightPosition(from, to, progress) {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}

export function completeDemoFlight(flight, messages) {
  return {
    flight: null,
    messages: flight?.poke ? [...messages, flight.poke] : messages,
  };
}
