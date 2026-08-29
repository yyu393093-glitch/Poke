import { useEffect, useState } from 'react';

import { approveNetwork, fetchFeishuData, feishuAuth, parseTasks } from '../api/gameApi.js';
import NetworkGraph from '../components/NetworkGraph.jsx';
import { PHASES, useGame } from '../context/GameContext.jsx';
import '../styles/dashboard.css';

export default function NetworkPage() {
  const { state, dispatch } = useGame();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [visibleCount, setVisibleCount] = useState(0);
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let intervalId;
    let noticeId;

    async function loadNetwork() {
      setLoading(true);
      dispatch({ type: 'SET_PHASE', payload: PHASES.OPEN });

      // 完整走一遍飞书链路，生长动画才有意义（md 03 §6 约束）
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

      // 逐层点亮：按关键路径顺序每 200ms 亮一个
      let nextCount = 0;
      intervalId = window.setInterval(() => {
        nextCount += 1;
        setVisibleCount(Math.min(nextCount, approved.nodes.length));
        if (nextCount >= approved.nodes.length) window.clearInterval(intervalId);
      }, 200);

      noticeId = window.setTimeout(() => setShowNotice(false), 2000);
    }

    loadNetwork().catch((error) => {
      console.error(error);
      if (cancelled) return;
      setFailed('连不上本地 mock 后端（http://localhost:3001），请先运行 npm start --prefix server');
      setLoading(false);
    });

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.clearTimeout(noticeId);
    };
  }, [dispatch]);

  if (loading || failed) {
    return (
      <div className="pk-screen">
        <section className="pk-loading" aria-live="polite">
          {!failed && <span className="pk-loading__orbit" aria-hidden="true" />}
          <p>{failed ? '加载失败' : '正在同步飞书文档 / 看板 / 聊天…'}</p>
          <strong>{failed || 'AI 正在解析依赖关系'}</strong>
        </section>
      </div>
    );
  }

  return (
    <>
      <NetworkGraph
        nodes={state.nodes}
        edges={state.edges}
        visibleCount={visibleCount || state.nodes.length}
      />
      {showNotice && (
        <div className="pk-toast" role="status" style={{ bottom: 'auto', top: '24px', zIndex: 80 }}>
          你的「首页设计稿」正在阻塞 2 个下游任务
        </div>
      )}
    </>
  );
}
