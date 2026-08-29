/**
 * 本地假数据兜底（对应 00-分工与协作.md「招 2：前端假数据占位」）。
 *
 * 两个用途：
 *  1. 后端没起或接口还没 ready 时，前端照样能跑通全流程；
 *  2. 打包成单文件 HTML 时，不依赖任何服务端。
 *
 * 数据直接复用 server/mock-data.json，拆解规则复用 shared/splitBrief.js，
 * 保证和真后端是同一份事实，不会漂移。
 */
import mockData from '../../server/mock-data.json';
import { splitBrief } from '../../shared/splitBrief.js';

function withCoordinates(task) {
  return { ...task, ...(mockData.coordinates[task.id] ?? { x: 0, y: 0 }) };
}

function downstreamOf(nodeId) {
  return mockData.edges
    .filter((edge) => edge.from === nodeId)
    .map((edge) => mockData.tasks.find((task) => task.id === edge.to))
    .filter(Boolean);
}

const HANDLERS = {
  'GET /api/health': () => ({ ok: true }),

  'POST /api/feishu/auth': () => ({ token: 'mock-token' }),

  'GET /api/feishu/data': () => ({ tasks: mockData.tasks }),

  'POST /api/ai/parse': (body) => {
    const tasks = Array.isArray(body?.tasks) && body.tasks.length ? body.tasks : mockData.tasks;
    return { nodes: tasks.map(withCoordinates), edges: mockData.edges, pendingApproval: true };
  },

  'POST /api/ai/approve': (body) => ({
    approved: true,
    nodes: body?.nodes ?? [],
    edges: body?.edges ?? [],
  }),

  'POST /api/poke': (body) => {
    const target = mockData.tasks.find((task) => task.id === body?.to);
    const message = body?.to === 'n_brand'
      ? '陈总好，首页设计稿还差品牌素材，方便今天给我吗？🙏'
      : `「${target?.name ?? '这个任务'}」快好了吗？下游在等你 👀`;
    return { message, channel: 'feishu' };
  },

  'POST /api/node/complete': (body) => ({
    nodeId: body?.nodeId,
    notifications: downstreamOf(body?.nodeId).map((task, index) => ({
      id: `ntf${index + 1}`,
      to: task.owner,
      type: 'upstream_done',
      message: '上游已完成，你可以开始了',
      channel: 'feishu',
    })),
  }),

  'POST /api/clock/off': () => ({ status: 'off' }),

  'GET /api/metrics': () => ({ doneToday: 3, alignedPeople: 5, blocked: 0 }),

  'POST /api/ai/requirements': (body) => {
    const brief = mockData.leaderBriefs?.[body?.owner];
    if (!brief) throw new Error(`no brief for owner: ${body?.owner}`);
    return {
      owner: body.owner,
      role: brief.role,
      nodeId: brief.nodeId,
      from: mockData.leader,
      raw: brief.raw,
      items: splitBrief(brief.raw),
      parsedBy: 'rule-based',
    };
  },
};

/** 模拟 200~500ms 网络延迟，让生长动画和加载态和真后端表现一致 */
function delay() {
  return new Promise((resolve) => {
    setTimeout(resolve, 200 + Math.floor(Math.random() * 301));
  });
}

export function hasLocalHandler(method, path) {
  return `${method} ${path.split('?')[0]}` in HANDLERS;
}

export async function handleLocally(method, path, body) {
  const key = `${method} ${path.split('?')[0]}`;
  const handler = HANDLERS[key];
  if (!handler) throw new Error(`no local handler for ${key}`);

  await delay();
  return handler(body);
}
