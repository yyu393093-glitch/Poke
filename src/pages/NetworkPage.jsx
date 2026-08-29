import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { request } from '../api/gameApi.js';
import MetricsBar from '../components/MetricsBar.jsx';
import NetworkGraph from '../components/NetworkGraph.jsx';
import NodeCard from '../components/NodeCard.jsx';
import PokeAction from '../components/PokeAction.jsx';
import PokeLog from '../components/PokeLog.jsx';
import RippleView from '../components/RippleView.jsx';
import { completeDesign, deriveMetrics, FALLBACK_EDGES, FALLBACK_NODES, getNodeAnchorSelector, getPrimaryAction } from '../components/networkModel.js';
import { completeDemoFlight, getPokePresentation, getPushToast } from '../components/pokeModel.js';
import { FEATURE_POKE_DEMO_MODE } from '../config/features.js';
import { PHASES, useGame } from '../context/GameContext.jsx';
import { desktopBridge } from '../platform/desktopBridge.js';

const POKE_PRESENTATION = getPokePresentation(FEATURE_POKE_DEMO_MODE);
const DemoFakeIMWindow = POKE_PRESENTATION.fakeIM ? lazy(() => import('../components/FakeIMWindow.jsx')) : null;
const DemoFlyingLamp = POKE_PRESENTATION.flyingLamp ? lazy(() => import('../components/FlyingLamp.jsx')) : null;

async function loadApprovedNetwork() {
  const auth = await request('/api/feishu/auth', { method: 'POST', body: '{}' });
  const data = await request(`/api/feishu/data?token=${encodeURIComponent(auth.token)}`);
  const parsed = await request('/api/ai/parse', { method: 'POST', body: JSON.stringify({ tasks: data.tasks }) });
  return request('/api/ai/approve', { method: 'POST', body: JSON.stringify({ nodes: parsed.nodes, edges: parsed.edges }) });
}

