import { getDownstream } from './networkModel.js';
import { NETWORK_LAYOUT } from './networkLayout.js';
const LABEL = { done: '已完成', doing: '进行中', todo: '未开始' };

export default function NodeCard({ node, nodes, edges, action, busy, onAction, actionSlot = null }) {
  if (!node) return <aside className={`${NETWORK_LAYOUT.detail} grid place-items-center border-l border-slate-800 bg-slate-900/80 text-slate-500`}>点击节点查看详情</aside>;
  const downstream = getDownstream(node.id, nodes, edges);
  return <aside className={`${NETWORK_LAYOUT.detail} flex min-h-0 flex-col overflow-auto border-l border-slate-800 bg-slate-900/90 p-6`}>
    <div className="flex items-start justify-between border-b border-slate-800 pb-5"><div><small className="text-slate-500">任务详情</small><h2 className="mt-1 text-xl font-semibold">{node.name}</h2></div><span className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-yellow-400">{LABEL[node.status]}</span></div>
    <dl className="my-5 grid gap-3 text-sm">{[['负责人', node.owner], ['部门', node.dept], ['延期', node.isDelayed ? '是 · 1 天' : '否']].map(([key, value]) => <div className="flex justify-between" key={key}><dt className="text-slate-500">{key}</dt><dd>{value}</dd></div>)}</dl>
    <section className="border-t border-slate-800 pt-4"><h3 className="mb-3 text-xs font-medium text-slate-400">{node.isDelayed ? '延期连锁影响' : '下游影响'}</h3><div className="grid gap-2">{downstream.length ? downstream.map((item) => <div className="flex items-center justify-between rounded-lg bg-slate-800/70 p-3 text-xs" key={item.id}><span>↳ {item.name}</span><em className="not-italic text-slate-500">{item.dept}</em></div>) : <p className="text-xs text-slate-500">没有下游任务</p>}</div></section>
    {actionSlot}
    <div className="mt-auto pt-5"><button disabled={busy} className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" onClick={() => onAction(action.kind)}>{busy ? '处理中…' : action.label}</button><p className="mt-2 text-center text-[11px] text-slate-500">系统只推荐一个当前最小动作</p></div>
  </aside>;
}
