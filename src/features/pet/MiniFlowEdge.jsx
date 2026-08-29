export default function MiniFlowEdge({ from, to, critical }) {
  const x1 = from.x, y1 = from.y, x2 = to.x, y2 = to.y;
  const midX = (x1 + x2) / 2;
  const d = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  return <path d={d} fill="none" stroke={critical ? '#3b82f6' : '#94a3b8'} strokeWidth={critical ? 2.5 : 1.5} markerEnd="url(#mini-arrow)" />;
}