export default function NetworkPage() {
  const { state, dispatch } = useGame();
  const [selectedId, setSelectedId] = useState('n_brand');
  const [visibleCount, setVisibleCount] = useState(0);
  const [source, setSource] = useState('loading');
  const [notice, setNotice] = useState('正在同步文档、看板和聊天记录…');
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [showRipple, setShowRipple] = useState(false);
  const [imMessages, setImMessages] = useState([]);
  const [flight, setFlight] = useState(null);
  const [toast, setToast] = useState('');
  const flightRef = useRef(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const approved = await loadApprovedNetwork();
        if (!active) return;
        dispatch({ type: 'SET_NODES', payload: approved.nodes });
        dispatch({ type: 'SET_EDGES', payload: approved.edges });
        setSource('api');
      } catch {
        if (!active) return;
        dispatch({ type: 'SET_NODES', payload: FALLBACK_NODES });
        dispatch({ type: 'SET_EDGES', payload: FALLBACK_EDGES });
        setSource('fallback');
      }
      if (active) { dispatch({ type: 'SET_PHASE', payload: PHASES.ACTIVE }); setNotice('发现 1 个关键阻塞：品牌素材已延期 1 天'); }
    }
    load();
    return () => { active = false; };
  }, [dispatch]);

  useEffect(() => {
    if (!state.nodes.length) return undefined;
    const timer = window.setInterval(() => setVisibleCount((count) => Math.min(count + 1, state.nodes.length)), 180);
    return () => window.clearInterval(timer);
  }, [state.nodes.length]);

  const selected = state.nodes.find((node) => node.id === selectedId);
  const metrics = useMemo(() => deriveMetrics(state.nodes), [state.nodes]);
  const action = useMemo(() => getPrimaryAction(selectedId, state.nodes), [selectedId, state.nodes]);
  useEffect(() => { dispatch({ type: 'SET_METRICS', payload: metrics }); }, [dispatch, metrics]);

  async function completeCurrentDesign() {
    setBusy(true);
    try { await request('/api/node/complete', { method: 'POST', body: JSON.stringify({ nodeId: 'n_design' }) }); } catch { /* local demo fallback */ }
    dispatch({ type: 'SET_NODES', payload: completeDesign(state.nodes) });
    setNotice('上游已完成，前端开发与联调测试可以开始了'); setStep(3); setBusy(false);
  }

  function handleAction(kind) {
    if (kind === 'inspect-impact') { setSelectedId('n_design'); setNotice('品牌素材延期正在影响首页设计稿，并继续阻塞研发。'); setStep(2); }
    if (kind === 'complete-design') completeCurrentDesign();
    if (kind === 'view-ripple') { setShowRipple(true); setStep(4); }
    if (kind === 'select-bottleneck') { setSelectedId('n_brand'); setStep(1); }
  }

  function resetDemo() {
    dispatch({ type: 'SET_NODES', payload: FALLBACK_NODES }); dispatch({ type: 'SET_EDGES', payload: FALLBACK_EDGES });
    flightRef.current = null;
    setSelectedId('n_brand'); setVisibleCount(FALLBACK_NODES.length); setStep(1); setShowRipple(false); setImMessages([]); setFlight(null); setToast(''); setNotice('已重置：先检查延期的「品牌素材」'); setSource('fallback');
  }

  const finishDemoFlight = useCallback(() => {
    const currentFlight = flightRef.current;
    flightRef.current = null;
    setImMessages((messages) => completeDemoFlight(currentFlight, messages).messages);
    setFlight(null);
  }, []);

  function handlePoke(poke, nodeId) {
    if (POKE_PRESENTATION.fakeIM) {
      const nodeElement = document.querySelector(getNodeAnchorSelector(nodeId));
      const bounds = nodeElement?.getBoundingClientRect();
      const nextFlight = { poke, from: { x: bounds?.left ?? window.innerWidth / 2, y: bounds?.top ?? window.innerHeight / 2 }, to: { x: window.innerWidth - 210, y: window.innerHeight - 190 } };
      flightRef.current = nextFlight;
      setFlight(nextFlight);
    } else {
      setToast(getPushToast(poke));
      window.setTimeout(() => setToast(''), 2200);
    }
  }

  const loading = source === 'loading';
  return <main className="min-h-screen min-w-[1100px] bg-slate-950 p-4 text-slate-100" data-phase={state.phase}>
    <header className="flex h-16 items-center justify-between rounded-t-2xl border border-slate-800 bg-slate-900/90 px-5"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky-300 to-indigo-500 font-black text-slate-950">P</span><div><b>戳戳 Poke</b><small className="block text-slate-500">协作网络 · B 前端</small></div></div><div className="flex items-center gap-3"><MetricsBar metrics={metrics} /><button type="button" onClick={() => desktopBridge.openAssistant()} className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs text-blue-200">打开悬浮助手</button></div></header>
    <div className="flex h-9 items-center gap-2 border-x border-slate-800 bg-slate-950 px-5 text-[11px] text-slate-500"><span className={`rounded-md px-2 py-1 ${source === 'api' ? 'bg-emerald-950 text-emerald-300' : 'bg-blue-950 text-blue-300'}`}>{loading ? '连接中' : source === 'api' ? 'API 数据' : '演示数据'}</span><b className="text-slate-400">来源：</b>{source === 'api' ? '本地 Express 接口' : '契约 fixture'}<b className="ml-2 text-slate-400">限制：</b>{source === 'api' ? '模拟飞书数据' : '后端未就绪，当前结果仅用于演示'}</div>
    <div className="relative flex h-14 items-center justify-center gap-3 border-x border-t border-slate-800 bg-slate-950">{['发现阻塞', '确认影响', '推进任务', '查看价值'].map((label, index) => <div className={`flex items-center gap-2 text-xs ${step >= index + 1 ? 'text-white' : 'text-slate-600'}`} key={label}><b className={`grid h-6 w-6 place-items-center rounded-full ${step >= index + 1 ? 'bg-blue-600' : 'bg-slate-800'}`}>{index + 1}</b>{label}{index < 3 && <i className="ml-2 not-italic text-slate-700">→</i>}</div>)}<button className="absolute right-5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400" onClick={resetDemo}>重置演示</button></div>
    {notice && <div className="fixed left-1/2 top-24 z-40 -translate-x-1/2 rounded-xl border border-blue-800 bg-slate-900 px-5 py-3 text-sm shadow-2xl" role="status">{notice}</div>}
    <div className="grid h-[calc(100vh-189px)] min-h-[610px] grid-cols-[minmax(760px,1fr)_320px] grid-rows-[82px_1fr] overflow-hidden rounded-b-2xl border border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 px-6"><div><small className="text-slate-500">产品升级项目 · 当前目标：解除发布阻塞</small><h1 className="mt-1 text-xl font-semibold">{step < 3 ? '发现 1 个关键阻塞，先处理品牌素材' : '阻塞已解除，下游已自动同步'}</h1></div><div className="flex gap-3 text-[11px]"><span className="text-emerald-400">● 已完成</span><span className="text-yellow-400">● 进行中</span><span className="text-slate-500">● 未开始</span><span className="text-blue-400">━ 关键路径</span></div></div>
      {loading ? <div className="grid place-items-center"><div className="text-center text-slate-500"><span className="mx-auto mb-3 grid h-14 w-14 animate-pulse place-items-center rounded-full bg-blue-950 text-blue-300">AI</span>正在解析工作记录并生成依赖网络…</div></div> : <NetworkGraph nodes={state.nodes} edges={state.edges} selectedId={selectedId} visibleCount={visibleCount} onSelect={setSelectedId} />}
      <NodeCard node={selected} nodes={state.nodes} edges={state.edges} action={action} busy={busy} onAction={handleAction} actionSlot={<PokeAction node={selected} onDelivered={handlePoke} />} />
    </div><PokeLog pokes={state.pokes} />
    {DemoFakeIMWindow && <Suspense fallback={null}><DemoFakeIMWindow messages={imMessages} /></Suspense>}
    {DemoFlyingLamp && flight && <Suspense fallback={null}><DemoFlyingLamp from={flight.from} to={flight.to} duration={1500} onArrive={finishDemoFlight} /></Suspense>}
    {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-100 px-5 py-3 text-sm text-slate-900 shadow-2xl" role="status">{toast}</div>}
    {showRipple && <RippleView onClose={() => setShowRipple(false)} />}
  </main>;
}
