const STATUS_LABEL = { done: '已完成', doing: '进行中', todo: '未开始' };
const STATUS_TONE = { done: 'mini-node-done', doing: 'mini-node-doing', todo: 'mini-node-todo' };

export default function MiniFlowNode({ node }) {
  return (
    <button
      type="button"
      className={`mini-node ${STATUS_TONE[node.status] || ''} ${node.role === 'current' ? 'mini-node-current' : ''}`}
      data-role={node.role}
    >
      <span className="mini-node-avatar" aria-hidden="true">{node.owner.slice(0, 1)}</span>
      <span className="mini-node-body">
        <b className="mini-node-name">{node.name}</b>
        <small className="mini-node-owner">{node.owner} · {STATUS_LABEL[node.status]}</small>
      </span>
      {node.isDelayed && <em className="mini-node-flag">延期1天</em>}
    </button>
  );
}
