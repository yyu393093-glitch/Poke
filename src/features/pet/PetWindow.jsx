import { useEffect, useRef, useState } from 'react';
import { desktopBridge } from '../../platform/desktopBridge.js';
import { DEFAULT_PET_PROGRESS, normalizePetProgress } from '../../components/petModel.js';

const PHASE_META = {
  normal: { icon: '✓', label: '按计划推进', tone: 'border-emerald-400/60 bg-emerald-950/90' },
  blocked: { icon: '!', label: '存在关键瓶颈', tone: 'border-rose-400/70 bg-rose-950/90' },
  waiting: { icon: '…', label: '等待更新', tone: 'border-amber-400/70 bg-amber-950/90' },
  off: { icon: '☾', label: '今日已收口', tone: 'border-slate-500/70 bg-slate-900/95' },
  error: { icon: '×', label: '数据异常', tone: 'border-slate-500/70 bg-slate-800/95' },
};

export default function PetWindow() {
  const [progress, setProgress] = useState(DEFAULT_PET_PROGRESS);
  const [expanded, setExpanded] = useState(false);
  const [paused, setPaused] = useState(false);
  const collapseTimer = useRef(null);
  const meta = PHASE_META[progress.phase] || PHASE_META.error;

  useEffect(() => {
    const offProgress = desktopBridge.onPetProgress((value) => setProgress(normalizePetProgress(value)));
    const offPaused = desktopBridge.onPetPaused?.(setPaused);
    const offError = desktopBridge.onPetLoadError?.(() => setProgress((value) => ({ ...value, phase: 'error', headline: '主页面加载失败，点击重试' })));
    return () => { offProgress?.(); offPaused?.(); offError?.(); };
  }, []);

  function enter() {
    window.clearTimeout(collapseTimer.current);
    if (!expanded) { window.setTimeout(() => { setExpanded(true); desktopBridge.petSetExpanded(true); }, 250); }
  }
  function leave() {
    window.clearTimeout(collapseTimer.current);
    collapseTimer.current = window.setTimeout(() => { setExpanded(false); desktopBridge.petSetExpanded(false); }, 300);
  }
  function openMain() { desktopBridge.openMain(); }

  return <main className={`pet-shell ${expanded ? 'pet-shell-expanded' : ''}`} onMouseEnter={enter} onMouseLeave={leave} onContextMenu={(event) => { event.preventDefault(); desktopBridge.petOpenMenu(); }}>
    <button type="button" className={`pet-core ${paused ? 'pet-paused' : ''} phase-${progress.phase}`} aria-label="打开协作网络" onClick={openMain}>
      <span className="pet-orb">💡</span>
      {!expanded && <span className="pet-status" aria-label={meta.label}>{meta.icon}</span>}
    </button>
    {expanded && <section className={`pet-card ${meta.tone}`}>
      <div className="pet-card-head"><b>{progress.projectName}</b><span>{meta.icon} {meta.label}</span></div>
      <div className="pet-card-metric">完成 <strong>{progress.done}/{progress.total}</strong></div>
      <div className="pet-card-sub">{progress.bottlenecks} 个瓶颈 · 影响 {progress.blockedDownstream} 个下游</div>
      <p>{progress.headline}</p>
      <button type="button" className="pet-card-link" onClick={openMain}>点击查看协作网络 →</button>
    </section>}
  </main>;
}
