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
