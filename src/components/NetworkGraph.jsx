import { NETWORK_LAYOUT } from './networkLayout.js';

const STATUS_LABEL = { done: '已完成', doing: '进行中', todo: '未开始' };
const STATUS_CLASS = { done: 'text-emerald-400', doing: 'text-yellow-400', todo: 'text-slate-500' };

export default function NetworkGraph({ nodes, edges, selectedId, visibleCount, onSelect }) {
  const nodeMap = Object.fromEntries(nodes.map((node) => [node.id, node]));
  return <section className={`${NETWORK_LAYOUT.graph} relative min-h-0 overflow-hidden bg-[radial-gradient(circle,#263144_1px,transparent_1px)] [background-size:26px_26px]`} aria-label="协作依赖网络图">
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 520" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs><marker id="network-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#3b82f6" /></marker></defs>
      {edges.map((edge) => { const from = nodeMap[edge.from]; const to = nodeMap[edge.to]; if (!from || !to) return null; return <line key={edge.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} markerEnd="url(#network-arrow)" stroke={edge.isCritical ? '#3b82f6' : '#475569'} strokeWidth={edge.isCritical ? 4 : 2} opacity={edge.isCritical ? 1 : .55} />; })}
    </svg>
    {nodes.map((node, index) => <button type="button" key={node.id} data-node-id={node.id} style={{ left: `${node.x / 8}%`, top: `${node.y / 5.2}%`, opacity: index < visibleCount ? 1 : 0 }} onClick={() => onSelect(node.id)} className={`absolute w-36 -translate-x-1/2 -translate-y-1/2 text-center transition duration-300 ${STATUS_CLASS[node.status]} ${selectedId === node.id ? 'scale-105' : ''}`}>
      <span className={`mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full border-4 bg-slate-950 font-bold shadow-xl ${node.isBottleneck ? 'animate-pulse border-red-500' : node.isDelayed ? 'animate-pulse border-amber-500' : node.status === 'done' ? 'border-emerald-500' : node.status === 'doing' ? 'border-yellow-500' : 'border-slate-600'}`}>{node.isDelayed ? '⏰' : node.name.slice(0, 1)}</span>
      <strong className="block text-sm text-slate-100">{node.name}</strong><small className="text-slate-400">{node.owner} · {STATUS_LABEL[node.status]}</small>
      {node.isBottleneck && <i className="mt-1 block text-[10px] not-italic text-red-400">瓶颈 · 阻塞 2 个下游</i>}{node.isDelayed && <i className="mt-1 block text-[10px] not-italic text-amber-400">已延期 1 天</i>}
    </button>)}
  </section>;
}
