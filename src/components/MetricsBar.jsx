export default function MetricsBar({ metrics }) {
  return <div className="flex items-center gap-5 text-xs text-slate-400" aria-label="今日对齐度">
    <span>今日完成 <b className="text-base text-white">{metrics.doneToday}</b> 项</span>
    <span>对齐 <b className="text-base text-white">{metrics.alignedPeople}</b> 人</span>
    <span>阻塞 <b className={metrics.blocked ? 'text-base text-red-400' : 'text-base text-emerald-400'}>{metrics.blocked}</b></span>
  </div>;
}
