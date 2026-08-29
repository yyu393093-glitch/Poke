import { useState } from 'react';
import MiniFlowNode from './MiniFlowNode.jsx';
import MiniFlowEdge from './MiniFlowEdge.jsx';

// 4 节点在 360×220 画布内的固定锚点：current 居中，upstream 左上，下游两个在右列
const NODE_POS = {
  current: { x: 128, y: 96 },
  upstream: { x: 40, y: 40 },
  downstream0: { x: 240, y: 40 },
  downstream1: { x: 240, y: 160 },
};

export default function FlowPeek({ peek, onOpenNetwork, onPokeUpstream, onMouseEnter, onMouseLeave }) {
  const [selectedId, setSelectedId] = useState(null);
  const positions = {};
  let downIdx = 0;
  peek.nodes.forEach((n) => {
    if (n.role === 'current') positions[n.id] = NODE_POS.current;
    else if (n.role === 'upstream') positions[n.id] = NODE_POS.upstream;
    else positions[n.id] = NODE_POS[`downstream${downIdx++}`];
  });
  const selected = peek.nodes.find((n) => n.id === selectedId);
  return (
    <section className="flow-peek" role="dialog" aria-label="协作流程预览" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <header className="flow-peek-head">
        <b>{peek.summary.blockers}个阻塞 · {peek.summary.downstreamCount}个下游</b>
        {selected && <span className="flow-peek-selected">已选：{selected.name} · {selected.owner}</span>}
      </header>
      <div className="flow-peek-canvas">
        <svg viewBox="0 0 360 200" aria-hidden="true">
          <defs><marker id="mini-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L5,3 z" fill="#3b82f6" /></marker></defs>
          {peek.edges.map((e) => {
            const a = positions[e.from], b = positions[e.to];
            return a && b ? <MiniFlowEdge key={e.id} from={{ x: a.x, y: a.y + 20 }} to={{ x: b.x, y: b.y + 20 }} critical={e.isCritical} /> : null;
          })}
        </svg>
        {peek.nodes.map((n) => (
          <button key={n.id} type="button" className={`mini-node-anchor ${selectedId === n.id ? 'is-selected' : ''}`} style={{ left: positions[n.id]?.x, top: positions[n.id]?.y }} onClick={() => setSelectedId(n.id)}>
            <MiniFlowNode node={n} />
          </button>
        ))}
      </div>
      <footer className="flow-peek-foot">
        <button type="button" onClick={onOpenNetwork}>查看完整网络</button>
        <button type="button" onClick={onPokeUpstream}>戳一下上游</button>
      </footer>
    </section>
  );
}
