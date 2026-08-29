import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 3001;
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, 'mock-data.json');

app.use(cors());
app.use(express.json());

function readMockData() {
  return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}

function withCoordinates(task, coordinates) {
  return {
    ...task,
    ...(coordinates[task.id] ?? { x: 0, y: 0 }),
  };
}

function delayResponse(response, payload) {
  const delay = 200 + Math.floor(Math.random() * 301);
  setTimeout(() => response.json(payload), delay);
}

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.post('/api/feishu/auth', (_request, response) => {
  delayResponse(response, { token: 'mock-token' });
});

app.get('/api/feishu/data', (_request, response) => {
  const data = readMockData();
  delayResponse(response, { tasks: data.tasks });
});

app.post('/api/ai/parse', (request, response) => {
  const data = readMockData();
  const tasks = Array.isArray(request.body?.tasks) && request.body.tasks.length
    ? request.body.tasks
    : data.tasks;

  // 真实版本会调 LLM 解析文档、看板和聊天记录；本 demo 用预设依赖网络代替。
  const nodes = tasks.map((task) => withCoordinates(task, data.coordinates));
  delayResponse(response, {
    nodes,
    edges: data.edges,
    pendingApproval: true,
  });
});

app.post('/api/ai/approve', (request, response) => {
  delayResponse(response, {
    approved: true,
    nodes: request.body?.nodes ?? [],
    edges: request.body?.edges ?? [],
  });
});

app.post('/api/poke', (request, response) => {
  const data = readMockData();
  const targetId = request.body?.to;
  const target = data.tasks.find((task) => task.id === targetId);
  const message = targetId === 'n_brand'
    ? '陈总好，首页设计稿还差品牌素材，方便今天给我吗？🙏'
    : `「${target?.name ?? '这个任务'}」快好了吗？下游在等你 👀`;

  delayResponse(response, { message, channel: 'feishu' });
});

app.post('/api/node/complete', (request, response) => {
  const data = readMockData();
  const nodeId = request.body?.nodeId;
  const downstream = data.edges
    .filter((edge) => edge.from === nodeId)
    .map((edge) => data.tasks.find((task) => task.id === edge.to))
    .filter(Boolean);

  delayResponse(response, {
    nodeId,
    notifications: downstream.map((task, index) => ({
      id: `ntf${index + 1}`,
      to: task.owner,
      type: 'upstream_done',
      message: '上游已完成，你可以开始了',
      channel: 'feishu',
    })),
  });
});

app.post('/api/clock/off', (_request, response) => {
  delayResponse(response, { status: 'off' });
});

app.get('/api/metrics', (_request, response) => {
  delayResponse(response, { doneToday: 3, alignedPeople: 5, blocked: 0 });
});

app.listen(PORT, () => {
  console.log(`Poke server listening on http://localhost:${PORT}`);
});
