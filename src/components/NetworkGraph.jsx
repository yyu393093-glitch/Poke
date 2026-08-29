import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { clockOff, completeNode, pokeTask } from '../api/gameApi.js';
import referenceDashboard from '../assets/poke-reference-dashboard.png';
import cleanPlate from '../assets/poke-map-clean.png';
import '../styles/dashboard.css';
import NodeCard from './NodeCard.jsx';

const STAGE_W = 1536;
const STAGE_H = 1024;

/** 定稿图中各元素的实测位置（1536×1024 画布坐标）。 */
/* pill  = 任务名药丸（只用来定位选中环，不覆盖它 —— 完成时药丸文字本来就不变）
   badge = 底图上的状态徽章，完成后用「已完成」盖住它
   check = 完成后打勾的圆心（对齐 01/04 已有的那个勾） */
const NODE_UI = {
  n_req: {
    no: '01',
    pill: [605, 252, 125, 53],
    badge: null,
    check: [718, 266],
    hit: [560, 200, 190, 112],
    popover: [612, 318],
  },
  n_brand: {
    no: '02',
    pill: [296, 443, 137, 57],
    badge: [317, 505, 82, 22],
    check: [429, 447],
    hit: [286, 396, 168, 142],
    popover: [300, 546],
  },
  n_design: {
    no: '03',
    pill: [648, 524, 152, 56],
    badge: null,
    check: [796, 528],
    hit: [638, 470, 178, 116],
    popover: [652, 592],
  },
  n_copy: {
    no: '04',
    pill: [1052, 371, 136, 57],
    badge: null,
    check: [1172, 383],
    hit: [1000, 306, 196, 126],
    popover: [940, 440],
  },
  n_dev: {
    no: '05',
    pill: [400, 694, 128, 56],
    badge: [415, 755, 57, 20],
    check: [524, 698],
    hit: [404, 640, 166, 146],
    popover: [408, 470],
  },
  n_test: {
    no: '06',
    pill: [870, 699, 140, 57],
    badge: [906, 762, 61, 20],
    check: [1006, 703],
    hit: [858, 646, 172, 146],
    popover: [700, 430],
  },
};

/** 项目 Leader 一行：头像旁的「催进度」按钮 */
const LEADERS = [
  { id: 'n_design', name: '小陈', btn: [1103, 249, 86, 32] },
  { id: 'n_dev', name: '老李', btn: [1204, 249, 86, 32] },
  { id: 'n_copy', name: '阿May', btn: [1305, 249, 86, 32] },
  { id: 'n_brand', name: '陈总', btn: [1406, 249, 86, 32] },
];

/** 底部「关键路径」五个步骤 */
const PATH_STEPS = [
  { id: 'n_req', cx: 353 },
  { id: 'n_brand', cx: 461 },
  { id: 'n_design', cx: 571 },
  { id: 'n_dev', cx: 685 },
  { id: 'n_test', cx: 799 },
];

/** 顶部指标数字的位置（只有数值变化时才覆盖） */
const STAT_BOX = {
  doneToday: [653, 61, 50, 27],
};

const MASCOT = { x: 80, y: 600 };

const STATUS_LABEL = { done: '已完成', doing: '进行中', todo: '未开始' };

