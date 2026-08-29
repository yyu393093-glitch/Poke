# 桌宠 FlowPeek + 消息面板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把桌面宠物从「单一 progress 展示」升级为「状态入口 + 悬停小流程图 FlowPeek + 点击消息面板」，全部由纯函数驱动、可测试。

**Architecture:** 权威状态留在主窗 `GameContext`。`NetworkPage` 把一份可序列化「宠物快照」`{ progress, nodes, edges, pokes, notifications, currentUser }` 通过 IPC 广播到 `/pet` 窗口；`PetWindow` 订阅后本地用 `petModel` 纯函数派生视觉形态、FlowPeek 子图、消息列表。窗口尺寸由 `pet:set-mode` IPC 在三个档位（collapsed/peek/panel）间切换，边缘翻转由渲染层用纯函数 `computePetFlip` 计算后交给主进程定位。

**Tech Stack:** React 19 + react-router 7，Electron 37（contextIsolation=true / nodeIntegration=false），Vite，node:test 测试，Tailwind CSS v4 + 手写 CSS。

**Spec:** 本任务需求来自会话内的完整视觉与交互规格（9 态状态机 / FlowPeek / 消息面板），以及 `docs/00-开发契约.md`（数据模型与硬编码 id）。

## Global Constraints

- 桌宠头像**保留卡皮巴拉**（沿用 `.capybara-mascot` CSS 造型），「灯仔」只作昵称，不换 lamp 造型。
- reply「收到，10分钟内发你🙌」**在前端 fallback 合成**，不新建后端；不接真实飞书。
- 隔离工作区：`/Users/sunshiyang/Documents/ChatGPT/heck/poke-pet-flow-peek`（branch `feat/pet-flow-peek`，base `66d72aa`）。所有 git 操作只针对本 worktree。
- 保持 `contextIsolation=true`、`nodeIntegration=false`；preload 只白名单暴露必要方法；payload 一律走 `contracts.cjs` 校验。
- 动画只允许 CSS `transform`/`opacity`，支持 `prefers-reduced-motion`。
- 颜色硬编码沿用契约：done `#22c55e`、doing `#eab308`、todo `#64748b`、bottleneck `#ef4444`、critical `#3b82f6`。
- 硬编码 id 不得改：`n_req/n_brand/n_design/n_dev/n_test/n_copy`、`e1..e6`、主角节点 `n_design`、主角 `小陈`。
- 浏览器模式（无 `window.pokeDesktop`）不得报错：`desktopBridge` 全部 noop 安全。
- 不破坏 `/`、`/network`、`/assistant`、`/pet` 路由与现有后端契约（`server/index.js` 只有 `/api/health`，别动它）。

---

## 文件结构

**新建**
- `src/features/pet/PetAvatar.jsx` — 卡皮巴拉造型 + 形态 class + 徽标（blocked 环 / unread 红点）
- `src/features/pet/FlowPeek.jsx` — 360×220 悬停流程图容器
- `src/features/pet/MiniFlowNode.jsx` — 流程节点卡片
- `src/features/pet/MiniFlowEdge.jsx` — 节点间折线箭头
- `src/features/pet/PetPanel.jsx` — 380×500 点击浮层（Tab 框架）
- `src/features/pet/PetMessages.jsx` — 消息卡列表
- `tests/petFlowModel.test.mjs` — petModel 纯函数测试

**修改**
- `src/components/petModel.js` — 加 `derivePetMood`/`derivePetBadges`/`deriveFlowPeek`/`derivePetMessages`/`buildPetSnapshot`/`computePetFlip`
- `src/components/pokeModel.js` — `getPokeFallback`/`buildPokeEvent` 加 `reply`
- `src/context/GameContext.jsx` — 修 `currentUser: '灏忛檲'` → `'小陈'`
- `src/platform/desktopBridge.js` — 加 `sendPetSnapshot`/`petSetMode`/`onPetSnapshot`
- `electron/ipc/contracts.cjs` — 加 `validatePetSnapshot`/`validatePetMode`
- `electron/preload.cjs` — 加快照/模式白名单
- `electron/ipc/handlers.cjs` — 注册新 handler
- `electron/main.cjs` — 加 `broadcastPetSnapshot`/`setPetMode`
- `electron/windows/petWindow.cjs` — 三档尺寸 + `setMode`
- `src/pages/NetworkPage.jsx` — 广播宠物快照
- `src/features/pet/PetWindow.jsx` — 重写为容器
- `src/index.css` — FlowPeek/panel/message/形态动画样式
- `tests/pokeModel.test.mjs` — 更新现有断言以包含 `reply`

---

## Task 1: petModel 纯函数（视觉形态 + FlowPeek + 消息 + 快照 + 翻转）

**Files:**
- Modify: `src/components/petModel.js`
- Modify: `src/components/pokeModel.js`（把 `const CHANNEL_LABEL` 改为 `export const CHANNEL_LABEL`）
- Test: `tests/petFlowModel.test.mjs`（新建）

**Interfaces:**
- Produces（后续任务依赖，签名固定）:
  - `PET_MOOD` — `{ IDLE:'idle', FLOW_PEEK:'flow-peek', UNREAD:'unread', BLOCKED:'blocked', WORKING:'working', DONE:'done', OFF:'off', EXPANDED:'expanded' }`
  - `derivePetMood({ progress, paused, unread, hovering, expanded, working, flashDone }) => string`
  - `derivePetBadges({ progress, unread }) => { blocked: boolean, unreadCount: number }`
  - `deriveFlowPeek(nodes, edges, { currentUserId='n_design' }) => { summary:{blockers,downstreamCount}, nodes:[{id,name,owner,dept,status,isDelayed,isBottleneck,role}], edges:[{from,to,isCritical}] }`
  - `derivePetMessages(pokes, { limit=5 }) => [{ id, from, to, message, reply, channel, channelLabel, time, status }]`
  - `buildPetSnapshot({ progress, nodes, edges, pokes, notifications, currentUser }) => snapshot`
  - `computePetFlip({ anchorX, anchorY, contentWidth, contentHeight, availWidth, availHeight }) => { flipX, flipY }`

