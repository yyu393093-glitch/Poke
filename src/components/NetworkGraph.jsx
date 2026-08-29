import { useEffect, useMemo, useState } from 'react';

import { clockOff, completeNode, fetchMetrics, pokeTask } from '../api/gameApi.js';
import referenceDashboard from '../assets/poke-reference-dashboard.png';
import NodeCard from './NodeCard.jsx';

const STATUS_LABEL = {
  done: '已完成',
  doing: '进行中',
  todo: '未开始',
};

const TASK_HOTSPOTS = [
  { id: 'n_req', label: '01 需求文档', left: 46.2, top: 27.8, width: 14.4, height: 15.8 },
  { id: 'n_brand', label: '02 品牌素材', left: 23.6, top: 43.3, width: 15.4, height: 17.3 },
  { id: 'n_design', label: '03 首页设计稿', left: 48.2, top: 50.4, width: 16.8, height: 18.8 },
  { id: 'n_copy', label: '04 运营文案', left: 73.4, top: 40.6, width: 15.6, height: 16.4 },
  { id: 'n_dev', label: '05 前端开发', left: 29.1, top: 69.2, width: 15.4, height: 16.8 },
  { id: 'n_test', label: '06 联调测试', left: 63.5, top: 70.4, width: 15.8, height: 16.6 },
];

const LEADER_HOTSPOTS = [
  { id: 'n_design', label: '催小陈进度', left: 73.2, top: 26.3, width: 7.2, height: 3.6 },
  { id: 'n_dev', label: '催老李进度', left: 81.2, top: 26.3, width: 7.2, height: 3.6 },
  { id: 'n_copy', label: '催阿May进度', left: 89.1, top: 26.3, width: 7.2, height: 3.6 },
  { id: 'n_brand', label: '催陈总进度', left: 96.1, top: 26.3, width: 7.2, height: 3.6 },
];

const QUICK_ACTIONS = [
  { type: 'poke', label: '戳一戳催进度', left: 48.2, top: 84.4, width: 5.8, height: 11.5 },
  { type: 'complete', label: '标记完成更新状态', left: 55.5, top: 84.4, width: 6.2, height: 11.5 },
  { type: 'impact', label: '查看影响涟漪视图', left: 63.1, top: 84.4, width: 6.2, height: 11.5 },
  { type: 'clockOff', label: '收工关灯下班啦', left: 70.6, top: 84.4, width: 6.2, height: 11.5 },
];

const INITIAL_LOGS = [
  { id: 'log-1', from: '小陈', to: '陈总', time: '17:57:32', text: '陈总好，首页设计稿还差品牌素材...' },
  { id: 'log-2', from: '老李', to: '小陈', time: '17:50:12', text: '上游已完成，你可以开始了！' },
  { id: 'log-3', from: '小赵', to: '小陈', time: '17:50:15', text: '收到！马上跟进～' },
];

function nowTime() {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
}

