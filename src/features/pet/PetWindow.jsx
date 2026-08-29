import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { desktopBridge } from '../../platform/desktopBridge.js';
import { DEFAULT_PET_PROGRESS, normalizePetProgress } from '../../components/petModel.js';
import { getDropState, getNextDropState, isSupportedDrop } from './fileDropModel.js';

const PHASE_META = {
  normal: { icon: '✓', label: '按计划推进', tone: 'border-emerald-400/60 bg-emerald-950/90' },
  blocked: { icon: '!', label: '存在关键瓶颈', tone: 'border-rose-400/70 bg-rose-950/90' },
  waiting: { icon: '…', label: '等待更新', tone: 'border-amber-400/70 bg-amber-950/90' },
  off: { icon: '☾', label: '今日已收口', tone: 'border-slate-500/70 bg-slate-900/95' },
  error: { icon: '×', label: '数据异常', tone: 'border-slate-500/70 bg-slate-800/95' },
};

export default function PetWindow() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(DEFAULT_PET_PROGRESS);
  const [expanded, setExpanded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dropState, setDropState] = useState('idle');
  const [droppedFile, setDroppedFile] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [popupSide, setPopupSide] = useState('left');
  const collapseTimer = useRef(null);
  const consumeTimer = useRef(null);
  const meta = PHASE_META[progress.phase] || PHASE_META.error;
  const dropMeta = getDropState(dropState);
  const mascotAsset = dropState === 'eating' ? '/assets/pet/capybara-eating.png' : dropState === 'consumed' ? '/assets/pet/capybara-success.png' : dragActive ? '/assets/pet/capybara-shake.png' : '/assets/pet/capybara-idle.png';

  useEffect(() => {
    document.documentElement.classList.add('pet-window-host');
    return () => document.documentElement.classList.remove('pet-window-host');
  }, []);


  useEffect(() => {
    const offProgress = desktopBridge.onPetProgress((value) => setProgress(normalizePetProgress(value)));
    const offPaused = desktopBridge.onPetPaused?.(setPaused);
    const offPopupSide = desktopBridge.onPetPopupSide?.(setPopupSide);
    const offError = desktopBridge.onPetLoadError?.(() => setProgress((value) => ({ ...value, phase: 'error', headline: '主页面加载失败，点击重试' })));
    return () => { offProgress?.(); offPaused?.(); offPopupSide?.(); offError?.(); window.clearTimeout(consumeTimer.current); window.clearTimeout(collapseTimer.current); };
  }, []);

  function enter() {
    window.clearTimeout(collapseTimer.current);
    if (!expanded && dropState === 'idle') {
      collapseTimer.current = window.setTimeout(() => { setExpanded(true); desktopBridge.petSetExpanded(true); }, 250);
    }
  }
  function leave() {
    window.clearTimeout(collapseTimer.current);
    collapseTimer.current = window.setTimeout(() => { setExpanded(false); desktopBridge.petSetExpanded(false); }, 300);
  }
  function openMain() { if (desktopBridge.isDesktop()) desktopBridge.openMain(); else navigate('/network'); }
  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!isSupportedDrop(file) || dropState !== 'idle') return;
    window.clearTimeout(consumeTimer.current);
    setDroppedFile(file.name);
    setExpanded(false);
    desktopBridge.petSetExpanded(false);
    setDropState(getNextDropState('idle'));
    consumeTimer.current = window.setTimeout(() => {
      setDropState(getNextDropState('eating'));
      window.setTimeout(openMain, 700);
    }, 1350);
  }

  return (
    <main className={`pet-shell ${expanded ? 'pet-shell-expanded' : ''} pet-popup-${popupSide} ${dragActive ? 'pet-drag-active' : ''} ${dropState !== 'idle' ? `pet-drop-${dropState}` : ''}`} onMouseEnter={enter} onMouseLeave={leave} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragActive(false); }} onDrop={handleDrop} onContextMenu={(event) => { event.preventDefault(); desktopBridge.petOpenMenu(); }}>
      <button type="button" className={`pet-core ${paused ? 'pet-paused' : ''} phase-${progress.phase}`} aria-label="打开协作网络" onClick={openMain}>
        <span className={`capybara-mascot mascot-${dropState === 'consumed' ? 'success' : dropState === 'eating' ? 'eating' : dragActive ? 'shake' : 'idle'}`} aria-hidden="true"><img key={mascotAsset} src={mascotAsset} alt="" /></span>
        {!expanded && <span className="pet-status" aria-label={meta.label}>{dropState === 'idle' ? meta.icon : '↓'}</span>}
      </button>
      {dropState !== 'idle' ? (
        <section className="pet-drop-card" role="status"><span className="pet-file-token" aria-hidden="true">📄</span><strong>{dropMeta.label}</strong><small>{droppedFile}</small></section>
      ) : expanded ? (
        <section className={`pet-card ${meta.tone}`}>
          <div className="pet-card-head"><b>{progress.projectName}</b><span>{meta.icon} {meta.label}</span></div>
          <div className="pet-card-metric">完成 <strong>{progress.done}/{progress.total}</strong></div>
          <div className="pet-card-sub">{progress.bottlenecks} 个瓶颈 · 影响 {progress.blockedDownstream} 个下游</div>
          <p>{progress.headline}</p>
          <button type="button" className="pet-card-link" onClick={openMain}>点击查看协作网络 →</button>
        </section>
      ) : null}
    </main>
  );
}
