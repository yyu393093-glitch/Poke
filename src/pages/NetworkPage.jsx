import { useEffect, useState } from 'react';

import { approveNetwork, fetchFeishuData, feishuAuth, parseTasks } from '../api/gameApi.js';
import NetworkGraph from '../components/NetworkGraph.jsx';
import { PHASES, useGame } from '../context/GameContext.jsx';

export default function NetworkPage() {
  const { state, dispatch } = useGame();
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(0);
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let intervalId;
    let noticeId;

    async function loadNetwork() {
      setLoading(true);
      dispatch({ type: 'SET_PHASE', payload: PHASES.OPEN });

      const auth = await feishuAuth();
      const feishuData = await fetchFeishuData(auth.token);
      const parsed = await parseTasks(feishuData.tasks);
      const approved = await approveNetwork(parsed.nodes, parsed.edges);

      if (cancelled) return;

      dispatch({ type: 'SET_NODES', payload: approved.nodes });
      dispatch({ type: 'SET_EDGES', payload: approved.edges });
      setLoading(false);
      setShowNotice(true);
      dispatch({ type: 'SET_PHASE', payload: PHASES.ACTIVE });

      let nextCount = 0;
      intervalId = window.setInterval(() => {
        nextCount += 1;
        setVisibleCount(Math.min(nextCount, approved.nodes.length));
        if (nextCount >= approved.nodes.length) {
          window.clearInterval(intervalId);
        }
      }, 200);

      noticeId = window.setTimeout(() => setShowNotice(false), 2000);
    }

    loadNetwork().catch((error) => {
      console.error(error);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.clearTimeout(noticeId);
    };
  }, [dispatch]);

  return (
    <main className="network-page" data-phase={state.phase}>
      {showNotice && (
        <div className="network-notice glass-surface" role="status">
          你的「首页设计稿」正在阻塞 2 个下游任务
        </div>
      )}

      {loading ? (
        <section className="network-loading glass-surface" aria-live="polite">
          <span className="loading-orbit" aria-hidden="true" />
          <p>正在同步飞书文档/看板/聊天…</p>
          <strong>AI 正在解析依赖关系</strong>
        </section>
      ) : (
        <NetworkGraph
          nodes={state.nodes}
          edges={state.edges}
          visibleCount={visibleCount || state.nodes.length}
        />
      )}
    </main>
  );
}
