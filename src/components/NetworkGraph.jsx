import { useEffect, useMemo, useState } from 'react';

import { clockOff, completeNode, fetchMetrics, pokeTask } from '../api/gameApi.js';
import NodeCard from './NodeCard.jsx';

const STATUS_LABEL = {
  done: '已完成',
  doing: '进行中',
  todo: '未开始',
};

const TASK_ORDER = ['n_req', 'n_brand', 'n_design', 'n_copy', 'n_dev', 'n_test'];

const LEADERS = [
  { id: 'n_design', name: '小陈', role: '设计部', avatar: '陈', count: 1 },
  { id: 'n_dev', name: '老李', role: '研发总监', avatar: '李', count: 1 },
  { id: 'n_copy', name: '阿May', role: '运营负责人', avatar: 'M', count: 0 },
  { id: 'n_brand', name: '陈总', role: '项目总负责人', avatar: '总', count: 0 },
];

const INITIAL_LOGS = [
  { id: 'log-1', from: '小陈', to: '陈总', time: '17:57:32', text: '首页设计稿还差品牌素材，请同步一下进度。' },
  { id: 'log-2', from: '老李', to: '小陈', time: '17:50:12', text: '上游已完成，你可以开始了。' },
  { id: 'log-3', from: '小赵', to: '小陈', time: '17:50:15', text: '收到，马上跟进。' },
];