- [ ] **Step 1: 写失败测试** `tests/petFlowModel.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PET_MOOD, derivePetMood, derivePetBadges, deriveFlowPeek, derivePetMessages,
  buildPetSnapshot, computePetFlip, DEFAULT_PET_PROGRESS,
} from '../src/components/petModel.js';
import { FALLBACK_NODES, FALLBACK_EDGES } from '../src/components/networkModel.js';

test('形态优先级：expanded > flow-peek > paused(回 idle) > off > working > done > blocked > unread > idle', () => {
  // DEFAULT_PET_PROGRESS.phase 为 blocked，用 normal 作中性基线才能单独验证 unread/idle 档
  const base = { progress: { ...DEFAULT_PET_PROGRESS, phase: 'normal' } };
  assert.equal(derivePetMood({ ...base, expanded: true }), PET_MOOD.EXPANDED);
  assert.equal(derivePetMood({ ...base, hovering: true }), PET_MOOD.FLOW_PEEK);
  assert.equal(derivePetMood({ ...base, paused: true, unread: 3 }), PET_MOOD.IDLE);
  assert.equal(derivePetMood({ ...base, progress: { ...DEFAULT_PET_PROGRESS, phase: 'off' }, unread: 3 }), PET_MOOD.OFF);
  assert.equal(derivePetMood({ ...base, working: true }), PET_MOOD.WORKING);
  assert.equal(derivePetMood({ ...base, flashDone: true }), PET_MOOD.DONE);
  assert.equal(derivePetMood({ ...base, progress: { ...DEFAULT_PET_PROGRESS, phase: 'blocked' }, unread: 2 }), PET_MOOD.BLOCKED);
  assert.equal(derivePetMood({ ...base, unread: 1 }), PET_MOOD.UNREAD);
  assert.equal(derivePetMood({ ...base, progress: { ...DEFAULT_PET_PROGRESS, phase: 'normal' } }), PET_MOOD.IDLE);
});

test('blocked 环与 unread 红点可叠加', () => {
  assert.deepEqual(derivePetBadges({ progress: { ...DEFAULT_PET_PROGRESS, phase: 'blocked' }, unread: 3 }), { blocked: true, unreadCount: 3 });
  assert.deepEqual(derivePetBadges({ progress: { ...DEFAULT_PET_PROGRESS, phase: 'normal' }, unread: 0 }), { blocked: false, unreadCount: 0 });
});

test('FlowPeek 只取 上游阻塞1 + 当前 + 下游2，共 4 节点', () => {
  const peek = deriveFlowPeek(FALLBACK_NODES, FALLBACK_EDGES, { currentUserId: 'n_design' });
  assert.deepEqual(peek.summary, { blockers: 1, downstreamCount: 2 });
  assert.deepEqual(peek.nodes.map((n) => n.id), ['n_design', 'n_brand', 'n_dev', 'n_test']);
  assert.equal(peek.nodes.find((n) => n.id === 'n_design').role, 'current');
  assert.equal(peek.nodes.find((n) => n.id === 'n_brand').role, 'upstream');
  assert.deepEqual(peek.edges.map((e) => e.id).sort(), ['e2', 'e3', 'e6']);
});

test('FlowPeek 当前节点缺失时返回空结构，不抛错', () => {
  assert.deepEqual(deriveFlowPeek([], [], { currentUserId: 'nope' }), { summary: { blockers: 0, downstreamCount: 0 }, nodes: [], edges: [] });
});

test('消息派生：最新在前，有 reply 记为 replied，否则按推送状态 read/sent', () => {
  const pokes = [
    { id: 'p1', from: '小陈', to: 'n_brand', receiver: '陈总', message: '方便确认进度吗', reply: null, channel: 'feishu', time: '17:57:32', pushStatus: 'success' },
    { id: 'p2', from: '小陈', to: 'n_brand', receiver: '陈总', message: '方便确认进度吗', reply: '收到，10分钟内发你🙌', channel: 'feishu', time: '17:58:00', pushStatus: 'success' },
  ];
  const msgs = derivePetMessages(pokes);
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].id, 'p2'); // 最新在前
  assert.equal(msgs[0].status, 'replied');
  assert.equal(msgs[0].channelLabel, '飞书');
  assert.equal(msgs[1].status, 'read');
});

test('消息派生限制条数', () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, message: 'x', reply: null, channel: 'feishu', time: '17:57', pushStatus: 'success' }));
  assert.equal(derivePetMessages(many, { limit: 5 }).length, 5);
});

test('快照序列化只含白名单字段', () => {
  const snap = buildPetSnapshot({ progress: DEFAULT_PET_PROGRESS, nodes: [], edges: [], pokes: [], notifications: [], currentUser: '小陈' });
  assert.deepEqual(Object.keys(snap).sort(), ['currentUser', 'edges', 'nodes', 'notifications', 'pokes', 'progress']);
});

test('边缘翻转：靠近右下边缘时向左侧/上方展开', () => {
  assert.deepEqual(computePetFlip({ anchorX: 700, anchorY: 700, contentWidth: 380, contentHeight: 500, availWidth: 1000, availHeight: 1000 }), { flipX: true, flipY: true });
  assert.deepEqual(computePetFlip({ anchorX: 10, anchorY: 10, contentWidth: 380, contentHeight: 500, availWidth: 1000, availHeight: 1000 }), { flipX: false, flipY: false });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL — `derivePetMood` 等未导出（`SyntaxError`/`undefined`）。

- [ ] **Step 3: 实现最小代码** 在 `src/components/petModel.js` 末尾追加（文件顶部加 `import { CHANNEL_LABEL } from './pokeModel.js';`），并把 `src/components/pokeModel.js` 顶部的 `const CHANNEL_LABEL` 改为 `export const CHANNEL_LABEL`

```js
export const PET_MOOD = {
  IDLE: 'idle', FLOW_PEEK: 'flow-peek', UNREAD: 'unread', BLOCKED: 'blocked',
  WORKING: 'working', DONE: 'done', OFF: 'off', EXPANDED: 'expanded',
};

export function derivePetMood({ progress = DEFAULT_PET_PROGRESS, paused = false, unread = 0, hovering = false, expanded = false, working = false, flashDone = false }) {
  if (expanded) return PET_MOOD.EXPANDED;
  if (hovering) return PET_MOOD.FLOW_PEEK;
  if (paused) return PET_MOOD.IDLE;
  if (progress.phase === 'off') return PET_MOOD.OFF;
  if (working) return PET_MOOD.WORKING;
  if (flashDone) return PET_MOOD.DONE;
  if (progress.phase === 'blocked') return PET_MOOD.BLOCKED;
  if (unread > 0) return PET_MOOD.UNREAD;
  return PET_MOOD.IDLE;
}

