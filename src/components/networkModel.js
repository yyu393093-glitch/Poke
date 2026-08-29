export const FALLBACK_NODES = [
  { id: 'n_req', name: '需求文档', owner: '王姐', dept: '产品部', status: 'done', isBottleneck: false, isDelayed: false, x: 400, y: 80 },
  { id: 'n_brand', name: '品牌素材', owner: '陈总', dept: '设计部', status: 'doing', isBottleneck: false, isDelayed: true, x: 200, y: 180 },
  { id: 'n_design', name: '首页设计稿', owner: '小陈', dept: '设计部', status: 'doing', isBottleneck: true, isDelayed: false, x: 400, y: 300 },
  { id: 'n_dev', name: '前端开发', owner: '老李', dept: '研发部', status: 'todo', isBottleneck: false, isDelayed: false, x: 300, y: 420 },
  { id: 'n_test', name: '联调测试', owner: '小赵', dept: '研发部', status: 'todo', isBottleneck: false, isDelayed: false, x: 500, y: 420 },
  { id: 'n_copy', name: '运营文案', owner: '阿May', dept: '运营部', status: 'done', isBottleneck: false, isDelayed: false, x: 600, y: 180 },
];

export const FALLBACK_EDGES = [
  { id: 'e1', from: 'n_req', to: 'n_brand', isCritical: true },
  { id: 'e2', from: 'n_brand', to: 'n_design', isCritical: true },
  { id: 'e3', from: 'n_design', to: 'n_dev', isCritical: true },
  { id: 'e4', from: 'n_dev', to: 'n_test', isCritical: true },
  { id: 'e5', from: 'n_req', to: 'n_copy', isCritical: false },
  { id: 'e6', from: 'n_design', to: 'n_test', isCritical: false },
];

export function getDownstream(nodeId, nodes, edges) {
  const seen = new Set();
  const queue = [nodeId];
  while (queue.length) {
    const current = queue.shift();
    edges.filter((edge) => edge.from === current).forEach((edge) => {
      if (!seen.has(edge.to)) { seen.add(edge.to); queue.push(edge.to); }
    });
  }
  return [...seen].map((id) => nodes.find((node) => node.id === id)).filter(Boolean);
}

export function completeDesign(nodes) {
  return nodes.map((node) => {
    if (node.id === 'n_design') return { ...node, status: 'done', isBottleneck: false };
    if (node.id === 'n_dev' || node.id === 'n_test') return { ...node, status: 'doing' };
    return node;
  });
}

export function getPrimaryAction(nodeId, nodes) {
  const node = nodes.find((item) => item.id === nodeId);
  if (!node) return null;
  if (nodeId === 'n_brand') return { kind: 'inspect-impact', label: '查看它影响了谁' };
  if (nodeId === 'n_design' && node.status !== 'done') return { kind: 'complete-design', label: '标记完成并通知下游' };
  if (nodeId === 'n_design') return { kind: 'view-ripple', label: '查看本次推进的影响' };
  return { kind: 'select-bottleneck', label: '返回当前阻塞' };
}

export function deriveMetrics(nodes) {
  return { doneToday: nodes.filter((node) => node.status === 'done').length, alignedPeople: 5, blocked: nodes.some((node) => node.isBottleneck) ? 1 : 0 };
}

export function getNodeAnchorSelector(nodeId) {
  return nodeId ? `[data-node-id="${nodeId}"]` : null;
}
