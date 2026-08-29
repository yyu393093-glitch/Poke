import { readFileSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import {
  initStore,
  addDocument,
  getDocumentById,
  addParse,
  getParses,
  getParseById,
  getOrgChart,
  setOrgChart,
  UPLOADS_DIR,
} from './store.js';
import { hasApiKey, parseDocument, parseOrgChart } from './parseClient.js';
import { enrichAssignments } from './assignmentEngine.js';

const PORT = 3001;
const app = express();

// 基于 import.meta.url 读取 mock 数据，避免写死 /Users、C:\ 或 /tmp 等绝对路径
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mockData = JSON.parse(
  readFileSync(path.join(__dirname, 'mock-data.json'), 'utf8')
);

const { tasks, edges, coordinates } = mockData;

// 确保数据目录与上传目录存在，并初始化 JSON 存储
initStore();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, UPLOADS_DIR),
    filename: (_request, file, callback) => {
      const ext = path.extname(file.originalname ?? '').toLowerCase();
      callback(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

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

// ============================================================
// 文档解析板块（新增 6 个接口，不叠加人为 200–500ms 延迟）
// ============================================================

// 上传/粘贴文档 → 存本地 JSON → 调 DeepSeek 解析 → 写 parses 落盘
async function runParse(body) {
  if (!hasApiKey()) {
    return { error: '未配置模型' };
  }

  const { documentId, text } = body ?? {};
  let content;
  let resolvedDocumentId = documentId ?? '';

  if (typeof text === 'string' && text.trim()) {
    content = text;
    // 粘贴的原文也落一条 documents（source_type:"paste"），可重解析、可溯源
    const id = randomUUID();
    addDocument({
      id,
      filename: '粘贴文本',
      source_type: 'paste',
      content,
      created_at: new Date().toISOString(),
    });
    resolvedDocumentId = id;
  } else if (documentId) {
    const doc = getDocumentById(documentId);
    if (!doc) {
      return { error: '文档不存在' };
    }
    content = doc.content;
  } else {
    return { error: '缺少 text 或 documentId' };
  }

  try {
    const result = await parseDocument(content);
    result.recommendedAssignments = enrichAssignments(result, getOrgChart());
    addParse({
      id: randomUUID(),
      document_id: resolvedDocumentId,
      result_json: JSON.stringify(result),
      status: 'success',
      error: '',
      created_at: new Date().toISOString(),
    });
    return { result };
  } catch (error) {
    addParse({
      id: randomUUID(),
      document_id: resolvedDocumentId,
      result_json: '',
      status: 'failed',
      error: error?.message ?? String(error),
      created_at: new Date().toISOString(),
    });
    return { error: '解析失败' };
  }
}

// 上传文件（multipart/form-data，字段名 file）
app.post('/api/doc/upload', upload.single('file'), (request, response) => {
  const file = request.file;
  if (!file) {
    response.json({ error: '未收到文件' });
    return;
  }

  const ext = path.extname(file.originalname ?? '').toLowerCase();
  if (!['.txt', '.md', '.json'].includes(ext)) {
    try {
      unlinkSync(file.path);
    } catch {
      // 忽略清理失败
    }
    response.json({ error: '暂不支持的格式' });
    return;
  }

  let content;
  try {
    content = readFileSync(file.path, 'utf8');
  } catch {
    response.json({ error: '读取文件失败' });
    return;
  }

  const id = randomUUID();
  addDocument({
    id,
    filename: file.originalname,
    source_type: 'upload',
    content,
    created_at: new Date().toISOString(),
  });
  response.json({
    documentId: id,
    filename: file.originalname,
    contentLength: content.length,
  });
});

// 解析文档（收 documentId 或 text）
app.post('/api/doc/parse', async (request, response) => {
  const outcome = await runParse(request.body ?? {});
  if (outcome.error) {
    response.json({ error: outcome.error });
    return;
  }
  response.json(outcome.result);
});

// 历史解析记录列表
app.get('/api/doc/list', (_request, response) => {
  const documents = getParses().map((parse) => {
    const item = {
      id: parse.id,
      document_id: parse.document_id,
      status: parse.status,
      error: parse.error,
      created_at: parse.created_at,
    };
    if (parse.status === 'success' && parse.result_json) {
      try {
        const result = JSON.parse(parse.result_json);
        item.source = result.source ?? '';
        item.summary = result.summary ?? '';
      } catch {
        // 忽略损坏的记录，仅返回元信息
      }
    }
    return item;
  });
  response.json({ documents });
});

// 单条解析结果
app.get('/api/doc/:id', (request, response) => {
  const parse = getParseById(request.params.id);
  if (!parse) {
    response.json({ error: '记录不存在' });
    return;
  }
  if (parse.status !== 'success') {
    response.json({ error: parse.error || '解析失败' });
    return;
  }
  try {
    response.json(JSON.parse(parse.result_json));
  } catch {
    response.json({ error: '解析结果损坏' });
  }
});

// 组织架构导入
app.post('/api/org/import', async (request, response) => {
  if (!hasApiKey()) {
    response.json({ error: '未配置模型' });
    return;
  }
  const { text } = request.body ?? {};
  if (typeof text !== 'string' || !text.trim()) {
    response.json({ error: '缺少 text' });
    return;
  }
  try {
    const { orgChart } = await parseOrgChart(text);
    setOrgChart(orgChart);
    response.json({ orgChart });
  } catch {
    response.json({ error: '解析失败' });
  }
});

// 推荐分工（复用 runParse，只返回 recommendedAssignments）
app.post('/api/assignment/recommend', async (request, response) => {
  const outcome = await runParse(request.body ?? {});
  if (outcome.error) {
    response.json({ error: outcome.error });
    return;
  }
  response.json({ assignments: outcome.result.recommendedAssignments ?? [] });
});

app.listen(PORT, () => {
  console.log(`Poke server listening on http://localhost:${PORT}`);
});
