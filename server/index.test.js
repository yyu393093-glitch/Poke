import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { app } from './index.js';

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function api(method, path, body) {
  const options = { method };
  if (body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${baseUrl}${path}`, options);
  const json = await response.json();
  return {
    status: response.status,
    json,
    contentType: response.headers.get('content-type') ?? '',
  };
}

const post = (path, body) => api('POST', path, body ?? {});
const get = (path) => api('GET', path);

test('GET /api/health 返回 ok', async () => {
  const { status, json, contentType } = await get('/api/health');
  assert.equal(status, 200);
  assert.deepEqual(json, { ok: true });
  assert.match(contentType, /application\/json/);
});

test('POST /api/feishu/auth 返回 mock-token', async () => {
  const { status, json } = await post('/api/feishu/auth', {});
  assert.equal(status, 200);
  assert.deepEqual(json, { token: 'mock-token' });
});

test('GET /api/feishu/data 返回 6 个任务', async () => {
  const { status, json } = await get('/api/feishu/data?token=mock-token');
  assert.equal(status, 200);
  assert.ok(Array.isArray(json.tasks));
  assert.equal(json.tasks.length, 6);
  assert.deepEqual(
    json.tasks.map((task) => task.id),
    ['n_req', 'n_brand', 'n_design', 'n_dev', 'n_test', 'n_copy'],
  );
});

test('GET /api/feishu/data 错误 token 返回 JSON 401', async () => {
  const { status, json } = await get('/api/feishu/data?token=wrong');
  assert.equal(status, 401);
  assert.equal(json.code, 'INVALID_TOKEN');
  assert.ok(json.error);
});

test('POST /api/ai/parse 返回 6 个带坐标节点 + 6 条边 + pendingApproval', async () => {
  const { status, json } = await post('/api/ai/parse', {});
  assert.equal(status, 200);
  assert.equal(json.pendingApproval, true);
  assert.equal(json.nodes.length, 6);
  assert.equal(json.edges.length, 6);
  for (const node of json.nodes) {
    assert.equal(typeof node.x, 'number');
    assert.equal(typeof node.y, 'number');
  }
});

test('POST /api/ai/parse 非数组 tasks 返回 JSON 400', async () => {
  const { status, json } = await post('/api/ai/parse', { tasks: 'not-an-array' });
  assert.equal(status, 400);
  assert.equal(json.code, 'INVALID_TASKS');
});

test('POST /api/ai/approve 正确回显', async () => {
  const body = { nodes: [{ id: 'n_req' }], edges: [{ id: 'e1' }] };
  const { status, json } = await post('/api/ai/approve', body);
  assert.equal(status, 200);
  assert.equal(json.approved, true);
  assert.deepEqual(json.nodes, body.nodes);
  assert.deepEqual(json.edges, body.edges);
});

test('POST /api/poke 品牌素材返回精确 message/reply/channel', async () => {
  const { status, json } = await post('/api/poke', { from: '小陈', to: 'n_brand' });
  assert.equal(status, 200);
  assert.deepEqual(json, {
    message: '陈总好，首页设计稿还差品牌素材，方便今天给我吗？🙏',
    reply: '收到，10 分钟内发你 🙌',
    channel: 'feishu',
  });
});

test('POST /api/poke 其他节点返回通用模板', async () => {
  const { status, json } = await post('/api/poke', { from: '小陈', to: 'n_dev' });
  assert.equal(status, 200);
  assert.equal(json.message, '「前端开发」快好了吗？下游在等你 👀');
  assert.equal(json.reply, '好，我尽快 👌');
  assert.equal(json.channel, 'feishu');
});

test('POST /api/poke 非法节点返回 JSON 404', async () => {
  const { status, json } = await post('/api/poke', { from: '小陈', to: 'n_unknown' });
  assert.equal(status, 404);
  assert.equal(json.code, 'NODE_NOT_FOUND');
});

test('POST /api/poke 缺字段返回 JSON 400', async () => {
  const { status, json } = await post('/api/poke', { from: '小陈' });
  assert.equal(status, 400);
  assert.equal(json.code, 'INVALID_POKE');
});

test('POST /api/node/complete n_design 返回两条通知', async () => {
  const { status, json } = await post('/api/node/complete', { nodeId: 'n_design' });
  assert.equal(status, 200);
  assert.equal(json.nodeId, 'n_design');
  assert.equal(json.notifications.length, 2);
  assert.deepEqual(
    json.notifications.map((notification) => notification.to),
    ['老李', '小赵'],
  );
  for (const notification of json.notifications) {
    assert.equal(notification.type, 'upstream_done');
    assert.equal(notification.channel, 'feishu');
    assert.equal(notification.message, '上游已完成，你可以开始了');
  }
  // 同一请求内通知 ID 不得重复
  assert.equal(
    new Set(json.notifications.map((notification) => notification.id)).size,
    json.notifications.length,
  );
});

test('POST /api/node/complete 非法节点返回 JSON 404', async () => {
  const { status, json } = await post('/api/node/complete', { nodeId: 'n_unknown' });
  assert.equal(status, 404);
  assert.equal(json.code, 'NODE_NOT_FOUND');
});

test('GET /api/metrics 精确返回 3/5/0', async () => {
  const { status, json } = await get('/api/metrics');
  assert.equal(status, 200);
  assert.deepEqual(json, { doneToday: 3, alignedPeople: 5, blocked: 0 });
});

test('POST /api/clock/off 返回 off', async () => {
  const { status, json } = await post('/api/clock/off', {});
  assert.equal(status, 200);
  assert.deepEqual(json, { status: 'off' });
});

test('核心响应 Content-Type 为 application/json', async () => {
  const cases = [
    () => get('/api/health'),
    () => post('/api/feishu/auth', {}),
    () => get('/api/feishu/data?token=mock-token'),
    () => post('/api/ai/parse', {}),
    () => post('/api/poke', { from: '小陈', to: 'n_brand' }),
    () => post('/api/node/complete', { nodeId: 'n_design' }),
    () => get('/api/metrics'),
    () => post('/api/clock/off', {}),
  ];
  for (const call of cases) {
    const { contentType } = await call();
    assert.match(contentType, /application\/json/);
  }
});
