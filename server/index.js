import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import cors from 'cors';
import express from 'express';

const PORT = 3001;
const app = express();

// 基于 import.meta.url 读取 mock 数据，避免写死 /Users、C:\ 或 /tmp 等绝对路径
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mockData = JSON.parse(
  readFileSync(path.join(__dirname, 'mock-data.json'), 'utf8')
);

const { tasks, edges, coordinates } = mockData;

app.use(cors());
app.use(express.json());

// Task 02 接口统一模拟 200–500ms 延迟
function delay() {
  const ms = 200 + Math.floor(Math.random() * 301); // 200–500
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

// 6.1 假授权
app.post('/api/feishu/auth', async (_request, response) => {
  await delay();
  response.json({ token: 'mock-token' });
});

// 6.2 拉取假飞书数据（不含坐标）
app.get('/api/feishu/data', async (_request, response) => {
  await delay();
  response.json({ tasks });
});

// 6.3 本地规则解析
// 真实版本会调用 LLM 理解文档/看板/聊天；本 Demo 使用预设结果。
app.post('/api/ai/parse', async (request, response) => {
  await delay();
  const sourceTasks = Array.isArray(request.body?.tasks)
    ? request.body.tasks
    : tasks;
  const nodes = sourceTasks.map((task) => ({
    ...task,
    x: coordinates[task.id]?.x,
    y: coordinates[task.id]?.y,
  }));
  response.json({ nodes, edges, pendingApproval: true });
});

// 6.4 审批（直接回显请求，不调用外部服务）
app.post('/api/ai/approve', async (request, response) => {
  await delay();
  const nodes = request.body?.nodes ?? [];
  const approvedEdges = request.body?.edges ?? [];
  response.json({ approved: true, nodes, edges: approvedEdges });
});

// 6.5 戳一戳
app.post('/api/poke', async (request, response) => {
  await delay();
  const { to } = request.body ?? {};
  const node = tasks.find((task) => task.id === to);
  const nodeName = node?.name ?? to;

  if (to === 'n_brand') {
    response.json({
      message: '陈总好，首页设计稿还差品牌素材，方便今天给我吗？🙏',
      reply: '收到，10 分钟内发你 🙌',
      channel: 'feishu',
    });
    return;
  }

  response.json({
    message: `「${nodeName}」快好了吗？下游在等你 👀`,
    reply: '好，我尽快 👌',
    channel: 'feishu',
  });
});

// 6.6 标记完成（向下游负责人发通知）
app.post('/api/node/complete', async (request, response) => {
  await delay();
  const { nodeId } = request.body ?? {};
  const downstream = edges
    .filter((edge) => edge.from === nodeId)
    .map((edge) => tasks.find((task) => task.id === edge.to))
    .filter(Boolean);
  const notifications = downstream.map((node, index) => ({
    id: `ntf${index + 1}`,
    to: node.owner,
    type: 'upstream_done',
    message: '上游已完成，你可以开始了',
    channel: 'feishu',
  }));
  response.json({ nodeId, notifications });
});

// 6.7 关灯
app.post('/api/clock/off', async (_request, response) => {
  await delay();
  response.json({ status: 'off' });
});

// 6.8 今日指标
app.get('/api/metrics', async (_request, response) => {
  await delay();
  response.json({ doneToday: 3, alignedPeople: 5, blocked: 0 });
});

app.listen(PORT, () => {
  console.log(`Poke server listening on http://localhost:${PORT}`);
});
