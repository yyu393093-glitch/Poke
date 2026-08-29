import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- DeepSeek 配置（模型 ID 若与官方不同，只改这一处常量） ----
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-v4-flash';

// ---- 从 server/.env 读取 DEEPSEEK_API_KEY（原生解析，不引入 dotenv） ----
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const parsed = {};
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      parsed[key] = value;
    }
  }
  return parsed;
}

const env = loadEnv();
const DEEPSEEK_API_KEY = (
  process.env.DEEPSEEK_API_KEY || env.DEEPSEEK_API_KEY || ''
).trim();

export function hasApiKey() {
  return Boolean(DEEPSEEK_API_KEY);
}

// ---- JSON Schema（字段名硬编码契约，改动先群聊确认） ----
export const POKE_DOC_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'PokeDocument',
  type: 'object',
  required: ['source', 'summary', 'people', 'tasks', 'dependencies'],
  properties: {
    source: { type: 'string', description: '文档标题/类型，如「PR #123」' },
    summary: { type: 'string', description: '一句话摘要：这份文档在讲什么' },
    people: {
      type: 'array',
      description: '文档中涉及的人员（含组织架构里的人）',
      items: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          dept: { type: 'string' },
          role: { type: 'string' },
          ownsModules: {
            type: 'array',
            items: { type: 'string' },
            description: '负责的模块/服务名',
          },
        },
      },
    },
    tasks: {
      type: 'array',
      description: '文档里抽取出的待办/改动/任务',
      items: {
        type: 'object',
        required: ['title'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          owner: { type: 'string', description: '负责人，与 people.name 对应' },
          module: { type: 'string', description: '涉及的模块' },
          status: { type: 'string', enum: ['todo', 'doing', 'done'] },
        },
      },
    },
    dependencies: {
      type: 'array',
      description: '任务之间的依赖关系（谁卡着谁）',
      items: {
        type: 'object',
        required: ['from', 'to'],
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          type: {
            type: 'string',
            enum: ['blocks', 'related', 'notifies'],
            default: 'blocks',
          },
        },
      },
    },
    orgChart: {
      type: 'object',
      description: '组织架构（若文档含组织信息）',
      properties: {
        departments: { type: 'array', items: { type: 'string' } },
        reporting: {
          type: 'array',
          items: {
            type: 'object',
            properties: { from: { type: 'string' }, to: { type: 'string' } },
          },
        },
      },
    },
    recommendedAssignments: {
      type: 'array',
      description: '推荐分工结果（模型直接产出，后端再校验）',
      items: {
        type: 'object',
        properties: {
          taskTitle: { type: 'string' },
          action: {
            type: 'string',
            enum: ['review', 'align', 'notify', 'assign'],
          },
          recommendedOwner: { type: 'string' },
          reason: { type: 'string' },
          alternatives: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `你是协作文档解析器。请阅读用户提供的文档，抽取其中的人员、任务、依赖关系、组织架构，并给出推荐分工。

规则：
1. 只输出一个合法 JSON 对象，严格符合给定的 JSON Schema。
2. 文档里没有的信息，用空数组/空字符串，不要编造。
3. 推荐分工：结合「谁负责哪个模块」和「任务依赖」来推荐；action 取值仅限 review/align/notify/assign。
4. 输出必须是纯 JSON，不要包含 markdown 代码围栏或任何解释文字。
5. 所有字段名必须与 JSON Schema 完全一致。`;

// 文档超长时截断，保留开头摘要 + 结尾关键段落（spec 第 11.4 条）
const MAX_CHARS = 32000;

function truncate(text) {
  const s = String(text ?? '');
  if (s.length <= MAX_CHARS) return s;
  const head = Math.floor(MAX_CHARS * 0.6);
  const tail = s.length - Math.floor(MAX_CHARS * 0.4);
  return `${s.slice(0, head)}\n……（内容过长，已截断）……\n${s.slice(tail)}`;
}

function buildParsePrompt(content) {
  return `JSON Schema：
${JSON.stringify(POKE_DOC_SCHEMA)}

文档内容：
<<<${content}>>>

请输出符合上述 Schema 的 JSON 对象。`;
}

function buildOrgPrompt(content) {
  return `请从以下文档中提取组织架构，只输出一个 JSON 对象，结构如下：
{ "orgChart": { "departments": ["部门名"], "reporting": [{ "from": "上级", "to": "下级" }] } }

文档内容：
<<<${content}>>>

请输出 JSON 对象。`;
}

// ---- JSON 清洗修复（模型偶尔吐坏 JSON，这里兜底） ----
function cleanJson(raw) {
  let s = String(raw ?? '');

  // 1. 去掉 markdown 代码围栏（```json / ```）
  s = s.replace(/```[a-zA-Z]*/g, '');

  // 2. 提取首个 { 到最后一个 }
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    throw new Error('未找到 JSON 对象');
  }
  s = s.slice(first, last + 1);

  // 3. 去尾逗号
  s = s.replace(/,\s*([}\]])/g, '$1');

  return JSON.parse(s);
}

// ---- 调用 DeepSeek，返回模型吐出的原始文本 ----
async function callDeepSeek(prompt) {
  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek 请求失败：HTTP ${response.status}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('DeepSeek 返回为空');
  }
  return content;
}

// 解析失败重试一次（拿一次全新的模型输出）
async function callDeepSeekAndParse(prompt) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await callDeepSeek(prompt);
      return cleanJson(raw);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('解析失败');
}

function normalizeOrgChart(value) {
  const obj = value && typeof value === 'object' ? value : {};
  return {
    departments: Array.isArray(obj.departments) ? obj.departments : [],
    reporting: Array.isArray(obj.reporting) ? obj.reporting : [],
  };
}

function normalizePokeDocument(obj) {
  return {
    source: typeof obj.source === 'string' ? obj.source : '',
    summary: typeof obj.summary === 'string' ? obj.summary : '',
    people: Array.isArray(obj.people) ? obj.people : [],
    tasks: Array.isArray(obj.tasks) ? obj.tasks : [],
    dependencies: Array.isArray(obj.dependencies) ? obj.dependencies : [],
    orgChart: normalizeOrgChart(obj.orgChart),
    recommendedAssignments: Array.isArray(obj.recommendedAssignments)
      ? obj.recommendedAssignments
      : [],
  };
}

// 解析任意文档 → 完整 PokeDocument
export async function parseDocument(text) {
  const prompt = buildParsePrompt(truncate(text));
  const obj = await callDeepSeekAndParse(prompt);
  return normalizePokeDocument(obj);
}

// 解析组织架构文档 → { orgChart }
export async function parseOrgChart(text) {
  const prompt = buildOrgPrompt(truncate(text));
  const obj = await callDeepSeekAndParse(prompt);
  const orgChart = obj?.orgChart ?? obj;
  return { orgChart: normalizeOrgChart(orgChart) };
}
