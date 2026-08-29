import { CHANNEL_LABEL } from './pokeModel.js';

export const DEFAULT_PET_PROGRESS = {
  projectName: '官网改版',
  done: 2,
  total: 6,
  bottlenecks: 1,
  blockedDownstream: 2,
  headline: '首页设计稿正在等待品牌素材',
  phase: 'blocked',
};

const PHASES = new Set(['normal', 'blocked', 'waiting', 'off', 'error']);

export function normalizePetProgress(input = {}) {
  const candidate = {
    projectName: typeof input.projectName === 'string' ? input.projectName.trim() : '',
    done: Number.isInteger(input.done) ? input.done : -1,
    total: Number.isInteger(input.total) ? input.total : -1,
    bottlenecks: Number.isInteger(input.bottlenecks) ? input.bottlenecks : -1,
    blockedDownstream: Number.isInteger(input.blockedDownstream) ? input.blockedDownstream : -1,
    headline: typeof input.headline === 'string' ? input.headline.trim() : '',
    phase: input.phase,
  };
  const valid = candidate.projectName && candidate.headline && PHASES.has(candidate.phase)
    && candidate.total > 0 && candidate.done >= 0 && candidate.done <= candidate.total
    && candidate.bottlenecks >= 0 && candidate.blockedDownstream >= 0;
  return valid ? candidate : { ...DEFAULT_PET_PROGRESS };
}

export function derivePetProgress(nodes = []) {
  const total = nodes.length || DEFAULT_PET_PROGRESS.total;
  const done = nodes.filter((node) => node.status === 'done').length;
  const bottlenecks = nodes.filter((node) => node.isBottleneck).length;
  const blockedDownstream = bottlenecks ? 2 : 0;
  const phase = bottlenecks ? 'blocked' : 'normal';
  const headline = bottlenecks
    ? '首页设计稿正在等待品牌素材'
    : '关键瓶颈已解除，下游已同步';
  return normalizePetProgress({
    projectName: '官网改版', done, total, bottlenecks, blockedDownstream, headline, phase,
  });
}

export function getOffProgress(progress) {
  return normalizePetProgress({ ...progress, phase: 'off', headline: '今日关键任务已收口' });
}

export const PET_MOOD = {
  IDLE: 'idle', FLOW_PEEK: 'flow-peek', UNREAD: 'unread', BLOCKED: 'blocked',
  WORKING: 'working', DONE: 'done', OFF: 'off', EXPANDED: 'expanded',
};

export function derivePetMood({ progress = DEFAULT_PET_PROGRESS, paused = false, unread = 0, hovering = false, expanded = false, working = false, flashDone = false }) {
  if (expanded) return PET_MOOD.EXPANDED;
  if (paused) return PET_MOOD.IDLE;
  if (progress.phase === 'off') return PET_MOOD.OFF;
  if (working) return PET_MOOD.WORKING;
  if (flashDone) return PET_MOOD.DONE;
  if (progress.phase === 'blocked') return PET_MOOD.BLOCKED;
  if (unread > 0) return PET_MOOD.UNREAD;
  return PET_MOOD.IDLE;
}

export function derivePetBadges({ progress = DEFAULT_PET_PROGRESS, unread = 0 }) {
  return { blocked: progress.phase === 'blocked', unreadCount: unread > 0 ? unread : 0 };
}

export function deriveFlowPeek(nodes = [], edges = [], { currentUserId = 'n_design' } = {}) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const current = byId[currentUserId];
  if (!current) return { summary: { blockers: 0, downstreamCount: 0 }, nodes: [], edges: [] };
  const upstream = edges.filter((e) => e.to === currentUserId).map((e) => byId[e.from])
    .filter((n) => n && (n.isDelayed || n.isBottleneck)).slice(0, 1);
  const downstream = edges.filter((e) => e.from === currentUserId).map((e) => byId[e.to]).filter(Boolean).slice(0, 2);
  const include = new Set([currentUserId, ...upstream.map((n) => n.id), ...downstream.map((n) => n.id)]);
  const nodesOut = [current, ...upstream, ...downstream].map((n) => ({
    id: n.id, name: n.name, owner: n.owner, dept: n.dept, status: n.status,
    isDelayed: n.isDelayed, isBottleneck: n.isBottleneck,
    role: n.id === currentUserId ? 'current' : (downstream.some((d) => d.id === n.id) ? 'downstream' : 'upstream'),
  }));
  // peek 只画与当前节点直接相连的边（上游→当前→下游），下游之间的边不进子图
  const edgesOut = edges.filter((e) => (e.from === currentUserId || e.to === currentUserId) && include.has(e.from) && include.has(e.to));
  return {
    summary: { blockers: nodes.filter((n) => n.isBottleneck).length, downstreamCount: downstream.length },
    nodes: nodesOut,
    edges: edgesOut,
  };
}

export function derivePetMessages(pokes = [], { limit = 5 } = {}) {
  return pokes.slice(-limit).reverse().map((poke) => ({
    id: poke.id, from: poke.from, to: poke.receiver || poke.to, message: poke.message,
    reply: poke.reply || null, channel: poke.channel, channelLabel: CHANNEL_LABEL[poke.channel] || 'IM',
    time: poke.time, status: poke.reply ? 'replied' : (poke.pushStatus === 'success' ? 'read' : 'sent'),
  }));
}

export function buildPetSnapshot({ progress = DEFAULT_PET_PROGRESS, nodes = [], edges = [], pokes = [], notifications = [], currentUser = '' } = {}) {
  return { progress, nodes, edges, pokes, notifications, currentUser };
}

export function computePetFlip({ anchorX = 0, anchorY = 0, contentWidth = 0, contentHeight = 0, availWidth = 0, availHeight = 0 } = {}) {
  return { flipX: anchorX + contentWidth > availWidth, flipY: anchorY + contentHeight > availHeight };
}
