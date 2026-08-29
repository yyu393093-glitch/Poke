# 文档解析板块 · Spec

> **一句话**：上传（或粘贴）任意协作文档 → 存本地数据库 → DeepSeek 小模型按 JSON Schema 解析成结构化「架构」→ 生成解析文档并落库 → 前端展示 + 结合组织架构给出推荐分工。
>
> **它补上的是**：Poke 之前「AI 解析」是写死规则（假解析），这个板块把它变成**真的**——真上传文件、真存库、真调模型读懂任意文档。

---

## 1. 板块定位

| 项 | 说明 |
|---|---|
| 输入 | 上传文件（PDF / Word / Markdown / 纯文本）或直接粘贴文本 |
| 存储 | 本地 JSON 文件（文件 + 解析结果都落盘） |
| 处理 | DeepSeek 小模型按 JSON Schema 抽取 |
| 输出 | 结构化 JSON「架构」+ 推荐分工，前端可视化展示 |
| 部署 | 只跑本地，调 DeepSeek 云 API（需一个 API key） |

---

## 2. 技术选型

| 项 | 选择 | 说明 |
|---|---|---|
| 小模型 | DeepSeek `deepseek-v4-flash` | OpenAI 兼容 HTTP API（`chat/completions`） |
| 结构化输出 | JSON mode | `response_format: { type: "json_object" }` |
| 本地存储 | **JSON 文件 + Node `fs`**（零依赖，最小化） | 存 `data/store.json` |
| 文件上传 | **multer** | 处理 `multipart/form-data`，存 `data/uploads/` |
| 文本提取 | 原生读 `.txt/.md/.json`；`pdf-parse` 读 PDF；`mammoth` 读 Word | PDF/Word 是加分项，可后置 |
| 后端框架 | Express（沿用） | 监听 `localhost:3001` |

---

## 3. 核心链路（七步）

```text
① 上传文件 / 粘贴文本
        ↓
② 文件存本地 data/uploads/，提取纯文本
        ↓
③ 文档记录写入 JSON 文件（documents 数组）
        ↓
④ DeepSeek 解析（prompt 带上 JSON Schema）
        ↓
⑤ JSON 清洗修复（模型偶尔吐坏 JSON，这里兜底）
        ↓
⑥ 解析结果写入 JSON 文件（parses 数组）=「生成解析文档」
        ↓
⑦ 前端展示 + 推荐分工
```

---

## 4. 本地存储设计（新增，JSON 文件）

> 不引入数据库，用一个 JSON 文件 `data/store.json` 存所有数据（Node `fs` 读写，零依赖、最小化）。文件结构如下：

```json
{
  "documents": [
    { "id": "随机id", "filename": "原始文件名", "source_type": "upload", "content": "提取的纯文本", "created_at": "时间戳" }
  ],
  "parses": [
    { "id": "随机id", "document_id": "关联documents.id", "result_json": "完整PokeDocument JSON字符串", "status": "success", "error": "", "created_at": "时间戳" }
  ],
  "orgChart": { "departments": [], "reporting": [] }
}
```

### 三个部分

| 部分 | 存什么 |
|---|---|
| `documents` 数组 | 上传/粘贴的原始文档（一条一个） |
| `parses` 数组 | 每次解析结果（一条一个）=「生成的解析文档」 |
| `orgChart` 对象 | 组织架构，只存一份最新 |

> 读写规则：启动时 `JSON.parse` 读进内存，每次改动 `JSON.stringify` 写回文件；文件不存在就初始化为空结构。

---

## 5. 文件上传与文本提取（新增）

- 前端选文件 → `POST /api/doc/upload`（`multipart/form-data`）→ multer 存到 `data/uploads/` → 后端提取纯文本。
- **支持的格式**：
  | 格式 | 提取方式 |
  |---|---|
  | `.txt` `.md` `.json` | 直接读文件内容 |
  | `.pdf` | `pdf-parse`（可后置） |
  | `.docx` | `mammoth`（可后置） |
- 提取出纯文本后，写入 `documents` 表，返回 `documentId`，供下一步解析。

---

## 6. JSON Schema（本板块的灵魂）

