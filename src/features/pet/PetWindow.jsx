import { useEffect, useRef, useState } from 'react';
import { desktopBridge } from '../../platform/desktopBridge.js';
import { DEFAULT_PET_PROGRESS, normalizePetProgress, derivePetMood, deriveFlowPeek, computePetFlip } from '../../components/petModel.js';
import PetAvatar from './PetAvatar.jsx';
import FlowPeek from './FlowPeek.jsx';
import PetPanel from './PetPanel.jsx';

const HOVER_DELAY = 600;
const LEAVE_DELAY = 250;

export default function PetWindow() {
  const [progress, setProgress] = useState(DEFAULT_PET_PROGRESS);
  const [snapshot, setSnapshot] = useState({ nodes: [], edges: [], pokes: [], notifications: [], currentUser: '' });
  const [paused, setPaused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [unread, setUnread] = useState(0);
  const [placement, setPlacement] = useState({ flipX: false, flipY: false });
  const hoverTimer = useRef(null);
  const leaveTimer = useRef(null);

  useEffect(() => {
    document.documentElement.classList.add('pet-window');
    return () => document.documentElement.classList.remove('pet-window');
  }, []);

  useEffect(() => {
    const offSnap = desktopBridge.onPetSnapshot((value) => {
      if (!value) return;
      setSnapshot(value);
      setProgress(normalizePetProgress(value.progress));
      setUnread((value.notifications || []).filter((n) => n.type === 'poke').length);
    });
    const offProgress = desktopBridge.onPetProgress((value) => setProgress(normalizePetProgress(value)));
    const offPaused = desktopBridge.onPetPaused?.(setPaused);
    const offError = desktopBridge.onPetLoadError?.(() => setProgress((p) => ({ ...p, phase: 'error', headline: '主页面加载失败，点击重试' })));
    const onBlur = () => collapse();
    const onKey = (e) => { if (e.key === 'Escape') collapse(); };
    window.addEventListener('blur', onBlur);
    window.addEventListener('keydown', onKey);
    return () => { offSnap(); offProgress(); offPaused?.(); offError?.(); window.removeEventListener('blur', onBlur); window.removeEventListener('keydown', onKey); window.clearTimeout(hoverTimer.current); window.clearTimeout(leaveTimer.current); };
  }, []);

  function collapse() {
    window.clearTimeout(hoverTimer.current);
    window.clearTimeout(leaveTimer.current);
    setHovered(false);
    setExpanded(false);
    desktopBridge.petSetMode({ mode: 'collapsed' });
  }

  function onEnter() {
    window.clearTimeout(leaveTimer.current);
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      setHovered(true);
      requestMode('peek');
    }, HOVER_DELAY);
  }
  function onLeave() {
    window.clearTimeout(hoverTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      setHovered(false);
      if (!expanded) desktopBridge.petSetMode({ mode: 'collapsed' });
    }, LEAVE_DELAY);
  }
  function cancelLeave() {
    window.clearTimeout(leaveTimer.current);
  }
  function requestMode(mode) {
    const { screenX, screenY, innerWidth, innerHeight } = window;
    const avail = window.screen || {};
    const flip = computePetFlip({ anchorX: screenX, anchorY: screenY, contentWidth: mode === 'panel' ? 380 : 380, contentHeight: mode === 'panel' ? 500 : 260, availWidth: avail.availWidth || screenX + 1000, availHeight: avail.availHeight || screenY + 1000 });
    setPlacement(flip);
    desktopBridge.petSetMode({ mode, flipX: flip.flipX, flipY: flip.flipY });
  }

  function openPanel() {
    window.clearTimeout(hoverTimer.current);
    window.clearTimeout(leaveTimer.current);
    setExpanded(true);
    requestMode('panel');
  }
  function openMain() { desktopBridge.openMain(); }

  const flowPeek = deriveFlowPeek(snapshot.nodes, snapshot.edges, { currentUserId: 'n_design' });
  const mood = derivePetMood({ progress, paused, unread, hovering: hovered && !expanded, expanded });

  return (
    <main className={`pet-shell ${hovered && !expanded ? 'pet-shell-peek' : ''} ${expanded ? 'pet-shell-expanded' : ''} ${placement.flipX ? 'pet-flip-x' : ''} ${placement.flipY ? 'pet-flip-y' : ''}`} onMouseEnter={onEnter} onMouseLeave={onLeave} onContextMenu={(e) => { e.preventDefault(); desktopBridge.petOpenMenu(); }}>
      <PetAvatar mood={mood} progress={progress} unread={unread} paused={paused} onClick={openPanel} />
      {hovered && !expanded && <FlowPeek peek={flowPeek} onOpenNetwork={openMain} onPokeUpstream={pokeUpstream} onMouseEnter={cancelLeave} onMouseLeave={onLeave} />}
      {expanded && <PetPanel progress={progress} peek={flowPeek} pokes={snapshot.pokes} onClose={collapse} onOpenNetwork={openMain} onPokeUpstream={pokeUpstream} />}
    </main>
  );
}

function pokeUpstream() { desktopBridge.openMain(); }