export default function NetworkGraph({ nodes, edges }) {
  const [selectedId, setSelectedId] = useState(null);
  const [panelNodeId, setPanelNodeId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [logs, setLogs] = useState(INITIAL_LOGS);
  const [completedIds, setCompletedIds] = useState(new Set());
  const [metrics, setMetrics] = useState({ doneToday: 3, alignedPeople: 5, blocked: 2 });
  const [lightsOff, setLightsOff] = useState(false);

  useEffect(() => {
    fetchMetrics().then((nextMetrics) => {
      setMetrics({ ...nextMetrics, blocked: 2 });
    }).catch(() => {});
  }, []);

  const normalizedNodes = useMemo(
    () => nodes.map((node) => (
      completedIds.has(node.id)
        ? { ...node, status: 'done', isDelayed: false, isBottleneck: false }
        : node
    )),
    [completedIds, nodes],
  );

  const selectedNode = normalizedNodes.find((node) => node.id === panelNodeId);

  function findNode(id) {
    return normalizedNodes.find((node) => node.id === id);
  }

  function pushLog(from, to, text) {
    setLogs((items) => [
      { id: `${Date.now()}-${to}`, from, to, time: nowTime(), text },
      ...items,
    ].slice(0, 3));
  }

  function showToast(message) {
    setToast(message);
    window.clearTimeout(window.__pokeToastTimer);
    window.__pokeToastTimer = window.setTimeout(() => setToast(''), 2400);
  }

  async function pokeNode(targetId, from = '小陈') {
    if (busy) return;
    const target = findNode(targetId);

    setBusy(true);
    setSelectedId(targetId);
    try {
      const result = await pokeTask(from, targetId);
      pushLog(from, target?.owner ?? '负责人', result.message);
      showToast(`已公开催进度：${result.message}`);
    } catch (error) {
      console.error(error);
      showToast('催进度失败，请确认 mock 后端已启动');
    } finally {
      setBusy(false);
    }
  }

  async function markSelectedDone() {
    const targetId = selectedId ?? 'n_design';
    const target = findNode(targetId);
    if (busy || !target) return;

    setBusy(true);
    try {
      const result = await completeNode(targetId);
      setCompletedIds((items) => new Set([...items, targetId]));
      setMetrics((item) => ({
        ...item,
        doneToday: Math.max(item.doneToday, 4),
        blocked: targetId === 'n_design' ? 0 : item.blocked,
      }));
      const notified = result.notifications?.map((item) => item.to).join('、') || '下游负责人';
      pushLog(target.owner, notified, '上游已完成，你可以开始了！');
      showToast(`${target.name} 已完成，已自动通知 ${notified}`);
    } catch (error) {
      console.error(error);
      showToast('标记完成失败，请确认 mock 后端已启动');
    } finally {
      setBusy(false);
    }
  }

  async function turnLightsOff() {
    if (busy || lightsOff) return;

    setBusy(true);
    try {
      await clockOff();
      setLightsOff(true);
      pushLog('系统', '全员', '下班边界已开启，明天再戳。');
      showToast('已收工关灯：下班后戳你会提示明天再戳');
    } catch (error) {
      console.error(error);
      showToast('关灯失败，请确认 mock 后端已启动');
    } finally {
      setBusy(false);
    }
  }

  function handleQuickAction(type) {
    if (type === 'poke') {
      pokeNode(selectedId ?? 'n_brand');
      return;
    }

    if (type === 'complete') {
      markSelectedDone();
      return;
    }

    if (type === 'impact') {
      setSelectedId('n_design');
      setPanelNodeId('n_design');
      showToast('首页设计稿影响 2 个下游任务：前端开发、联调测试');
      return;
    }

    turnLightsOff();
  }

  return (
    <section className={lightsOff ? 'reference-dashboard is-clocked-off' : 'reference-dashboard'} aria-label="戳戳 Poke 协作网络图">
      <img
        className="reference-dashboard__image"
        src={referenceDashboard}
        alt="戳戳 Poke 协作地图界面"
        draggable="false"
      />

      <div className="reference-dashboard__sr" aria-live="polite">
        当前项目进度 42%，今日完成 {metrics.doneToday} 项，阻塞任务 {metrics.blocked} 项，对齐人数 {metrics.alignedPeople} 人。
      </div>

      {TASK_HOTSPOTS.map((spot) => {
        const node = findNode(spot.id);
        return (
          <button
            key={spot.id}
            type="button"
            className={selectedId === spot.id ? 'reference-hotspot is-active' : 'reference-hotspot'}
            style={{ left: `${spot.left}%`, top: `${spot.top}%`, width: `${spot.width}%`, height: `${spot.height}%` }}
            aria-label={`${spot.label}，${node?.owner ?? ''}，状态 ${STATUS_LABEL[node?.status] ?? ''}，点击查看详情`}
            onMouseEnter={() => setSelectedId(spot.id)}
            onFocus={() => setSelectedId(spot.id)}
            onClick={() => {
              setSelectedId(spot.id);
              setPanelNodeId(spot.id);
            }}
          />
        );
      })}

      {LEADER_HOTSPOTS.map((spot) => (
        <button
          key={spot.label}
          type="button"
          className="reference-hotspot reference-hotspot--leader"
          style={{ left: `${spot.left}%`, top: `${spot.top}%`, width: `${spot.width}%`, height: `${spot.height}%` }}
          aria-label={spot.label}
          disabled={busy}
          onClick={() => pokeNode(spot.id)}
        />
      ))}

      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.type}
          type="button"
          className="reference-hotspot reference-hotspot--quick"
          style={{ left: `${action.left}%`, top: `${action.top}%`, width: `${action.width}%`, height: `${action.height}%` }}
          aria-label={action.label}
          disabled={busy}
          onClick={() => handleQuickAction(action.type)}
        />
      ))}

      <button
        type="button"
        className="reference-hotspot reference-hotspot--helper"
        aria-label="打开首页设计稿详情"
        onClick={() => {
          setSelectedId('n_design');
          setPanelNodeId('n_design');
        }}
      />

      {toast && (
        <div className="reference-toast glass-surface" role="status">
          {toast}
        </div>
      )}

      <section className="reference-live-log" aria-label="最新公开戳一戳记录">
        {logs.map((log) => (
          <article key={log.id}>
            <strong>{log.from} → {log.to}</strong>
            <span>{log.text}</span>
            <time>{log.time}</time>
          </article>
        ))}
      </section>

      {selectedNode && (
        <div className="reference-node-popover">
          <button type="button" aria-label="关闭任务详情" onClick={() => setPanelNodeId(null)}>
            ×
          </button>
          <NodeCard node={selectedNode} nodes={normalizedNodes} edges={edges} />
          <button
            type="button"
            className="reference-popover-action"
            disabled={busy}
            onClick={() => pokeNode(selectedNode.id)}
          >
            戳一戳催进度
          </button>
        </div>
      )}
    </section>
  );
}