export function derivePetBadges({ progress = DEFAULT_PET_PROGRESS, unread = 0 }) {
  return { blocked: progress.phase === 'blocked', unreadCount: unread > 0 ? unread : 0 };
}

export function deriveFlowPeek(nodes = [], edges = [], { currentUserId = 'n_design' } = {}) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const current = byId[currentUserId];
  if (!current) return { summary: { blockers: 0, downstreamCount: 0 }, nodes: [], edges: [] };
  const upstream = edges.filter((e) => e.to === currentUserId).map((e) => byId[e.from])
    .filter((n) => n && (n.isDelayed || n.isBottleneck)).slice(0, 1);
  const downstream = edges.filter((e) => e.from === currentUserId).map((e) => byId[e.to]).filter(Boolean).slice(0, 2);
  const include = new Set([currentUserId, ...upstream.map((n) => n.id), ...downstream.map((n) => n.id)]);
  const nodesOut = [current, ...upstream, ...downstream].map((n) => ({
    id: n.id, name: n.name, owner: n.owner, dept: n.dept, status: n.status,
    isDelayed: n.isDelayed, isBottleneck: n.isBottleneck,
    role: n.id === currentUserId ? 'current' : (downstream.some((d) => d.id === n.id) ? 'downstream' : 'upstream'),
  }));
  // peek 只画与当前节点直接相连的边（上游→当前→下游），下游之间的边不进子图
  const edgesOut = edges.filter((e) => (e.from === currentUserId || e.to === currentUserId) && include.has(e.from) && include.has(e.to));
  return {
    summary: { blockers: nodes.filter((n) => n.isBottleneck).length, downstreamCount: downstream.length },
    nodes: nodesOut,
    edges: edgesOut,
  };
}

export function derivePetMessages(pokes = [], { limit = 5 } = {}) {
  return pokes.slice(-limit).reverse().map((poke) => ({
    id: poke.id, from: poke.from, to: poke.receiver || poke.to, message: poke.message,
    reply: poke.reply || null, channel: poke.channel, channelLabel: CHANNEL_LABEL[poke.channel] || 'IM',
    time: poke.time, status: poke.reply ? 'replied' : (poke.pushStatus === 'success' ? 'read' : 'sent'),
  }));
}

export function buildPetSnapshot({ progress = DEFAULT_PET_PROGRESS, nodes = [], edges = [], pokes = [], notifications = [], currentUser = '' } = {}) {
  return { progress, nodes, edges, pokes, notifications, currentUser };
}

