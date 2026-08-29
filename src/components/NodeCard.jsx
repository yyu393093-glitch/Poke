const STATUS_LABEL = {
  done: '已完成',
  doing: '进行中',
  todo: '未开始',
};

function getDownstream(node, nodes, edges) {
  const visited = new Set();

  function walk(nodeId) {
    edges
      .filter((edge) => edge.from === nodeId)
      .forEach((edge) => {
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          walk(edge.to);
        }
      });
  }

  walk(node.id);
  return [...visited]
    .map((id) => nodes.find((item) => item.id === id))
    .filter(Boolean);
}

export default function NodeCard({ node, nodes, edges }) {
  if (!node) return null;

  const affected = node.isDelayed
    ? getDownstream(node, nodes, edges)
    : edges
        .filter((edge) => edge.from === node.id)
        .map((edge) => nodes.find((item) => item.id === edge.to))
        .filter(Boolean);

  return (
    <aside className="node-card glass-surface" aria-live="polite">
      <div className="node-card__head">
        <div>
          <p className="section-kicker">任务地点</p>
          <h2>{node.name}</h2>
        </div>
        <span className="node-card__badge">
          {node.isBottleneck ? '瓶颈节点' : node.isDelayed ? '延期节点' : '协作节点'}
        </span>
      </div>

      <dl className="node-card__facts">
        <div>
          <dt>负责人</dt>
          <dd>{node.owner}</dd>
        </div>
        <div>
          <dt>部门</dt>
          <dd>{node.dept}</dd>
        </div>
        <div>
          <dt>状态</dt>
          <dd>{STATUS_LABEL[node.status]}</dd>
        </div>
        <div>
          <dt>延期</dt>
          <dd>{node.isDelayed ? '已延期 1 天' : '正常'}</dd>
        </div>
      </dl>

      <div className="node-card__impact">
        <p className="section-kicker">
          {node.isDelayed ? '延期连锁影响' : '下游影响预览'}
        </p>
        <div className="impact-list">
          {affected.length ? (
            affected.map((item) => (
              <span key={item.id} className="impact-pill">
                {item.name} · {item.owner}
              </span>
            ))
          ) : (
            <span className="impact-pill">暂无直接下游</span>
          )}
        </div>
      </div>
    </aside>
  );
}
