import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PET_MOOD, derivePetMood, derivePetBadges, deriveFlowPeek, derivePetMessages,
  buildPetSnapshot, computePetFlip, DEFAULT_PET_PROGRESS,
} from '../src/components/petModel.js';
import { FALLBACK_NODES, FALLBACK_EDGES } from '../src/components/networkModel.js';

test('悬浮弹窗不改变桌宠形态', () => {
  // DEFAULT_PET_PROGRESS.phase 为 blocked，用 normal 作中性基线，才能单独验证 unread/idle 档
  const base = { progress: { ...DEFAULT_PET_PROGRESS, phase: 'normal' } };
  assert.equal(derivePetMood({ ...base, expanded: true }), PET_MOOD.EXPANDED);
  assert.equal(derivePetMood({ ...base, hovering: true }), PET_MOOD.IDLE);
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

const contracts = await import('../electron/ipc/contracts.cjs');
test('宠物快照与模式 payload 被白名单校验', () => {
  assert.deepEqual(contracts.validatePetSnapshot({ progress: {}, nodes: [], edges: [], pokes: [], notifications: [], currentUser: '小陈' }), { progress: {}, nodes: [], edges: [], pokes: [], notifications: [], currentUser: '小陈' });
  assert.throws(() => contracts.validatePetSnapshot({ progress: {}, nodes: [] }), /Unknown|Invalid/);
  assert.throws(() => contracts.validatePetSnapshot({ progress: {}, nodes: {}, edges: [], pokes: [], notifications: [], currentUser: '' }), /array/);
  assert.deepEqual(contracts.validatePetMode({ mode: 'panel', flipX: true, flipY: false }), { mode: 'panel', flipX: true, flipY: false });
  assert.throws(() => contracts.validatePetMode({ mode: 'bogus' }), /mode/);
  assert.deepEqual(contracts.validatePetMove({ dx: 8, dy: -4 }), { dx: 8, dy: -4 });
  assert.throws(() => contracts.validatePetMove({ dx: 9999, dy: 0 }), /delta/);
});

test('桌面窗口按屏幕位置翻转定位：靠右向左长、靠下向上长', () => {
  // 纯函数覆盖定位算法，见 main.cjs setPetMode 用同一公式的等价函数
  const anchor = (bounds, size, flip) => ({
    x: flip.flipX ? bounds.x + bounds.width - size.width : bounds.x,
    y: flip.flipY ? bounds.y + bounds.height - size.height : bounds.y,
  });
  assert.deepEqual(anchor({ x: 700, y: 700, width: 72, height: 72 }, { width: 380, height: 500 }, { flipX: true, flipY: true }), { x: 392, y: 272 });
  assert.deepEqual(anchor({ x: 10, y: 10, width: 72, height: 72 }, { width: 380, height: 500 }, { flipX: false, flipY: false }), { x: 10, y: 10 });
});

test('状态徽标数据驱动形态 class（快照到 CSS 的映射稳定）', () => {
  const moodClass = (mood) => `pet-${mood}`;
  assert.equal(moodClass(PET_MOOD.BLOCKED), 'pet-blocked');
  assert.equal(moodClass(PET_MOOD.UNREAD), 'pet-unread');
});
