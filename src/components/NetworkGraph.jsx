import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { clockOff, completeNode, fetchRequirements, pokeTask } from '../api/gameApi.js';
import referenceDashboard from '../assets/poke-reference-dashboard.png';
import cleanPlate from '../assets/poke-map-clean.png';
import '../styles/dashboard.css';
import NodeCard from './NodeCard.jsx';

const STAGE_W = 1536;
const STAGE_H = 1024;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

/** 定稿图中各元素的实测位置（1536×1024 画布坐标）。 */
const NODE_UI = {
  n_req: {
    no: '01', pill: [605, 252, 125, 53], badge: null,
    check: [718, 266], hit: [560, 200, 190, 112], popover: [612, 318],
  },
  n_brand: {
    no: '02', pill: [296, 443, 137, 57], badge: [317, 505, 82, 22],
    check: [429, 447], hit: [286, 396, 168, 142], popover: [300, 546],
  },
  n_design: {
    no: '03', pill: [648, 524, 152, 56], badge: null,
    check: [796, 528], hit: [638, 470, 178, 116], popover: [652, 592],
  },
  n_copy: {
    no: '04', pill: [1052, 371, 136, 57], badge: null,
    check: [1172, 383], hit: [1000, 306, 196, 126], popover: [940, 440],
  },
  n_dev: {
    no: '05', pill: [400, 694, 128, 56], badge: [415, 755, 57, 20],
    check: [524, 698], hit: [404, 640, 166, 146], popover: [408, 470],
  },
  n_test: {
    no: '06', pill: [870, 699, 140, 57], badge: [906, 762, 61, 20],
    check: [1006, 703], hit: [858, 646, 172, 146], popover: [700, 430],
  },
};

/** 项目 Leader 一行：头像（看要求）+ 催进度按钮 */
const LEADERS = [
  { id: 'n_design', name: '小陈', avatar: [1111, 115, 70, 70], btn: [1103, 249, 86, 32] },
  { id: 'n_dev', name: '老李', avatar: [1212, 115, 70, 70], btn: [1204, 249, 86, 32] },
  { id: 'n_copy', name: '阿May', avatar: [1313, 115, 70, 70], btn: [1305, 249, 86, 32] },
  { id: 'n_brand', name: '陈总', avatar: [1414, 115, 70, 70], btn: [1406, 249, 86, 32] },
];

const PATH_STEPS = [
  { id: 'n_req', cx: 353 }, { id: 'n_brand', cx: 461 }, { id: 'n_design', cx: 571 },
  { id: 'n_dev', cx: 685 }, { id: 'n_test', cx: 799 },
];

const STAT_BOX = { doneToday: [653, 61, 50, 27] };

/** 原「影响涟漪」面板的位置，改放 Leader 项目要求 */
const REQ_PANEL = [1112, 645, 394, 203];

/** 缩略地图：面板本体、以及整张地图等比映射进去的框 */
const MINIMAP_PANEL = [24, 705, 212, 262];
const MINIMAP_VIEW = [40, 785, 180, 120];

const ZOOM_IN = [250, 765, 37, 40];
const ZOOM_OUT = [250, 806, 37, 40];
const ZOOM_FIT = [250, 847, 37, 40];

const MASCOT = { x: 80, y: 600 };
const CURRENT_USER = '小陈';
const STATUS_LABEL = { done: '已完成', doing: '进行中', todo: '未开始' };
const DRAG_THRESHOLD = 6;