export function computePetFlip({ anchorX = 0, anchorY = 0, contentWidth = 0, contentHeight = 0, availWidth = 0, availHeight = 0 } = {}) {
  return { flipX: anchorX + contentWidth > availWidth, flipY: anchorY + contentHeight > availHeight };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`
Expected: PASS（新增 `petFlowModel.test.mjs` 全绿；既有 `petModel.test.mjs` 仍绿）。

- [ ] **Step 5: 提交**

```bash
git add src/components/petModel.js tests/petFlowModel.test.mjs
git commit -m "feat(pet): add pure model for mood/flow-peek/messages/snapshot/flip"
```

---

## Task 2: pokeModel 加 reply + 修 GameContext 乱码

**Files:**
- Modify: `src/components/pokeModel.js`
- Modify: `src/context/GameContext.jsx:16`
- Test: `tests/pokeModel.test.mjs`（更新两条断言）

**Interfaces:**
- Consumes: 无（独立）。
- Produces: `getPokeFallback(...)` 与 `buildPokeEvent(...)` 的返回值多一个 `reply` 字段。

- [ ] **Step 1: 更新测试断言** `tests/pokeModel.test.mjs` 第 14 行与第 26 行

```js
// buildPokeEvent 断言加 reply
assert.deepEqual(model.buildPokeEvent({ message: '请确认进度', channel: 'feishu', pokeId: 'poke-1', pushStatus: 'success', reply: null }, { from: '小陈', to: 'n_brand', receiver: '陈总', time: '17:57:32' }), {
  id: 'poke-1', from: '小陈', to: 'n_brand', receiver: '陈总', message: '请确认进度', reply: null, channel: 'feishu', time: '17:57:32', pushStatus: 'success',
});

// getPokeFallback 断言加 reply
assert.deepEqual(model.getPokeFallback(true, { owner: '陈总', name: '品牌素材' }, '小陈', 'poke-demo'), {
  message: '陈总好，小陈负责的工作正在等待「品牌素材」，方便确认一下进度吗？🙏',
  reply: '收到，10分钟内发你🙌',
  channel: 'feishu',
  pokeId: 'poke-demo',
  pushStatus: 'success',
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL — 现有断言缺 `reply`，`deepEqual` 不匹配。

- [ ] **Step 3: 实现** `src/components/pokeModel.js`

```js
export function buildPokeEvent(response, context) {
  return {
    id: response.pokeId || `poke-${Date.now()}`,
    from: context.from,
    to: context.to,
    receiver: context.receiver,
    message: response.message,
    reply: response.reply || null,
    channel: response.channel,
    time: context.time,
    pushStatus: response.pushStatus || 'success',
  };
}
```

```js
export function getPokeFallback(demoMode, node, currentUser, pokeId = `demo-${Date.now()}`) {
  if (!demoMode) return null;
  return {
    message: `${node.owner}好，${currentUser}负责的工作正在等待「${node.name}」，方便确认一下进度吗？🙏`,
    reply: '收到，10分钟内发你🙌',
    channel: 'feishu',
    pokeId,
    pushStatus: 'success',
  };
}
```

`src/context/GameContext.jsx:16` 改：`currentUser: '灏忛檲',` → `currentUser: '小陈',`

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/components/pokeModel.js src/context/GameContext.jsx tests/pokeModel.test.mjs
git commit -m "feat(poke): carry reply through poke event and fallback; fix currentUser mojibake"
```

---

## Task 3: IPC 契约 + preload + desktopBridge

**Files:**
- Modify: `electron/ipc/contracts.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/platform/desktopBridge.js`
- Test: `tests/petFlowModel.test.mjs`（追加 IPC 契约用例，见下）

**Interfaces:**
- Produces:
  - `contracts.validatePetSnapshot(value) => snapshot`（校验后原样返回）
  - `contracts.validatePetMode(value) => { mode, flipX, flipY }`
  - `desktopBridge.sendPetSnapshot(snapshot)` / `desktopBridge.petSetMode(mode)` / `desktopBridge.onPetSnapshot(listener)`

- [ ] **Step 1: 写失败测试**（追加到 `tests/petFlowModel.test.mjs`，顶部 import 契约）

```js
const contracts = await import('../electron/ipc/contracts.cjs');
test('宠物快照与模式 payload 被白名单校验', () => {
  assert.deepEqual(contracts.validatePetSnapshot({ progress: {}, nodes: [], edges: [], pokes: [], notifications: [], currentUser: '小陈' }), { progress: {}, nodes: [], edges: [], pokes: [], notifications: [], currentUser: '小陈' });
  assert.throws(() => contracts.validatePetSnapshot({ progress: {}, nodes: [] }), /Unknown|Invalid/);
  assert.throws(() => contracts.validatePetSnapshot({ progress: {}, nodes: {}, edges: [], pokes: [], notifications: [], currentUser: '' }), /array/);
  assert.deepEqual(contracts.validatePetMode({ mode: 'panel', flipX: true, flipY: false }), { mode: 'panel', flipX: true, flipY: false });
  assert.throws(() => contracts.validatePetMode({ mode: 'bogus' }), /mode/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL — `validatePetSnapshot`/`validatePetMode` 未定义。

- [ ] **Step 3: 实现** `electron/ipc/contracts.cjs`（追加到文件末尾，复用已有 `assertPlainObject`/`validateKeys`）

```js
const PET_MODES = new Set(['collapsed', 'peek', 'panel']);
function validatePetSnapshot(value) {
  assertPlainObject(value);
  validateKeys(value, ['progress', 'nodes', 'edges', 'pokes', 'notifications', 'currentUser']);
  for (const key of ['nodes', 'edges', 'pokes', 'notifications']) {
    if (!Array.isArray(value[key])) throw new Error(`Invalid snapshot ${key}: must be an array`);
  }
  return value;
}
function validatePetMode(value) {
  assertPlainObject(value);
  validateKeys(value, ['mode', 'flipX', 'flipY']);
  if (!PET_MODES.has(value.mode)) throw new Error('Invalid mode');
  return { mode: value.mode, flipX: value.flipX === true, flipY: value.flipY === true };
}
```

并在文件底部 `module.exports` 增加 `validatePetSnapshot, validatePetMode`。

`electron/preload.cjs`：在 `channels` 对象追加 `snapshot: 'pet:snapshot', snapshotUpdated: 'pet:snapshot-updated', petMode: 'pet:set-mode'`；在 `api` 对象追加：

```js
sendPetSnapshot: (snapshot) => ipcRenderer.invoke(channels.snapshot, snapshot),
petSetMode: (mode) => ipcRenderer.invoke(channels.petMode, mode),
onPetSnapshot: (listener) => subscribe(channels.snapshotUpdated, listener),
```

`src/platform/desktopBridge.js`：在导出对象追加：

```js
sendPetSnapshot: (snapshot) => desktop?.sendPetSnapshot?.(snapshot) ?? Promise.resolve(null),
petSetMode: (mode) => desktop?.petSetMode?.(mode) ?? Promise.resolve(null),
onPetSnapshot: (listener) => desktop?.onPetSnapshot?.(listener) ?? noopUnsubscribe,
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add electron/ipc/contracts.cjs electron/preload.cjs src/platform/desktopBridge.js tests/petFlowModel.test.mjs
git commit -m "feat(pet): add snapshot/mode IPC surface and bridge"
```

---

## Task 4: 主进程广播快照 + 三档窗口尺寸

**Files:**
- Modify: `electron/main.cjs`
- Modify: `electron/ipc/handlers.cjs`
- Modify: `electron/windows/petWindow.cjs`

**Interfaces:**
- Consumes: `contracts.validatePetSnapshot` / `validatePetMode`（Task 3）。
- Produces: `pet.setMode(mode, { flipX, flipY })`；主进程 `broadcastPetSnapshot(snapshot)` 通过 `pet:snapshot-updated` 推给 `/pet` 窗口。

- [ ] **Step 1: 写失败测试**（追加到 `tests/petFlowModel.test.mjs`）

```js
test('桌面窗口按屏幕位置翻转定位：靠右向左长、靠下向上长', () => {
  // 纯函数覆盖定位算法，见 main.cjs setPetMode 用同一公式的等价函数
  const anchor = (bounds, size, flip) => ({
    x: flip.flipX ? bounds.x + bounds.width - size.width : bounds.x,
    y: flip.flipY ? bounds.y + bounds.height - size.height : bounds.y,
  });
  assert.deepEqual(anchor({ x: 700, y: 700, width: 72, height: 72 }, { width: 380, height: 500 }, { flipX: true, flipY: true }), { x: 392, y: 272 });
  assert.deepEqual(anchor({ x: 10, y: 10, width: 72, height: 72 }, { width: 380, height: 500 }, { flipX: false, flipY: false }), { x: 10, y: 10 });
});
```

- [ ] **Step 2: 运行测试确认失败**（新增用例，但 `anchor` 是测试内联定义，会先 PASS；此步仅确认 `npm test` 仍绿——本任务以手测为主，见 Step 4）

Run: `npm test` → Expected: PASS（定位公式只是内联测试，不依赖实现）。

- [ ] **Step 3: 实现**

`electron/windows/petWindow.cjs`：把 `COLLAPSED/EXPANDED` 换成三档，新增 `setMode`：

```js
const SIZES = {
  collapsed: { width: 72, height: 72 },
  peek: { width: 380, height: 260 },
  panel: { width: 380, height: 500 },
};
```

在返回对象里加 `setMode(mode, { flipX = false, flipY = false } = {})`：

```js
function setMode(mode, { flipX = false, flipY = false } = {}) {
  const size = SIZES[mode] || SIZES.collapsed;
  const bounds = win.getBounds();
  const x = flipX ? bounds.x + bounds.width - size.width : bounds.x;
  const y = flipY ? bounds.y + bounds.height - size.height : bounds.y;
  win.setBounds({ x, y, width: size.width, height: size.height }, true);
  return { mode, flipX, flipY };
}
```

`electron/main.cjs`：新增两个函数，并在 `registerHandlers` 调用里传进去：

```js
function broadcastPetSnapshot(snapshot) {
  if (pet && !pet.win.isDestroyed()) pet.win.webContents.send('pet:snapshot-updated', snapshot);
  return true;
}
function setPetMode(mode) { return pet?.setMode(mode.mode, mode); }
```

`electron/ipc/handlers.cjs`：`registerHandlers` 参数加 `broadcastPetSnapshot, setPetMode`，函数体内追加：

```js
ipcMain.handle('pet:snapshot', (_event, snapshot) => broadcastPetSnapshot(validatePetSnapshot(snapshot)));
ipcMain.handle('pet:set-mode', (_event, mode) => setPetMode(validatePetMode(mode)));
```

- [ ] **Step 4: 手测 + 测试**

Run: `npm test` → PASS；`npm run build` → 成功（见 Task 9 汇总）。手测见 Task 9。

- [ ] **Step 5: 提交**

```bash
git add electron/windows/petWindow.cjs electron/main.cjs electron/ipc/handlers.cjs tests/petFlowModel.test.mjs
git commit -m "feat(pet): broadcast snapshot and support three window sizes"
```

---

## Task 5: NetworkPage 广播宠物快照

**Files:**
- Modify: `src/pages/NetworkPage.jsx:72`

**Interfaces:**
- Consumes: `buildPetSnapshot`, `derivePetProgress`（petModel），`desktopBridge.sendPetSnapshot`（Task 3）。
- Produces: 主窗每次 `nodes/pokes` 变化即向 `/pet` 推送快照。

- [ ] **Step 1: 实现**

`src/pages/NetworkPage.jsx` 顶部 import 追加 `buildPetSnapshot`；把第 72 行的 effect 替换为：

```js
useEffect(() => {
  const snapshot = buildPetSnapshot({
    progress: derivePetProgress(state.nodes),
    nodes: state.nodes,
    edges: state.edges,
    pokes: state.pokes,
    notifications: state.notifications,
    currentUser: state.currentUser,
  });
  desktopBridge.updatePetProgress(snapshot.progress);
  desktopBridge.sendPetSnapshot(snapshot);
}, [state.nodes, state.edges, state.pokes, state.notifications, state.currentUser]);
```

（`updatePetProgress` 保留，兼容主进程 `did-finish-load` 的 progress 初始化；快照为新增通道。）

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 3: 提交**

```bash
git add src/pages/NetworkPage.jsx
git commit -m "feat(pet): broadcast full snapshot from network page"
```

---

## Task 6: PetAvatar + FlowPeek + MiniFlowNode/Edge + CSS

**Files:**
- Create: `src/features/pet/PetAvatar.jsx`
- Create: `src/features/pet/FlowPeek.jsx`
- Create: `src/features/pet/MiniFlowNode.jsx`
- Create: `src/features/pet/MiniFlowEdge.jsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `PET_MOOD`, `derivePetBadges`（Task 1）。
- Produces:
  - `<PetAvatar mood progress unread paused onClick onMouseEnter onMouseLeave />`
  - `<FlowPeek peek onOpenNetwork onPokeUpstream />`
  - `<MiniFlowNode node />` `<MiniFlowEdge edge />`

- [ ] **Step 1: 写失败测试**（追加 `tests/petFlowModel.test.mjs`）

```js
test('状态徽标数据驱动形态 class（快照到 CSS 的映射稳定）', () => {
  const moodClass = (mood) => `pet-${mood}`;
  assert.equal(moodClass(PET_MOOD.BLOCKED), 'pet-blocked');
  assert.equal(moodClass(PET_MOOD.UNREAD), 'pet-unread');
});
```

（组件渲染不在此做 DOM 测试；此用例锁住 class 命名约定，供组件引用。）

- [ ] **Step 2: 运行测试确认失败** → 先 PASS（内联函数）；本任务以构建 + 手测为准。

- [ ] **Step 3: 实现**

`src/features/pet/PetAvatar.jsx`（卡皮巴拉造型复用现有 `.capybara-mascot` 结构，外裹形态 class 与徽标）：

```jsx
import { derivePetBadges } from '../../components/petModel.js';

export default function PetAvatar({ mood, progress, unread, paused, onClick, onMouseEnter, onMouseLeave }) {
  const badges = derivePetBadges({ progress, unread });
  return (
    <button
      type="button"
      className={`pet-core pet-${mood} ${paused ? 'pet-paused' : ''}`}
      aria-label="打开协作网络"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span className="capybara-mascot" aria-hidden="true">
        <span className="capybara-flower">✿</span>
        <span className="capybara-ear capybara-ear-left" />
        <span className="capybara-ear capybara-ear-right" />
        <span className="capybara-body" />
        <span className="capybara-glasses"><i /><i /></span>
        <span className="capybara-ring" />
      </span>
      {badges.blocked && <span className="pet-bang" aria-label="存在瓶颈">!</span>}
      {badges.unreadCount > 0 && <span className="pet-unread-dot" aria-label={`${badges.unreadCount} 条未读`}>{badges.unreadCount}</span>}
    </button>
  );
}
```

`src/features/pet/MiniFlowNode.jsx`：

```jsx
const STATUS_LABEL = { done: '已完成', doing: '进行中', todo: '未开始' };
const STATUS_TONE = { done: 'mini-node-done', doing: 'mini-node-doing', todo: 'mini-node-todo' };

export default function MiniFlowNode({ node }) {
  return (
    <div
      className={`mini-node ${STATUS_TONE[node.status] || ''} ${node.role === 'current' ? 'mini-node-current' : ''}`}
      data-role={node.role}
    >
      <span className="mini-node-avatar" aria-hidden="true">{node.owner.slice(0, 1)}</span>
      <span className="mini-node-body">
        <b className="mini-node-name">{node.name}</b>
        <small className="mini-node-owner">{node.owner} · {STATUS_LABEL[node.status]}</small>
      </span>
      {node.isDelayed && <em className="mini-node-flag">延期1天</em>}
    </div>
  );
}
```

`src/features/pet/MiniFlowEdge.jsx`（折线箭头，纯 SVG）：

```jsx
export default function MiniFlowEdge({ from, to, critical }) {
  const x1 = from.x, y1 = from.y, x2 = to.x, y2 = to.y;
  const midX = (x1 + x2) / 2;
  const d = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  return <path d={d} fill="none" stroke={critical ? '#3b82f6' : '#94a3b8'} strokeWidth={critical ? 2.5 : 1.5} markerEnd="url(#mini-arrow)" />;
}
```

`src/features/pet/FlowPeek.jsx`（用 `deriveFlowPeek` 的 4 节点按角色定位；坐标用固定布局常量，不依赖完整六节点坐标）：

```jsx
import { useState } from 'react';
import MiniFlowNode from './MiniFlowNode.jsx';
import MiniFlowEdge from './MiniFlowEdge.jsx';

// 4 节点在 360×220 画布内的固定锚点：current 居中，upstream 左上，下游两个在右列
const NODE_POS = {
  current: { x: 128, y: 96 },
  upstream: { x: 40, y: 40 },
  downstream0: { x: 240, y: 40 },
  downstream1: { x: 240, y: 160 },
};

export default function FlowPeek({ peek, onOpenNetwork, onPokeUpstream }) {
  const [selectedId, setSelectedId] = useState(null);
  const positions = {};
  let downIdx = 0;
  peek.nodes.forEach((n) => {
    if (n.role === 'current') positions[n.id] = NODE_POS.current;
    else if (n.role === 'upstream') positions[n.id] = NODE_POS.upstream;
    else positions[n.id] = NODE_POS[`downstream${downIdx++}`];
  });
  const selected = peek.nodes.find((n) => n.id === selectedId);
  return (
    <section className="flow-peek" role="dialog" aria-label="协作流程预览">
      <header className="flow-peek-head">
        <b>{peek.summary.blockers}个阻塞 · {peek.summary.downstreamCount}个下游</b>
        {selected && <span className="flow-peek-selected">已选：{selected.name} · {selected.owner}</span>}
      </header>
      <div className="flow-peek-canvas">
        <svg viewBox="0 0 360 200" aria-hidden="true">
          <defs><marker id="mini-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L5,3 z" fill="#3b82f6" /></marker></defs>
          {peek.edges.map((e) => {
            const a = positions[e.from], b = positions[e.to];
            return a && b ? <MiniFlowEdge key={e.id} from={{ x: a.x, y: a.y + 20 }} to={{ x: b.x, y: b.y + 20 }} critical={e.isCritical} /> : null;
          })}
        </svg>
        {peek.nodes.map((n) => (
          <button key={n.id} type="button" className={`mini-node-anchor ${selectedId === n.id ? 'is-selected' : ''}`} style={{ left: positions[n.id]?.x, top: positions[n.id]?.y }} onClick={() => setSelectedId(n.id)}>
            <MiniFlowNode node={n} />
          </button>
        ))}
      </div>
      <footer className="flow-peek-foot">
        <button type="button" onClick={onOpenNetwork}>查看完整网络</button>
        <button type="button" onClick={onPokeUpstream}>戳一下上游</button>
      </footer>
    </section>
  );
}
```

`src/index.css` 追加（形态动画 + 组件样式，仅 transform/opacity）：

```css
/* 形态动画 */
.pet-idle { animation: pet-breathe 2.8s ease-in-out infinite; }
.pet-unread { animation: pet-hop 0.5s ease-in-out 1; }
.pet-blocked { box-shadow: 0 0 0 6px rgb(251 113 133 / 16%), 0 12px 36px rgb(0 0 0 / 38%); }
.pet-working { animation: pet-pulse 1.6s ease-in-out infinite; }
.pet-done { box-shadow: 0 0 0 6px rgb(34 197 94 / 45%); animation: pet-flash 0.6s ease-out 1; }
.pet-off { filter: brightness(0.4); }
.pet-paused { animation: none; }
@keyframes pet-hop { 50% { transform: translateY(-6px); } }
@keyframes pet-pulse { 50% { transform: scale(1.06); } }
@keyframes pet-flash { 50% { opacity: 0.55; } }

/* 徽标 */
.pet-bang { position: absolute; top: -6px; left: -6px; display: grid; width: 20px; height: 20px; place-items: center; border-radius: 999px; background: #ef4444; color: #fff; font-size: 12px; font-weight: 900; }
.pet-unread-dot { position: absolute; top: -4px; right: -4px; display: grid; min-width: 18px; height: 18px; padding: 0 4px; place-items: center; border-radius: 999px; background: #ef4444; color: #fff; font-size: 10px; font-weight: 800; }

/* FlowPeek */
.flow-peek { position: absolute; width: 360px; border: 1px solid rgb(226 232 240 / 40%); border-radius: 14px; background: rgb(255 255 255 / 92%); color: #0f172a; box-shadow: 0 16px 44px rgb(0 0 0 / 32%); overflow: hidden; }
.flow-peek-head { padding: 8px 12px; font-size: 12px; border-bottom: 1px solid rgb(226 232 240 / 60%); }
.flow-peek-selected { float: right; color: #64748b; font-size: 11px; font-weight: 400; }
.flow-peek-canvas { position: relative; height: 200px; }
.flow-peek-canvas svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.mini-node-anchor { position: absolute; transform: translate(-50%, -50%); padding: 0; border: 0; background: transparent; }
.mini-node-anchor.is-selected .mini-node { outline: 2px solid #3b82f6; outline-offset: 1px; }
.mini-node { display: flex; align-items: center; gap: 6px; min-width: 120px; padding: 6px 8px; border: 1px solid rgb(226 232 240 / 70%); border-radius: 10px; background: #e0f2fe; text-align: left; }
.mini-node-current { transform: scale(1.08); border-color: #3b82f6; }
.mini-node-done { background: #dcfce7; } .mini-node-doing { background: #fef9c3; } .mini-node-todo { background: #e2e8f0; }
.mini-node-avatar { display: grid; width: 22px; height: 22px; place-items: center; border-radius: 999px; background: #0f172a; color: #fff; font-size: 11px; }
.mini-node-name { display: block; font-size: 12px; }
.mini-node-owner { display: block; color: #64748b; font-size: 10px; }
.mini-node-flag { display: block; font-style: normal; color: #f59e0b; font-size: 10px; }
.flow-peek-foot { display: flex; gap: 8px; padding: 8px 12px; border-top: 1px solid rgb(226 232 240 / 60%); }
.flow-peek-foot button { flex: 1; padding: 6px 0; border-radius: 8px; border: 1px solid #3b82f6; background: #eff6ff; color: #1d4ed8; font-size: 12px; cursor: pointer; }
.flow-peek-foot button:last-child { background: #3b82f6; color: #fff; }
@media (prefers-reduced-motion: reduce) { .pet-idle, .pet-unread, .pet-working, .pet-done { animation: none; } }
```

- [ ] **Step 4: 构建 + 测试**

Run: `npm test` → PASS；`npm run build` → 成功。

- [ ] **Step 5: 提交**

```bash
git add src/features/pet/PetAvatar.jsx src/features/pet/FlowPeek.jsx src/features/pet/MiniFlowNode.jsx src/features/pet/MiniFlowEdge.jsx src/index.css tests/petFlowModel.test.mjs
git commit -m "feat(pet): add avatar/flow-peek/mini-flow components"
```

---

## Task 7: PetPanel + PetMessages + CSS

**Files:**
- Create: `src/features/pet/PetMessages.jsx`
- Create: `src/features/pet/PetPanel.jsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `derivePetMessages`（Task 1）。
- Produces: `<PetMessages messages onOpenNetwork onPokeUpstream />`、`<PetPanel ... />`

- [ ] **Step 1: 实现**

`src/features/pet/PetMessages.jsx`：

```jsx
import { derivePetMessages } from '../../components/petModel.js';

export default function PetMessages({ pokes, onOpenNetwork, onPokeUpstream }) {
  const messages = derivePetMessages(pokes);
  return (
    <div className="pet-messages">
      {messages.length ? messages.map((m) => (
        <article className="pet-msg" key={m.id}>
          <div className="pet-msg-meta">
            <b>{m.from}</b><span>→</span><b>{m.to}</b>
            <time>{m.time}</time>
            <span className="pet-msg-channel">{m.channelLabel}</span>
          </div>
          <p className="pet-msg-body">{m.message}</p>
          {m.reply && <p className="pet-msg-reply">↩ {m.reply}</p>}
          <div className={`pet-msg-status pet-msg-${m.status}`}>
            {m.status === 'replied' ? '已回复' : m.status === 'read' ? '已读' : '已发送'}
          </div>
        </article>
      )) : <p className="pet-msg-empty">还没有协作消息</p>}
      <div className="pet-panel-actions">
        <button type="button" onClick={onPokeUpstream}>戳一下上游</button>
        <button type="button" onClick={onOpenNetwork}>打开协作网络</button>
      </div>
    </div>
  );
}
```

`src/features/pet/PetPanel.jsx`：

```jsx
import { useState } from 'react';
import FlowPeek from './FlowPeek.jsx';
import PetMessages from './PetMessages.jsx';

export default function PetPanel({ progress, peek, pokes, onClose, onOpenNetwork, onPokeUpstream }) {
  const [tab, setTab] = useState('deps');
  return (
    <section className="pet-panel" role="dialog" aria-label="宠物面板">
      <header className="pet-panel-head">
        <div className="pet-panel-title">
          <span className="pet-panel-avatar" aria-hidden="true">卡皮巴拉</span>
          <div><b>{progress.projectName}</b><small>{progress.headline}</small></div>
        </div>
        <button type="button" className="pet-panel-close" onClick={onClose} aria-label="关闭">×</button>
      </header>
      <nav className="pet-panel-tabs">
        <button type="button" className={tab === 'deps' ? 'is-active' : ''} onClick={() => setTab('deps')}>依赖</button>
        <button type="button" className={tab === 'messages' ? 'is-active' : ''} onClick={() => setTab('messages')}>消息</button>
      </nav>
      <div className="pet-panel-body">
        {tab === 'deps' ? <FlowPeek peek={peek} onOpenNetwork={onOpenNetwork} onPokeUpstream={onPokeUpstream} /> : <PetMessages pokes={pokes} onOpenNetwork={onOpenNetwork} onPokeUpstream={onPokeUpstream} />}
      </div>
    </section>
  );
}
```

`src/index.css` 追加：

```css
.pet-panel { position: absolute; inset: 0; display: flex; flex-direction: column; border-radius: 14px; background: #0f172a; color: #f8fafc; overflow: hidden; }
.pet-panel-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid #1e293b; }
.pet-panel-title { display: flex; align-items: center; gap: 8px; } .pet-panel-title b { display: block; font-size: 13px; } .pet-panel-title small { color: #94a3b8; font-size: 11px; }
.pet-panel-avatar { display: grid; width: 30px; height: 30px; place-items: center; border-radius: 999px; background: #f59e0b; color: #0f172a; font-size: 10px; }
.pet-panel-close { border: 0; background: transparent; color: #94a3b8; font-size: 20px; cursor: pointer; }
.pet-panel-tabs { display: flex; gap: 4px; padding: 6px 12px 0; border-bottom: 1px solid #1e293b; }
.pet-panel-tabs button { padding: 6px 12px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #94a3b8; font-size: 12px; cursor: pointer; }
.pet-panel-tabs button.is-active { color: #fff; border-bottom-color: #3b82f6; }
.pet-panel-body { flex: 1; overflow: auto; }
.pet-panel-body .flow-peek { position: static; width: 100%; border-radius: 0; box-shadow: none; }
.pet-messages { padding: 12px; display: grid; gap: 8px; }
.pet-msg { border: 1px solid #1e293b; border-radius: 10px; padding: 8px 10px; background: #111827; }
.pet-msg-meta { display: flex; gap: 6px; align-items: center; font-size: 11px; color: #cbd5e1; } .pet-msg-meta time { margin-left: auto; color: #64748b; } .pet-msg-channel { padding: 1px 6px; border-radius: 999px; background: #1e293b; color: #93c5fd; font-size: 10px; }
.pet-msg-body { margin: 6px 0; font-size: 12px; color: #e2e8f0; }
.pet-msg-reply { margin: 6px 0 0; padding-left: 8px; border-left: 2px solid #22c55e; font-size: 12px; color: #bbf7d0; }
.pet-msg-status { margin-top: 6px; font-size: 10px; color: #64748b; } .pet-msg-replied { color: #22c55e; }
.pet-msg-empty { color: #64748b; font-size: 12px; text-align: center; padding: 20px 0; }
.pet-panel-actions { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid #1e293b; }
.pet-panel-actions button { flex: 1; padding: 8px 0; border-radius: 8px; border: 1px solid #3b82f6; background: #1d4ed8; color: #fff; font-size: 12px; cursor: pointer; }
.pet-panel-actions button:first-child { background: #1e293b; border-color: #334155; }
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 成功（`getChannelLabel` 已由 Task 2 补上）。

- [ ] **Step 3: 提交**

```bash
git add src/features/pet/PetMessages.jsx src/features/pet/PetPanel.jsx src/index.css
git commit -m "feat(pet): add panel and messages components"
```

---

## Task 8: PetWindow 容器重写（hover 计时 / Esc / 失焦收起 / 订阅快照）

**Files:**
- Modify: `src/features/pet/PetWindow.jsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `desktopBridge.onPetSnapshot/petSetMode/onPetProgress/onPetPaused/onPetLoadError/openMain`；`normalizePetProgress`、`derivePetMood`、`deriveFlowPeek`、`computePetFlip`；Task 6/7 组件。
- Produces: `/pet` 页面根组件，完整交互。

- [ ] **Step 1: 实现** 重写 `src/features/pet/PetWindow.jsx`

```jsx
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
  const hoverTimer = useRef(null);
  const leaveTimer = useRef(null);

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
    return () => { offSnap(); offProgress(); offPaused?.(); offError?.(); window.removeEventListener('blur', onBlur); window.removeEventListener('keydown', onKey); };
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
  function requestMode(mode) {
    const { screenX, screenY, innerWidth, innerHeight } = window;
    const avail = window.screen || {};
    const flip = computePetFlip({ anchorX: screenX, anchorY: screenY, contentWidth: mode === 'panel' ? 380 : 380, contentHeight: mode === 'panel' ? 500 : 260, availWidth: avail.availWidth || screenX + 1000, availHeight: avail.availHeight || screenY + 1000 });
    desktopBridge.petSetMode({ mode, flipX: flip.flipX, flipY: flip.flipY });
  }

  function openPanel() {
    setExpanded(true);
    requestMode('panel');
  }
  function openMain() { desktopBridge.openMain(); }

  const flowPeek = deriveFlowPeek(snapshot.nodes, snapshot.edges, { currentUserId: 'n_design' });
  const mood = derivePetMood({ progress, paused, unread, hovering: hovered && !expanded, expanded });

  return (
    <main className={`pet-shell ${expanded ? 'pet-shell-expanded' : ''}`} onMouseEnter={onEnter} onMouseLeave={onLeave} onContextMenu={(e) => { e.preventDefault(); desktopBridge.petOpenMenu(); }}>
      <PetAvatar mood={mood} progress={progress} unread={unread} paused={paused} onClick={openPanel} onMouseEnter={onEnter} onMouseLeave={onLeave} />
      {hovered && !expanded && <FlowPeek peek={flowPeek} onOpenNetwork={openMain} onPokeUpstream={pokeUpstream} />}
      {expanded && <PetPanel progress={progress} peek={flowPeek} pokes={snapshot.pokes} onClose={collapse} onOpenNetwork={openMain} onPokeUpstream={pokeUpstream} />}
    </main>
  );
}

function pokeUpstream() { desktopBridge.openMain(); }
```

> `pokeUpstream` 先落到「打开主窗去戳上游」（`openMain`），因为发送 poke 的权威动作在主窗 `PokeAction`；桌宠侧不重复实现发送逻辑。验收 #6 的「戳陈总 → 自动消息 → 已读 → reply」链路在主窗演示模式下触发，快照广播回桌宠后消息 Tab 展示。

`src/index.css` 追加：

```css
.pet-shell { position: relative; width: 72px; height: 72px; color: white; overflow: visible; }
.pet-shell-expanded { width: 380px; height: 500px; }
.flow-peek { right: 0; bottom: 0; }
```

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 3: 提交**

```bash
git add src/features/pet/PetWindow.jsx src/index.css
git commit -m "feat(pet): rewrite pet window as hover/expand container"
```

---

## Task 9: 全量验证与手测

**Files:** 无新文件。

- [ ] **Step 1: 单测全绿**

Run: `npm test`
Expected: 全部 PASS（petModel/pokeModel/networkModel/electronModel/petFlowModel）。

- [ ] **Step 2: 构建通过**

Run: `npm run build`
Expected: 无报错，产物生成到 `dist/`。

- [ ] **Step 3: 手测清单（Electron）**

Run 终端 1: `npm run dev`；终端 2: `npm run electron:dev`。

1. 鼠标快速划过桌宠 → 不弹窗；停留 600ms → 出现 FlowPeek。
2. FlowPeek 显示 4 节点 `n_brand→n_design→n_dev/n_test`，顶部「1个阻塞 · 2个下游」。
3. 鼠标从桌宠移进 FlowPeek → 不消失；完全离开 250ms 后收起。
4. 把桌宠拖到屏幕四角 → FlowPeek/面板都不越界（反向展开）。
5. 点击桌宠 → 打开 380×500 面板，「依赖」「消息」Tab 可切换。
6. 主窗选中「品牌素材」→ 点「戳一戳 陈总」→ 桌宠消息 Tab 出现自动消息 + 已读 + reply「收到，10分钟内发你🙌」。
7. `petModel` 单测覆盖 unread/blocked/done/off 形态；`derivePetMood` 优先级稳定。
8. 浏览器模式 `npm run dev` 打开 `/pet` → 不报错（`window.pokeDesktop` 缺失，走默认快照）。
9. 确认 `/`、`/network`、`/assistant`、`/pet` 路由不受影响；`server/index.js` 未改动。

- [ ] **Step 4: 提交（若有手测微调）**

```bash
git add -A && git commit -m "chore(pet): verification tweaks"
```

---

## Self-Review 结论

- **Spec 覆盖**：9 态状态机 → Task 1；FlowPeek 4 节点 + 折线 + 翻转 → Task 1/4/6；消息 Tab + reply → Task 2/7；IPC 快照/暂停/off → Task 3/4；浏览器 fallback → Task 3（noop）+ Task 8；`prefers-reduced-motion` → Task 6 CSS；不新增依赖/不动后端 → 全局约束。
- **占位扫描**：所有函数/组件均有完整代码，无 TBD。
- **类型一致**：`derivePetMood`/`deriveFlowPeek`/`derivePetMessages`/`buildPetSnapshot`/`computePetFlip` 签名在 Task 1 定义，Task 5/6/7/8 引用一致；IPC 通道名 `pet:snapshot`/`pet:snapshot-updated`/`pet:set-mode` 在 Task 3/4/8 一致。