> 「文档 → 架构」的标准格式。**字段名是硬编码契约**，改一个字母，前端展示和推荐引擎都拼不上。

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "PokeDocument",
  "type": "object",
  "required": ["source", "summary", "people", "tasks", "dependencies"],
  "properties": {

    "source": { "type": "string", "description": "文档标题/类型，如「PR #123」" },
    "summary": { "type": "string", "description": "一句话摘要：这份文档在讲什么" },

    "people": {
      "type": "array",
      "description": "文档中涉及的人员（含组织架构里的人）",
      "items": {
        "type": "object",
        "required": ["name"],
        "properties": {
          "name":        { "type": "string" },
          "dept":        { "type": "string" },
          "role":        { "type": "string" },
          "ownsModules": { "type": "array", "items": { "type": "string" }, "description": "负责的模块/服务名" }
        }
      }
    },

    "tasks": {
      "type": "array",
      "description": "文档里抽取出的待办/改动/任务",
      "items": {
        "type": "object",
        "required": ["title"],
        "properties": {
          "id":     { "type": "string" },
          "title":  { "type": "string" },
          "owner":  { "type": "string", "description": "负责人，与 people.name 对应" },
          "module": { "type": "string", "description": "涉及的模块" },
          "status": { "type": "string", "enum": ["todo", "doing", "done"] }
        }
      }
    },

    "dependencies": {
      "type": "array",
      "description": "任务之间的依赖关系（谁卡着谁）",
      "items": {
        "type": "object",
        "required": ["from", "to"],
        "properties": {
          "from": { "type": "string" },
          "to":   { "type": "string" },
          "type": { "type": "string", "enum": ["blocks", "related", "notifies"], "default": "blocks" }
        }
      }
    },

    "orgChart": {
      "type": "object",
      "description": "组织架构（若文档含组织信息）",
      "properties": {
        "departments": { "type": "array", "items": { "type": "string" } },
        "reporting": {
          "type": "array",
          "items": { "type": "object", "properties": { "from": { "type": "string" }, "to": { "type": "string" } } }
        }
      }
    },

    "recommendedAssignments": {
      "type": "array",
      "description": "推荐分工结果（模型直接产出，后端再校验）",
      "items": {
        "type": "object",
        "properties": {
          "taskTitle":         { "type": "string" },
          "action":            { "type": "string", "enum": ["review", "align", "notify", "assign"] },
          "recommendedOwner":  { "type": "string" },
          "reason":            { "type": "string" },
          "alternatives":      { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  }
}
```

### `action` 四种分工动作

| action | 含义 | 例子 |
|---|---|---|
| `review` | 该谁审这个改动 | PR 改了支付模块 → 推荐「支付 owner 老李」review |
| `align` | 该和谁对齐 | 改了接口 → 对齐「调用方 小赵」 |
| `notify` | 该通知谁（不用行动） | 下游依赖方「联调测试」 |
| `assign` | 这件事该分给谁 | 需求里没写 owner 的任务 |

---

## 7. 处理「任意文档」的保证

「任意」不是靠模型聪明，而是靠三道保险：

| 保险 | 做法 |
|---|---|
| **Schema 宽松** | `required` 只锁 5 个核心字段，其余全 optional；没有的信息返回空数组，**不许模型编造** |
| **Prompt 骨架 + few-shot** | 固定指令模板 + 1 个示例，让模型照葫芦画瓢 |
| **JSON 清洗修复** | 提取首个 `{` 到最后一个 `}`、去代码围栏、修尾逗号、`parse` 失败重试一次 |

### Prompt 骨架（示意）

```text
你是协作文档解析器。请阅读下方文档，抽取其中的：
人员、任务、依赖关系、组织架构，并给出推荐分工。

规则：
1. 只输出一个合法 JSON，严格符合给定的 JSON Schema。
2. 文档里没有的信息，用空数组/空字符串，不要编造。
3. 推荐分工：结合「谁负责哪个模块」和「任务依赖」来推荐。

文档内容：
<<< 提取出的纯文本 >>>
```

---

## 8. 推荐分工逻辑

分两步：**模型先产出** + **后端规则校验**。

**第一步（模型做）**：解析时直接填 `recommendedAssignments`，凭文档语义推荐。

**第二步（后端规则引擎做，兜底补全）**：

```text
1. 每个 task.module  →  匹配 orgChart/people 里 ownsModules 的人
   → 匹配到 → 生成一条 assign 推荐（这个模块该他负责）
2. dependencies 的 from/to  →  上游完成了 → 生成 notify 给下游 owner
3. 跨部门的任务 →  生成 align 推荐（让两个部门的 owner 对齐）
4. 去重：同一 task + 同一人 + 同一 action 只留一条
```

---

## 9. API 接口（6 个，挂 `/api` 前缀）

| 方法 | 路径 | 请求 | 响应 |
|---|---|---|---|
| POST | `/api/doc/upload` | `multipart/form-data`（文件） | `{ documentId, filename, contentLength }` |
| POST | `/api/doc/parse` | `{ "documentId" }` 或 `{ "text" }` | 完整 PokeDocument JSON（含 recommendedAssignments），并落库 |
| GET | `/api/doc/list` | — | `{ documents: [...] }` 历史解析记录列表 |
| GET | `/api/doc/:id` | — | 某一次解析结果 PokeDocument |
| POST | `/api/org/import` | `{ "text": "组织架构文档全文" }` | `{ orgChart: {...} }`，写入 `orgChart` 对象 |
| POST | `/api/assignment/recommend` | `{ "documentId" }` 或 `{ "text" }` | `{ assignments: [...] }`，只返回推荐分工 |

> 说明：`doc/parse` 返回完整 JSON 架构（前端画图），`assignment/recommend` 只吐推荐分工（前端做推荐卡片）。两个接口内部复用同一个解析函数。

---

## 10. 前端接入（新增）

页面 `src/pages/DocParsePage.jsx`，三个区：

| 区 | 组件 | 内容 |
|---|---|---|
| ① 输入区 | 上传按钮 + 拖拽 + 粘贴框 | 选文件上传 / 直接粘贴文本 |
| ② 历史区 | 列表 | 之前解析过的文档，点开看结果 |
| ③ 结果区 | `DocParsePanel.jsx` | 人员列表、任务列表、依赖连线、推荐分工卡片 |

- 推荐分工卡片按 `action` 上色：review 蓝 · align 橙 · notify 灰 · assign 绿
- loading / 错误 / 空结果三种状态都要有
- 前端调 `gameApi.js` 封装接口，不直接写 fetch

---

## 11. 边界与约束

1. **需要 DeepSeek API key**（放 `server/.env`，不进 git）。key 缺失时接口返回「未配置模型」，不崩。
2. **数据只存本地** `data/store.json`，不连任何远程库。
3. **不接真实飞书/企微/钉钉**（H1 不变）。
4. 文档超长（> 32k 字符）时**截断**，保留开头摘要 + 关键段落。
5. 只跑本地 `localhost:3001`（H3 不变）。
6. 上传文件大小限制（如 10MB），防大文件打爆内存。

---

## 12. 验收标准

1. 上传一份 `.md` / `.txt` 文档 → 文件落盘 `data/uploads/`，`documents` 数组多一条记录
2. 解析该文档 → 返回合法 JSON，`parses` 数组多一条 `success` 记录
3. 贴一份**空/无关**文档 → 空 `tasks`/`people`，不报错、不瞎编
4. 贴一份**组织架构文档** → `orgChart` 正确抽出部门 + 汇报线，写入 `orgChart` 对象
5. 贴带模块名 + 负责人的任务文档 → 推荐分工能给出 assign/review
6. `GET /api/doc/list` 能列出历史解析记录，`GET /api/doc/:id` 能看单条结果
7. 模型故意返回坏 JSON（可 mock）→ 清洗修复后仍能解析，或优雅报错（`parses.status = failed`）
8. 没配 key → 返回「未配置模型」，前端提示不白屏
9. 前端上传 → 看到结果区展示人员/任务/依赖/推荐分工卡片，控制台无报错

---

*本文 v2.0 | 上游：[Poke_SPEC.md](../Poke_SPEC.md) · [CLAUDE.md](../CLAUDE.md) | 字段名以本文 JSON Schema 为准，改动先群聊确认*