function px([left, top, width, height]) {
  return { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` };
}

function inflate([left, top, width, height], by) {
  return [left - by, top - by, width + by * 2, height + by * 2];
}

function nowTime() {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

export default function NetworkGraph({ nodes, edges, visibleCount }) {
  const [selectedId, setSelectedId] = useState(null);
  const [popoverId, setPopoverId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [completedIds, setCompletedIds] = useState(() => new Set());
  const [newLogs, setNewLogs] = useState([]);
  // 'baked' = 沿用底图上那条（静止画面与定稿图完全一致）
  // 'dom'   = 内容变了，改用可交互的 DOM 版
  // 'closed'= 已关闭，用无通知条底图补位
  const [noticeMode, setNoticeMode] = useState('baked');
  const [noticeLeaving, setNoticeLeaving] = useState(false);
  const [notice, setNotice] = useState({
    title: '上游已完成，你可以开始了！',
    from: '来自：小陈（首页设计稿已完成）',
  });
  const [flyer, setFlyer] = useState(null);
  const [ripple, setRipple] = useState(null);
  const [doneToday, setDoneToday] = useState(3);
  const [lightsOff, setLightsOff] = useState(false);
  const [scale, setScale] = useState(1);

  const toastTimer = useRef(0);
  const flyerTimer = useRef([]);

  /* ---- 等比缩放，让 1536×1024 的画布刚好填满视口 ---- */
  useLayoutEffect(() => {
    function fit() {
      setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    }
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => () => {
    window.clearTimeout(toastTimer.current);
    flyerTimer.current.forEach(window.clearTimeout);
  }, []);

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  }, []);

  /* 完成状态叠加到后端返回的节点上 */
  const liveNodes = nodes.map((node) => (
    completedIds.has(node.id)
      ? { ...node, status: 'done', isDelayed: false, isBottleneck: false }
      : node
  ));

  const findNode = (id) => liveNodes.find((node) => node.id === id);
  const popoverNode = popoverId ? findNode(popoverId) : null;

  function pushLog(entry) {
    setNewLogs((items) => [{ id: `${Date.now()}-${entry.to}`, ...entry }, ...items].slice(0, 1));
  }

  /* ---- 戳一戳：灯仔飞过去 + 公开记录 ---- */
  async function handlePoke(targetId, from = '小陈') {
    if (busy || !targetId) return;
    const target = findNode(targetId);
    if (!target) return;

    if (lightsOff) {
      showToast(`${target.owner} 已经下班了，明天再戳吧 🌙`);
      return;
    }

    const ui = NODE_UI[targetId];
    const destX = ui.hit[0] + ui.hit[2] / 2;
    const destY = ui.hit[1] + ui.hit[3] / 2;

    setBusy(true);
    setSelectedId(targetId);

    // 先起飞，再等接口 —— 反馈不等网络（Apple: respond immediately）
    setFlyer({ x: MASCOT.x, y: MASCOT.y });
    flyerTimer.current.push(window.setTimeout(() => setFlyer({ x: destX, y: destY }), 30));
    flyerTimer.current.push(window.setTimeout(() => {
      setRipple({ x: destX, y: destY });
      setFlyer(null);
    }, 660));
    flyerTimer.current.push(window.setTimeout(() => setRipple(null), 1400));

    try {
      const result = await pokeTask(from, targetId);
      pushLog({ from, to: target.owner, message: result.message, time: nowTime() });
      showToast(`已公开戳一戳 ${target.owner}：${result.message}`);
    } catch (error) {
      console.error(error);
      showToast('催进度失败，请确认本地 mock 后端已启动（端口 3001）');
    } finally {
      setBusy(false);
    }
  }

  /* ---- 标记完成：自动通知所有下游负责人 ---- */
  async function handleComplete(nodeId) {
    const target = findNode(nodeId);
    if (busy || !target || target.status === 'done') return;

    setBusy(true);
    try {
      const result = await completeNode(nodeId);
      setCompletedIds((items) => new Set([...items, nodeId]));
      setDoneToday((value) => value + 1);

      const receivers = result.notifications?.map((item) => item.to) ?? [];
      const names = receivers.join('、') || '下游负责人';

      setNotice({
        title: '上游已完成，你可以开始了！',
        from: `来自：${target.owner}（${target.name}已完成）`,
      });
      setNoticeLeaving(false);
      setNoticeMode('dom');

      pushLog({ from: target.owner, to: names, message: '上游已完成，你可以开始了！', time: nowTime() });
      showToast(`${target.name} 已完成，已自动通知 ${names}`);
      setPopoverId(null);
    } catch (error) {
      console.error(error);
      showToast('标记完成失败，请确认本地 mock 后端已启动（端口 3001）');
    } finally {
      setBusy(false);
    }
  }

  async function handleClockOff() {
    if (busy || lightsOff) return;
    setBusy(true);
    try {
      await clockOff();
      setLightsOff(true);
      showToast('已收工关灯 · 现在别人戳你会提示「他已经下班了，明天再戳吧」');
    } catch (error) {
      console.error(error);
      showToast('关灯失败，请确认本地 mock 后端已启动（端口 3001）');
    } finally {
      setBusy(false);
    }
  }

  function closeNotice() {
    if (noticeMode === 'baked') {
      setNoticeMode('closed');
      return;
    }
    setNoticeLeaving(true);
    window.setTimeout(() => {
      setNoticeMode('closed');
      setNoticeLeaving(false);
    }, 220);
  }

  function openNode(id) {
    setSelectedId(id);
    setPopoverId((current) => (current === id ? null : id));
  }

  const shown = typeof visibleCount === 'number' ? visibleCount : liveNodes.length;
  const isRevealed = (id) => liveNodes.findIndex((node) => node.id === id) < shown;

  return (
    <div className="pk-screen">
      <section
        className="pk-stage"
        style={{ transform: `scale(${scale})` }}
        aria-label="戳戳 Poke 协作地图"
      >
        <img className="pk-stage__base" src={referenceDashboard} alt="" draggable="false" />

        <p className="pk-sr" aria-live="polite">
          协作地图已生成，共 {liveNodes.length} 个任务节点。今日完成 {doneToday} 项。
          {popoverNode ? `当前查看：${popoverNode.name}，负责人 ${popoverNode.owner}。` : ''}
        </p>

        {/* ---------- 通知条 ----------
            静止时直接沿用底图上那条，只在它上面放一个透明的关闭热区；
            内容变化后才切换成 DOM 版；关闭后用无通知条底图补位。 */}
        {noticeMode === 'baked' && (
          <button
            type="button"
            className="pk-hit pk-hit--round"
            style={px([831, 140, 32, 32])}
            aria-label="关闭通知：上游已完成，你可以开始了"
            onClick={closeNotice}
          />
        )}

        {noticeMode === 'dom' && (
          <div className={noticeLeaving ? 'pk-notice is-leaving' : 'pk-notice'} role="status">
            <span className="pk-notice__bell" aria-hidden="true">🔔</span>
            <span className="pk-notice__text">
              <strong>{notice.title}</strong>
              <span>{notice.from}</span>
            </span>
            <button type="button" className="pk-notice__close" aria-label="关闭通知" onClick={closeNotice}>
              ×
            </button>
          </div>
        )}

        {noticeMode === 'closed' && (
          <div className="pk-notice-patch" style={{ backgroundImage: `url(${cleanPlate})` }} />
        )}

        {/* ---------- 任务节点：热区 + 状态变化后的覆盖片 ---------- */}
        {Object.entries(NODE_UI).map(([id, ui]) => {
          const node = findNode(id);
          if (!node) return null;

          const revealed = isRevealed(id);
          const changed = completedIds.has(id);

          return (
            <div key={id}>
              <button
                type="button"
                className={`pk-hit pk-hit--node${selectedId === id ? ' is-selected' : ''}`}
                style={{ ...px(ui.hit), opacity: revealed ? 1 : 0, pointerEvents: revealed ? 'auto' : 'none' }}
                aria-label={`${ui.no} ${node.name}，负责人 ${node.owner}，${node.dept}，状态 ${STATUS_LABEL[node.status]}${node.isDelayed ? '，已延期 1 天' : ''}${node.isBottleneck ? '，瓶颈卡点' : ''}。点击查看详情`}
                onClick={() => openNode(id)}
              />

              {/* 状态环：只在选中该节点时出现，贴着药丸描边
                  —— 保证静止画面与定稿图逐像素一致（md 03 §2 瓶颈 / §4 延期） */}
              {revealed && selectedId === id && (
                <div
                  className={`pk-ring ${
                    node.isBottleneck ? 'pk-bottleneck' : node.isDelayed ? 'pk-delayed' : 'pk-ring--plain'
                  }`}
                  style={px(inflate(ui.pill, 5))}
                  aria-hidden="true"
                />
              )}

              {/* 只有状态真的变了才动底图：打勾 + 盖掉旧状态徽章 */}
              {changed && (
                <span
                  className="pk-check"
                  style={{ left: `${ui.check[0] - 13}px`, top: `${ui.check[1] - 13}px` }}
                  aria-hidden="true"
                >
                  ✓
                </span>
              )}

              {changed && ui.badge && (
                <div className="pk-badge pk-badge--done" style={px(inflate(ui.badge, 2))}>
                  已完成
                </div>
              )}
            </div>
          );
        })}

        {/* ---------- Leader 行的「催进度」按钮 ---------- */}
        {LEADERS.map((leader) => (
          <button
            key={leader.id}
            type="button"
            className="pk-hit"
            style={px(leader.btn)}
            aria-label={`催 ${leader.name} 的进度`}
            disabled={busy}
            onClick={() => handlePoke(leader.id)}
          />
        ))}

        {/* ---------- 底部关键路径的五个步骤 ---------- */}
        {PATH_STEPS.map((step) => {
          const node = findNode(step.id);
          return (
            <button
              key={step.id}
              type="button"
              className="pk-hit pk-hit--round"
              style={px([step.cx - 30, 847, 60, 60])}
              aria-label={`关键路径：${node?.name ?? step.id}，点击查看详情`}
              onClick={() => openNode(step.id)}
            />
          );
        })}

        {/* ---------- 影响涟漪面板的「查看详情」 ---------- */}
        <button
          type="button"
          className="pk-hit"
          style={px([1370, 812, 114, 29])}
          aria-label="查看首页设计稿的影响涟漪详情"
          onClick={() => openNode('n_design')}
        />

        {/* ---------- 缩略地图旁的三个控制键 ---------- */}
        <button
          type="button"
          className="pk-hit"
          style={px([248, 762, 42, 38])}
          aria-label="放大地图"
          onClick={() => showToast('演示模式固定视图，暂不支持缩放')}
        />
        <button
          type="button"
          className="pk-hit"
          style={px([248, 802, 42, 38])}
          aria-label="缩小地图"
          onClick={() => showToast('演示模式固定视图，暂不支持缩放')}
        />
        <button
          type="button"
          className="pk-hit"
          style={px([248, 848, 42, 38])}
          aria-label="收工关灯，开启下班边界"
          disabled={busy}
          onClick={handleClockOff}
        />

        {/* ---------- 吉祥物气泡：点一下打开瓶颈节点 ---------- */}
        <button
          type="button"
          className="pk-hit"
          style={px([155, 562, 132, 80])}
          aria-label="查看瓶颈节点 首页设计稿"
          onClick={() => openNode('n_design')}
        />

        {/* ---------- 新的公开戳一戳记录（顶到记录面板第一行） ---------- */}
        {newLogs[0] && (
          <div className="pk-newlog" key={newLogs[0].id}>
            <span className="pk-newlog__pin">刚刚</span>
            <span className="pk-newlog__who">{newLogs[0].from} → {newLogs[0].to}</span>
            <span className="pk-newlog__msg">{newLogs[0].message}</span>
            <span className="pk-newlog__time">{newLogs[0].time}</span>
          </div>
        )}

        {/* ---------- 灯仔飞行 + 落点涟漪 ---------- */}
        {flyer && (
          <div
            className="pk-flyer"
            style={{ transform: `translate(${flyer.x - 23}px, ${flyer.y - 23}px)` }}
            aria-hidden="true"
          >
            👉
          </div>
        )}

        {ripple && (
          <div
            className="pk-ripple"
            style={px([ripple.x - 55, ripple.y - 55, 110, 110])}
            aria-hidden="true"
          />
        )}

        {/* ---------- 节点详情 ---------- */}
        {popoverNode && (
          <div
            className="pk-popover"
            style={{
              left: `${NODE_UI[popoverNode.id].popover[0]}px`,
              top: `${NODE_UI[popoverNode.id].popover[1]}px`,
            }}
            role="dialog"
            aria-label={`${popoverNode.name} 详情`}
          >
            <NodeCard
              node={popoverNode}
              nodes={liveNodes}
              edges={edges}
              busy={busy}
              onPoke={handlePoke}
              onComplete={handleComplete}
              onClose={() => setPopoverId(null)}
            />
          </div>
        )}

        {/* ---------- 顶部指标：数值变了才覆盖 ---------- */}
        {doneToday !== 3 && (
          <div className="pk-cover pk-cover--stat" style={px(STAT_BOX.doneToday)}>
            {doneToday}<small>项</small>
          </div>
        )}

        {lightsOff && <div className="pk-lightsoff" aria-hidden="true" />}

        {toast && <div className="pk-toast" role="status">{toast}</div>}
      </section>
    </div>
  );
}
