const STATUS = {
  done: { label: '已完成', tag: 'pk-tag--done' },
  doing: { label: '进行中', tag: 'pk-tag--doing' },
  todo: { label: '未开始', tag: 'pk-tag--todo' },
};

/** 用 edges 递归推导下游影响链（md 03 §5「延期连锁影响」） */
export function downstreamOf(nodeId, nodes, edges) {
  const seen = new Set();
  const queue = [nodeId];

  while (queue.length) {
    const current = queue.shift();
    for (const edge of edges) {
      if (edge.from === current && !seen.has(edge.to)) {
        seen.add(edge.to);
        queue.push(edge.to);
      }
    }
  }

  return [...seen]
    .map((id) => nodes.find((node) => node.id === id))
    .filter(Boolean);
}

export default function NodeCard({ node, nodes, edges, busy, onPoke, onComplete, onClose }) {
  const status = STATUS[node.status] ?? STATUS.todo;
  const downstream = downstreamOf(node.id, nodes, edges);

  return (
    <>
      <div className="pk-popover__head">
        <h3>{node.name}</h3>
        <button type="button" className="pk-popover__close" aria-label="关闭详情" onClick={onClose}>
          ×
        </button>
      </div>

      <dl className="pk-popover__meta">
        <dt>负责人</dt>
        <dd>{node.owner}</dd>
        <dt>部门</dt>
        <dd>{node.dept}</dd>
        <dt>状态</dt>
        <dd>
          <span className={`pk-tag ${status.tag}`}>{status.label}</span>
        </dd>
        {(node.isDelayed || node.isBottleneck) && (
          <>
            <dt>标记</dt>
            <dd>
              {node.isDelayed && <span className="pk-tag pk-tag--delay">⏰ 已延期 1 天</span>}
              {node.isBottleneck && (
                <span className="pk-tag pk-tag--block">
                  瓶颈 · 阻塞 {downstreamOf(node.id, nodes, edges).length} 个下游
                </span>
              )}
            </dd>
          </>
        )}
      </dl>

      <div className="pk-popover__impact">
        <h4>延期连锁影响</h4>
        {downstream.length ? (
          <ul>
            {downstream.map((item) => (
              <li key={item.id}>
                <span>{item.name}</span>
                <span>{item.owner}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>没有下游任务，延期不会连锁影响他人。</p>
        )}
      </div>

      <div className="pk-popover__actions">
        <button
          type="button"
          className="pk-btn pk-btn--primary"
          disabled={busy}
          onClick={() => onPoke(node.id)}
        >
          戳一戳催进度
        </button>
        {node.status !== 'done' && (
          <button
            type="button"
            className="pk-btn pk-btn--ghost"
            disabled={busy}
            onClick={() => onComplete(node.id)}
          >
            标记完成
          </button>
        )}
      </div>
    </>
  );
}