function Icon({ type }) {
  const paths = {
    progress: (
      <>
        <path d="M12 3a9 9 0 1 1-8.5 6" />
        <path d="M12 3v9h9" />
      </>
    ),
    check: (
      <>
        <path d="M5 12.5 10 17 19 7" />
        <path d="M4 4h16v16H4z" />
      </>
    ),
    alert: (
      <>
        <path d="M12 3 22 20H2L12 3Z" />
        <path d="M12 9v5" />
        <path d="M12 17h.01" />
      </>
    ),
    users: (
      <>
        <path d="M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4" />
        <circle cx="12" cy="9" r="3" />
        <path d="M22 19c0-1.8-1.2-3.3-2.8-3.8" />
        <path d="M18 6.2a2.8 2.8 0 0 1 0 5.6" />
        <path d="M2 19c0-1.8 1.2-3.3 2.8-3.8" />
        <path d="M6 6.2a2.8 2.8 0 0 0 0 5.6" />
      </>
    ),
    poke: (
      <>
        <path d="M7 12v6a3 3 0 0 0 3 3h3.5a4 4 0 0 0 3.8-2.7l1.2-3.6A2 2 0 0 0 16.6 12H14V5a2 2 0 0 0-4 0v8" />
        <path d="M7 12 5.5 10.5A1.8 1.8 0 0 0 3 13l4 5" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    power: (
      <>
        <path d="M12 2v10" />
        <path d="M6.4 6.8a8 8 0 1 0 11.2 0" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      {paths[type]}
    </svg>
  );
}

function routePath(points) {
  if (points.length < 2) return '';

  const [first, ...rest] = points;
  const commands = [`M ${first.x} ${first.y}`];

  rest.forEach((point, index) => {
    const previous = points[index];
    const next = rest[index + 1];

    if (!next) {
      commands.push(`Q ${previous.x} ${previous.y} ${point.x} ${point.y}`);
      return;
    }

    const midX = (point.x + next.x) / 2;
    const midY = (point.y + next.y) / 2;
    commands.push(`Q ${point.x} ${point.y} ${midX} ${midY}`);
  });

  return commands.join(' ');
}

function nowTime() {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
}

export default function NetworkGraph({ nodes, edges, visibleCount = nodes.length }) {
  const [selectedId, setSelectedId] = useState('n_design');
  const [busyId, setBusyId] = useState('');
  const [toast, setToast] = useState('');
  const [completedIds, setCompletedIds] = useState(new Set());
  const [logs, setLogs] = useState(INITIAL_LOGS);
  const [metrics, setMetrics] = useState({ doneToday: 3, alignedPeople: 5, blocked: 2 });
  const [clock, setClock] = useState(nowTime());
  const [lightsOff, setLightsOff] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(nowTime()), 1000);
    fetchMetrics().then((nextMetrics) => {
      setMetrics({ ...nextMetrics, blocked: 2 });
    }).catch(() => {});
    return () => window.clearInterval(timer);
  }, []);

  const normalizedNodes = useMemo(() => {
    const nodeMap = new Map(nodes.map((node) => [
      node.id,
      completedIds.has(node.id) ? { ...node, status: 'done', isDelayed: false, isBottleneck: false } : node,
    ]));

    return TASK_ORDER.map((id) => nodeMap.get(id)).filter(Boolean);
  }, [completedIds, nodes]);

  const selectedNode = normalizedNodes.find((node) => node.id === selectedId) ?? normalizedNodes[2];
  const visibleNodes = normalizedNodes.slice(0, visibleCount);
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const doneCount = normalizedNodes.filter((node) => node.status === 'done').length;
  const progress = Math.round((doneCount / Math.max(normalizedNodes.length, 1)) * 100);

  const criticalPoints = useMemo(
    () => ['n_req', 'n_brand', 'n_design', 'n_dev', 'n_test']
      .map((id) => normalizedNodes.find((node) => node.id === id))
      .filter(Boolean),
    [normalizedNodes],
  );
  const blockedPoints = useMemo(
    () => ['n_brand', 'n_design'].map((id) => normalizedNodes.find((node) => node.id === id)).filter(Boolean),
    [normalizedNodes],
  );
  const copyPoints = useMemo(
    () => ['n_req', 'n_copy'].map((id) => normalizedNodes.find((node) => node.id === id)).filter(Boolean),
    [normalizedNodes],
  );
  const testPoints = useMemo(
    () => ['n_design', 'n_test'].map((id) => normalizedNodes.find((node) => node.id === id)).filter(Boolean),
    [normalizedNodes],
  );

  function addLog(from, to, text) {
    setLogs((items) => [
      { id: `${Date.now()}-${to}`, from, to, time: nowTime(), text },
      ...items,
    ].slice(0, 5));
  }

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  }

  async function pokeNode(targetId, from = '小陈') {
    if (busyId) return;

    const target = normalizedNodes.find((node) => node.id === targetId);
    setBusyId(`poke-${targetId}`);
    setSelectedId(targetId);

    try {
      const result = await pokeTask(from, targetId);
      addLog(from, target?.owner ?? '负责人', result.message);
      showToast(`已公开催进度：${result.message}`);
    } catch (error) {
      console.error(error);
      showToast('催进度失败，请确认 mock 后端已启动');
    } finally {
      setBusyId('');
    }
  }

  async function markSelectedDone() {
    if (!selectedNode || busyId) return;

    setBusyId(`done-${selectedNode.id}`);
    try {
      const result = await completeNode(selectedNode.id);
      setCompletedIds((items) => new Set([...items, selectedNode.id]));
      const notified = result.notifications?.map((item) => item.to).join('、') || '下游负责人';
      addLog(selectedNode.owner, notified, '上游已完成，你可以开始了。');
      showToast(`${selectedNode.name} 已标记完成，已通知 ${notified}`);
    } catch (error) {
      console.error(error);
      showToast('更新状态失败，请确认 mock 后端已启动');
    } finally {
      setBusyId('');
    }
  }

  async function turnLightsOff() {
    if (busyId) return;

    setBusyId('off');
    try {
      await clockOff();
      setLightsOff(true);
      addLog('系统', '全员', '下班边界已开启，明天再戳。');
      showToast('已收工关灯：别人戳你会收到边界提醒');
    } catch (error) {
      console.error(error);
      showToast('关灯失败，请确认 mock 后端已启动');
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className={lightsOff ? 'poke-map-dashboard is-night' : 'poke-map-dashboard'} aria-label="戳戳协作项目地图">
      <div className="poke-map-art" aria-hidden="true" />

      <header className="poke-header">
        <div className="poke-brand">
          <div className="poke-mascot poke-mascot--small">
            <span />
          </div>
          <div>
            <h1>戳戳 Poke</h1>
            <p>让协作更轻松，让进度被看见</p>
          </div>
        </div>

        <div className="poke-stats glass-surface" aria-label="项目总览">
          <div className="poke-stat">
            <Icon type="progress" />
            <span>项目进度</span>
            <strong>{progress}%</strong>
          </div>
          <div className="poke-stat">
            <Icon type="check" />
            <span>今日完成</span>
            <strong>{metrics.doneToday} 项</strong>
          </div>
          <div className="poke-stat">
            <Icon type="alert" />
            <span>阻塞任务</span>
            <strong>{metrics.blocked} 项</strong>
          </div>
          <div className="poke-stat">
            <Icon type="users" />
            <span>对齐人数</span>
            <strong>{metrics.alignedPeople} 人</strong>
          </div>
        </div>

        <time className="poke-clock glass-surface" dateTime={clock}>
          <Icon type="progress" />
          {clock}
        </time>
      </header>

      {toast && (
        <div className="poke-toast glass-surface" role="status">
          {toast}
        </div>
      )}

      <aside className="poke-legend glass-surface" aria-label="地图图例">
        <h2>节点状态</h2>
        <span><i className="legend-dot done" />已完成</span>
        <span><i className="legend-dot doing" />进行中</span>
        <span><i className="legend-dot todo" />未开始</span>
        <span><i className="legend-dot delayed" />延期中</span>
        <span><i className="legend-ring" />瓶颈卡点</span>
        <hr />
        <h2>连线类型</h2>
        <span><i className="legend-line open" />畅通</span>
        <span><i className="legend-line blocked" />拥堵</span>
        <span><i className="legend-line waiting" />等待中</span>
      </aside>

      <aside className="poke-leaders glass-surface" aria-label="项目 Leader">
        <h2>项目 Leader</h2>
        <div className="leader-grid">
          {LEADERS.map((leader) => (
            <div className="leader-person" key={leader.id}>
              <button
                type="button"
                className="leader-head"
                onClick={() => setSelectedId(leader.id)}
                aria-label={`查看 ${leader.name} 的任务`}
              >
                <span>{leader.avatar}</span>
                {leader.count > 0 && <i>{leader.count}</i>}
              </button>
              <strong>{leader.name}</strong>
              <small>{leader.role}</small>
              <button
                type="button"
                className="leader-poke-btn"
                disabled={Boolean(busyId)}
                onClick={() => pokeNode(leader.id)}
              >
                <Icon type="poke" />
                催进度
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="project-island-field">
        <svg className="project-rivers" viewBox="0 0 800 560" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="openRiver" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#c7f9d4" />
              <stop offset="42%" stopColor="#9ce970" />
              <stop offset="100%" stopColor="#d9ffad" />
            </linearGradient>
            <linearGradient id="blockedRiver" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff9a80" />
              <stop offset="100%" stopColor="#f04e3e" />
            </linearGradient>
          </defs>
          <path className="river-base" d={routePath(criticalPoints)} />
          <path className="river-open" d={routePath(criticalPoints)} />
          <path className="river-glint" d={routePath(criticalPoints)} />
          <path className="river-blocked" d={routePath(blockedPoints)} />
          <path className="river-branch-open" d={routePath(copyPoints)} />
          <path className="river-branch-waiting" d={routePath(testPoints)} />
        </svg>

        {visibleNodes.map((node, index) => (
          <button
            key={node.id}
            type="button"
            className={[
              'project-island',
              `project-island--${node.status}`,
              node.id === selectedNode?.id ? 'is-selected' : '',
              node.isBottleneck ? 'is-bottleneck' : '',
              node.isDelayed ? 'is-delayed' : '',
            ].filter(Boolean).join(' ')}
            style={{ left: `${(node.x / 800) * 100}%`, top: `${(node.y / 560) * 100}%` }}
            aria-label={`${node.name}，负责人${node.owner}，状态${STATUS_LABEL[node.status]}`}
            onMouseEnter={() => setSelectedId(node.id)}
            onFocus={() => setSelectedId(node.id)}
            onClick={() => setSelectedId(node.id)}
          >
            <span className="island-art" aria-hidden="true">
              <span className="island-lagoon" />
              <span className="island-beach" />
              <span className="island-ground" />
              <span className="island-building" />
              <span className="island-tree island-tree--a" />
              <span className="island-tree island-tree--b" />
              <span className="island-tree island-tree--c" />
            </span>
            <span className="member-avatar" aria-hidden="true">{node.owner.slice(0, 1)}</span>
            <span className="task-sign">
              <strong>{String(index + 1).padStart(2, '0')} {node.name}</strong>
              <small>{node.owner} ｜ {node.dept}</small>
            </span>
            {node.isDelayed && <span className="route-warning">已延期 1 天</span>}
            {node.isBottleneck && <span className="route-danger">瓶颈 · 阻塞 2 个下游</span>}
          </button>
        ))}
      </div>

      <div className="poke-helper">
        <div className="poke-mascot poke-mascot--large">
          <span />
        </div>
        <div className="helper-bubble glass-surface">
          点击节点<br />
          查看详情<br />
          戳一戳催进度！
        </div>
      </div>

      <section className="alignment-card glass-surface" aria-label="今日对齐度">
        <h2>今日对齐度</h2>
        <div className="alignment-stats">
          <strong><Icon type="check" />{metrics.doneToday}<span>今日完成<br />（项）</span></strong>
          <strong><Icon type="users" />{metrics.alignedPeople}<span>对齐人数<br />（人）</span></strong>
          <strong><Icon type="alert" />{metrics.blocked}<span>阻塞任务<br />（项）</span></strong>
        </div>
      </section>

      <section className="quick-actions glass-surface" aria-label="快速操作">
        <h2>快速操作</h2>
        <div>
          <button type="button" disabled={Boolean(busyId)} onClick={() => selectedNode && pokeNode(selectedNode.id)}>
            <Icon type="poke" />
            <span>戳一戳</span>
            <small>催进度</small>
          </button>
          <button type="button" disabled={Boolean(busyId)} onClick={markSelectedDone}>
            <Icon type="check" />
            <span>标记完成</span>
            <small>更新状态</small>
          </button>
          <button type="button" onClick={() => setSelectedId('n_design')}>
            <Icon type="eye" />
            <span>查看影响</span>
            <small>涟漪视图</small>
          </button>
          <button type="button" disabled={Boolean(busyId) || lightsOff} onClick={turnLightsOff}>
            <Icon type="power" />
            <span>收工关灯</span>
            <small>下班啦</small>
          </button>
        </div>
      </section>

      <section className="poke-log glass-surface" aria-label="公开戳一戳记录">
        <header>
          <h2>戳一戳记录（公开可见）</h2>
          <button type="button">查看全部</button>
        </header>
        <div className="log-list">
          {logs.map((log) => (
            <article key={log.id}>
              <span className="log-face">{log.from.slice(0, 1)}</span>
              <p><strong>{log.from}</strong><i>→</i><strong>{log.to}</strong><br />{log.text}</p>
              <time>{log.time}</time>
            </article>
          ))}
        </div>
      </section>

      <footer className="poke-footer">
        <span>{clock}</span>
        <span>下班前 3 分钟，把一天对齐。</span>
        <strong>戳戳 Poke · 演示模式 · v1.0.0</strong>
      </footer>

      {visibleIds.has(selectedNode?.id) && (
        <NodeCard node={selectedNode} nodes={normalizedNodes} edges={edges} />
      )}
    </section>
  );
}