function px([left, top, width, height]) {
  return { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` };
}

function inflate([left, top, width, height], by) {
  return [left - by, top - by, width + by * 2, height + by * 2];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** 越界后阻力递增，而不是硬停（Apple: rubber-banding） */
function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

function nowTime() {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
    .format(new Date());
}

export default function NetworkGraph({ nodes, edges, visibleCount }) {
  const [selectedId, setSelectedId] = useState(null);
  const [popoverId, setPopoverId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [completedIds, setCompletedIds] = useState(() => new Set());
  const [newLogs, setNewLogs] = useState([]);
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
  const [fit, setFit] = useState(1);

  // 视图（缩放 + 平移）；zoom=1 且无位移时不加 transform，静止画面保持逐像素一致
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [settling, setSettling] = useState(false);

  // Leader 下发的要求
  const [reqOwner, setReqOwner] = useState(null);
  const [reqData, setReqData] = useState(null);
  const [reqLoading, setReqLoading] = useState(false);

  const toastTimer = useRef(0);
  const flyerTimer = useRef([]);
  const fitRef = useRef(1);
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const didDragRef = useRef(false);

  const isDefaultView = view.zoom === 1 && view.x === 0 && view.y === 0;

  useLayoutEffect(() => {
    function refit() {
      // 等比覆盖视口：保持 1536:1024 的设计坐标系，并让底图与所有
      // 同层热区/UI 一起填满屏幕。超出视口的部分由 .pk-screen 裁切，
      // 避免因完整显示而留下黑边。
      const next = Math.max(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
      fitRef.current = next;
      setFit(next);
    }
    refit();
    window.addEventListener('resize', refit);
    return () => window.removeEventListener('resize', refit);
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

  /* ---------------- 缩放 / 平移 ---------------- */

  const clampView = useCallback((next) => ({
    zoom: next.zoom,
    x: clamp(next.x, STAGE_W - STAGE_W * next.zoom, 0),
    y: clamp(next.y, STAGE_H - STAGE_H * next.zoom, 0),
  }), []);

  /** 以 (fx,fy) 为焦点缩放，该点在屏幕上保持不动 */
  const zoomAt = useCallback((nextZoom, fx, fy) => {
    setSettling(true);
    setView((current) => {
      const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      if (zoom === MIN_ZOOM) return { zoom: 1, x: 0, y: 0 };
      const worldX = (fx - current.x) / current.zoom;
      const worldY = (fy - current.y) / current.zoom;
      return clampView({ zoom, x: fx - worldX * zoom, y: fy - worldY * zoom });
    });
  }, [clampView]);

  const zoomByStep = useCallback((factor) => {
    zoomAt(view.zoom * factor, STAGE_W / 2, STAGE_H / 2);
  }, [view.zoom, zoomAt]);

  const resetView = useCallback(() => {
    setSettling(true);
    setView({ zoom: 1, x: 0, y: 0 });
  }, []);

  // 滚轮缩放（需要 passive:false 才能 preventDefault）
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;

    function onWheel(event) {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const fx = (event.clientX - rect.left) / fitRef.current;
      const fy = (event.clientY - rect.top) / fitRef.current;
      zoomAt(view.zoom * (event.deltaY < 0 ? 1.18 : 1 / 1.18), fx, fy);
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [view.zoom, zoomAt]);

  function onPointerDown(event) {
    if (view.zoom === 1 || event.button !== 0) return;
    didDragRef.current = false;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y,
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setSettling(false);
  }

  function onPointerMove(event) {
    const drag = dragRef.current;
    if (!drag) return;

    const dx = (event.clientX - drag.startX) / fitRef.current;
    const dy = (event.clientY - drag.startY) / fitRef.current;

    if (!didDragRef.current && Math.hypot(dx, dy) * fitRef.current < DRAG_THRESHOLD) return;
    didDragRef.current = true;

    // 1:1 跟手；越界处加阻力
    const rawX = drag.originX + dx;
    const rawY = drag.originY + dy;
    const minX = STAGE_W - STAGE_W * view.zoom;
    const minY = STAGE_H - STAGE_H * view.zoom;

    let nextX = rawX;
    if (rawX > 0) nextX = rubberband(rawX, STAGE_W);
    else if (rawX < minX) nextX = minX + rubberband(rawX - minX, STAGE_W);

    let nextY = rawY;
    if (rawY > 0) nextY = rubberband(rawY, STAGE_H);
    else if (rawY < minY) nextY = minY + rubberband(rawY - minY, STAGE_H);

    setView((current) => ({ ...current, x: nextX, y: nextY }));
  }

  function endDrag(event) {
    if (!dragRef.current) return;
    try { event.currentTarget.releasePointerCapture(dragRef.current.pointerId); } catch { /* 已释放 */ }
    dragRef.current = null;
    setSettling(true);
    setView((current) => clampView(current));
    window.setTimeout(() => { didDragRef.current = false; }, 0);
  }

  /** 点缩略地图 → 把地图移到对应位置 */
  function onMinimapClick(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratioX = (event.clientX - rect.left) / rect.width;
    const ratioY = (event.clientY - rect.top) / rect.height;

    setSettling(true);
    setView((current) => {
      const zoom = current.zoom === 1 ? 1.8 : current.zoom;
      return clampView({
        zoom,
        x: STAGE_W / 2 - ratioX * STAGE_W * zoom,
        y: STAGE_H / 2 - ratioY * STAGE_H * zoom,
      });
    });
  }

  /* ---------------- 业务 ---------------- */

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

  async function openRequirements(owner) {
    if (didDragRef.current) return;
    if (reqOwner === owner) { setReqOwner(null); setReqData(null); return; }

    setReqOwner(owner);
    setReqData(null);
    setReqLoading(true);
    try {
      setReqData(await fetchRequirements(owner));
    } catch (error) {
      console.error(error);
      showToast('拉取项目要求失败，请确认本地 mock 后端已启动（端口 3001）');
      setReqOwner(null);
    } finally {
      setReqLoading(false);
    }
  }

  async function handlePoke(targetId, from = CURRENT_USER) {
    if (busy || !targetId || didDragRef.current) return;
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

    setFlyer({ x: MASCOT.x, y: MASCOT.y });
    flyerTimer.current.push(window.setTimeout(() => setFlyer({ x: destX, y: destY }), 30));
    flyerTimer.current.push(window.setTimeout(() => { setRipple({ x: destX, y: destY }); setFlyer(null); }, 660));
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

  async function handleComplete(nodeId) {
    const target = findNode(nodeId);
    if (busy || !target || target.status === 'done') return;

    setBusy(true);
    try {
      const result = await completeNode(nodeId);
      setCompletedIds((items) => new Set([...items, nodeId]));
      setDoneToday((value) => value + 1);

      const names = (result.notifications?.map((item) => item.to) ?? []).join('、') || '下游负责人';
      setNotice({ title: '上游已完成，你可以开始了！', from: `来自：${target.owner}（${target.name}已完成）` });
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
    if (noticeMode === 'baked') { setNoticeMode('closed'); return; }
    setNoticeLeaving(true);
    window.setTimeout(() => { setNoticeMode('closed'); setNoticeLeaving(false); }, 220);
  }

  function openNode(id) {
    if (didDragRef.current) return;
    setSelectedId(id);
    setPopoverId((current) => (current === id ? null : id));
  }

  const shown = typeof visibleCount === 'number' ? visibleCount : liveNodes.length;
  const isRevealed = (id) => liveNodes.findIndex((node) => node.id === id) < shown;

  // 缩略地图上的视口指示框
  const [mmX, mmY, mmW, mmH] = MINIMAP_VIEW;
  const viewRect = {
    left: mmX + (-view.x / view.zoom / STAGE_W) * mmW,
    top: mmY + (-view.y / view.zoom / STAGE_H) * mmH,
    width: mmW / view.zoom,
    height: mmH / view.zoom,
  };

  return (
    <div className="pk-screen">
      <section
        ref={stageRef}
        className="pk-stage"
        style={{ transform: `scale(${fit})` }}
        aria-label="戳戳 Poke 协作地图"
      >
        <div
          className={`pk-world${view.zoom > 1 ? ' is-pannable' : ''}${settling ? ' is-settling' : ''}`}
          style={isDefaultView ? undefined : {
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onTransitionEnd={() => setSettling(false)}
        >
          <img className="pk-stage__base" src={referenceDashboard} alt="" draggable="false" />

          <p className="pk-sr" aria-live="polite">
            协作地图已生成，共 {liveNodes.length} 个任务节点。今日完成 {doneToday} 项。
            {popoverNode ? `当前查看：${popoverNode.name}，负责人 ${popoverNode.owner}。` : ''}
          </p>

          {/* ---------- 通知条 ---------- */}
          {noticeMode === 'baked' && (
            <button
              type="button" className="pk-hit pk-hit--round" style={px([831, 140, 32, 32])}
              aria-label="关闭通知：上游已完成，你可以开始了" onClick={closeNotice}
            />
          )}

          {noticeMode === 'dom' && (
            <div className={noticeLeaving ? 'pk-notice is-leaving' : 'pk-notice'} role="status">
              <span className="pk-notice__bell" aria-hidden="true">🔔</span>
              <span className="pk-notice__text">
                <strong>{notice.title}</strong>
                <span>{notice.from}</span>
              </span>
              <button type="button" className="pk-notice__close" aria-label="关闭通知" onClick={closeNotice}>×</button>
            </div>
          )}

          {noticeMode === 'closed' && (
            <div className="pk-notice-patch" style={{ backgroundImage: `url(${cleanPlate})` }} />
          )}

          {/* ---------- 任务节点 ---------- */}
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

                {revealed && selectedId === id && (
                  <div
                    className={`pk-ring ${node.isBottleneck ? 'pk-bottleneck' : node.isDelayed ? 'pk-delayed' : 'pk-ring--plain'}`}
                    style={px(inflate(ui.pill, 5))}
                    aria-hidden="true"
                  />
                )}

                {changed && (
                  <span
                    className="pk-check"
                    style={{ left: `${ui.check[0] - 13}px`, top: `${ui.check[1] - 13}px` }}
                    aria-hidden="true"
                  >✓</span>
                )}

                {changed && ui.badge && (
                  <div className="pk-badge pk-badge--done" style={px(inflate(ui.badge, 2))}>已完成</div>
                )}
              </div>
            );
          })}

          {/* ---------- Leader 行：头像看要求 + 催进度 ---------- */}
          {LEADERS.map((leader) => (
            <button
              key={`avatar-${leader.name}`}
              type="button"
              className={`pk-hit pk-hit--round${reqOwner === leader.name ? ' is-selected' : ''}`}
              style={px(leader.avatar)}
              aria-label={`查看 ${leader.name} 的项目要求`}
              onClick={() => openRequirements(leader.name)}
            />
          ))}

          {LEADERS.map((leader) => (
            <button
              key={`poke-${leader.id}`}
              type="button" className="pk-hit" style={px(leader.btn)}
              aria-label={`催 ${leader.name} 的进度`}
              disabled={busy}
              onClick={() => handlePoke(leader.id)}
            />
          ))}

          {/* ---------- 关键路径 ---------- */}
          {PATH_STEPS.map((step) => {
            const node = findNode(step.id);
            return (
              <button
                key={step.id} type="button" className="pk-hit pk-hit--round"
                style={px([step.cx - 30, 847, 60, 60])}
                aria-label={`关键路径：${node?.name ?? step.id}，点击查看详情`}
                onClick={() => openNode(step.id)}
              />
            );
          })}

          {/* ---------- 缩略地图：点击定位 + 视口指示 ---------- */}
          <button
            type="button" className="pk-hit pk-minimap-hit" style={px(MINIMAP_PANEL)}
            aria-label="缩略地图，点击可把地图移动到对应位置"
            onClick={onMinimapClick}
          />

          {view.zoom > 1 && (
            <div
              className="pk-minimap-view"
              style={{
                left: `${viewRect.left}px`, top: `${viewRect.top}px`,
                width: `${viewRect.width}px`, height: `${viewRect.height}px`,
              }}
              aria-hidden="true"
            />
          )}

          {/* ---------- 缩放控制 ---------- */}
          <button
            type="button" className="pk-hit" style={px(ZOOM_IN)}
            aria-label="放大地图" disabled={view.zoom >= MAX_ZOOM}
            onClick={() => zoomByStep(1.5)}
          />
          <button
            type="button" className="pk-hit" style={px(ZOOM_OUT)}
            aria-label="缩小地图" disabled={view.zoom <= MIN_ZOOM}
            onClick={() => zoomByStep(1 / 1.5)}
          />
          <button
            type="button" className="pk-hit" style={px(ZOOM_FIT)}
            aria-label="重置视图" onClick={resetView}
          />

          {/* ---------- 吉祥物气泡 ---------- */}
          <button
            type="button" className="pk-hit" style={px([155, 562, 132, 80])}
            aria-label="查看瓶颈节点 首页设计稿" onClick={() => openNode('n_design')}
          />

          {/* ---------- Leader 项目要求（原「影响涟漪」位置） ---------- */}
          <section className="pk-req" style={px(REQ_PANEL)} aria-label="Leader 下发的项目要求">
            {!reqOwner && (
              <div className="pk-req__empty">
                <strong>项目要求</strong>
                <p>点击上方任一头像，查看 Leader 下发给他的要求。</p>
              </div>
            )}

            {reqOwner && (
              <>
                <header className="pk-req__head">
                  <h3>{reqOwner} 的项目要求</h3>
                  <span className="pk-req__from">
                    {reqData ? `来自 ${reqData.from} · ${reqData.role}` : '　'}
                  </span>
                  <button
                    type="button" className="pk-req__close" aria-label="关闭项目要求"
                    onClick={() => { setReqOwner(null); setReqData(null); }}
                  >×</button>
                </header>

                {reqLoading && (
                  <div className="pk-req__loading">
                    <span className="pk-loading__orbit" aria-hidden="true" />
                    <span>AI 正在把要求拆成分点分条…</span>
                  </div>
                )}

                {reqData && (
                  <ol className="pk-req__list">
                    {reqData.items.map((item, index) => (
                      <li key={item.id} style={{ animationDelay: `${index * 55}ms` }}>
                        <span className={`pk-req__pri pk-req__pri--${item.priority}`}>{item.priority}</span>
                        <span className="pk-req__body">{item.detail}</span>
                        {item.due && <span className="pk-req__due">{item.due}</span>}
                      </li>
                    ))}
                  </ol>
                )}

                {reqData && reqOwner === CURRENT_USER && (
                  <footer className="pk-req__foot">
                    <button
                      type="button" className="pk-btn pk-btn--ghost"
                      disabled={busy || lightsOff}
                      onClick={handleClockOff}
                    >
                      {lightsOff ? '已收工关灯' : '我收工了 · 开启下班边界'}
                    </button>
                  </footer>
                )}
              </>
            )}
          </section>

          {/* ---------- 新的公开戳一戳记录 ---------- */}
          {newLogs[0] && (
            <div className="pk-newlog" key={newLogs[0].id}>
              <span className="pk-newlog__pin">刚刚</span>
              <span className="pk-newlog__who">{newLogs[0].from} → {newLogs[0].to}</span>
              <span className="pk-newlog__msg">{newLogs[0].message}</span>
              <span className="pk-newlog__time">{newLogs[0].time}</span>
            </div>
          )}

          {/* ---------- 灯仔飞行 ---------- */}
          {flyer && (
            <div
              className="pk-flyer"
              style={{ transform: `translate(${flyer.x - 23}px, ${flyer.y - 23}px)` }}
              aria-hidden="true"
            >👉</div>
          )}

          {ripple && (
            <div className="pk-ripple" style={px([ripple.x - 55, ripple.y - 55, 110, 110])} aria-hidden="true" />
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
                node={popoverNode} nodes={liveNodes} edges={edges} busy={busy}
                onPoke={handlePoke} onComplete={handleComplete}
                onClose={() => setPopoverId(null)}
              />
            </div>
          )}

          {/* ---------- 顶部指标 ---------- */}
          {doneToday !== 3 && (
            <div className="pk-cover pk-cover--stat" style={px(STAT_BOX.doneToday)}>
              {doneToday}<small>项</small>
            </div>
          )}

          {lightsOff && <div className="pk-lightsoff" aria-hidden="true" />}
        </div>

        {/* 放大后底图上那组缩放键会跟着移出视野，
            这里补一组固定在舞台上的控制条，保证任何缩放级别都能缩回去。
            只在 zoom>1 时出现，所以静止画面不受影响。 */}
        {view.zoom > 1 && (
          <div className="pk-viewctl" role="group" aria-label="地图视图控制">
            <button type="button" aria-label="缩小地图" onClick={() => zoomByStep(1 / 1.5)}>−</button>
            <span aria-hidden="true">{Math.round(view.zoom * 100)}%</span>
            <button
              type="button" aria-label="放大地图"
              disabled={view.zoom >= MAX_ZOOM}
              onClick={() => zoomByStep(1.5)}
            >+</button>
            <button type="button" className="pk-viewctl__reset" onClick={resetView}>重置视图</button>
          </div>
        )}

        {toast && <div className="pk-toast" role="status">{toast}</div>}
      </section>
    </div>
  );
}
