# CLAUDE.md — Task 02 Agent 开发契约

本文适用于在 `feat/backend` 分支执行 Task 02 的所有 Coding Agent。它是自包含的工作说明；不要猜测字段名、ID、响应结构或任务范围。

## 1. 任务目标

实现本地 Mock 后端，模拟以下完整链路：

```text
假授权 → 拉取假数据 → 本地规则解析 → 审批 → 生成网络
```

同时实现戳一戳、标记完成、关灯和指标接口。所有数据来自 `server/mock-data.json`，服务监听 3001 端口。

## 2. 开工规则

1. 确认当前分支是 `feat/backend`，不要在 `main` 直接开发。
2. 先执行 `git status --short`。工作区可能存在用户自己的未跟踪文档，不要修改、删除或加入提交。
3. 安装依赖使用 `npm ci` 和 `npm --prefix server ci`。
4. 只实现 Task 02，不实现网络图、前端交互、通知动画、涟漪、时钟 UI 或收尾演出。

## 3. 文件边界

允许修改：

- `server/index.js`
- `server/mock-data.json`
- `server/package.json` 和 `server/package-lock.json`，仅在确有必要时

禁止修改：

- `src/` 下的所有文件
- 根 `package.json`、`vite.config.js`、`README.md`、`CLAUDE.md`
- 桌宠视频和设计文档

后端依赖只允许现有的 `express` 和 `cors`。不要新增数据库、SDK、HTTP 客户端、测试框架或大模型依赖。

## 4. 不可变技术约束

- Node.js `24.3.x`，npm `11.4.x`
- ESM：`server/package.json` 的 `type` 保持 `module`
- Express 监听 `3001`
- 启用 CORS 和 JSON body 解析
- 所有 Task 02 接口模拟 200–500ms 延迟
- 只监听本地服务，不部署云端
- 不接真实飞书、企微、钉钉，不使用真实 API key、OAuth、Logo 或 URL
- 不调用真实大模型；“AI 解析”必须是写死规则
- 不连接数据库

读取 `mock-data.json` 时使用基于 `import.meta.url` 的 URL 或其他跨平台方式，不要写 `/Users/...`、`C:\\...` 或 `/tmp` 等绝对路径。

## 5. 固定数据契约

`server/mock-data.json` 必须包含顶层 `tasks`、`edges` 和 `coordinates`。

### 5.1 节点与坐标

| id | name | owner | dept | status | isBottleneck | isDelayed | x | y |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: |
| `n_req` | 需求文档 | 王姐 | 产品部 | `done` | false | false | 400 | 80 |
| `n_brand` | 品牌素材 | 陈总 | 设计部 | `doing` | false | true | 200 | 180 |
| `n_design` | 首页设计稿 | 小陈 | 设计部 | `doing` | true | false | 400 | 300 |
| `n_dev` | 前端开发 | 老李 | 研发部 | `todo` | false | false | 300 | 420 |
| `n_test` | 联调测试 | 小赵 | 研发部 | `todo` | false | false | 500 | 420 |
| `n_copy` | 运营文案 | 阿May | 运营部 | `done` | false | false | 600 | 180 |

`tasks` 中保留除 `x/y` 外的节点字段；坐标写入独立的 `coordinates` 对象。`/api/ai/parse` 返回 nodes 时再合并坐标。

### 5.2 连线

| id | from | to | isCritical |
| --- | --- | --- | --- |
| `e1` | `n_req` | `n_brand` | true |
| `e2` | `n_brand` | `n_design` | true |
| `e3` | `n_design` | `n_dev` | true |
| `e4` | `n_dev` | `n_test` | true |
| `e5` | `n_req` | `n_copy` | false |
| `e6` | `n_design` | `n_test` | false |

节点状态只能是小写的 `done | doing | todo`。不要重命名任何 ID 或字段。

## 6. API 契约

已有 `GET /api/health` 可以保留。Task 02 必须新增以下 8 个接口。

### 6.1 假授权

```text
POST /api/feishu/auth
请求：{}
响应：{ "token": "mock-token" }
```

### 6.2 拉取假飞书数据

```text
GET /api/feishu/data?token=mock-token
响应：{ "tasks": [...] }
```

返回 6 个 `tasks`，不要在此接口混入坐标。

### 6.3 本地规则解析

```text
POST /api/ai/parse
请求：{ "tasks": [...] }
响应：{ "nodes": [...], "edges": [...], "pendingApproval": true }
```

- 如果 body 提供 `tasks` 数组，使用该数组；否则回退到 `mock-data.json` 的 6 个 tasks，确保 `{}` 验证请求也能成功。
- 每个 node 根据 `id` 合并 `coordinates[id]` 的 `x/y`。
- edges 原样使用固定 6 条连线。
- 代码注释说明：真实版本会调用 LLM 理解文档/看板/聊天；本 Demo 使用预设结果。

### 6.4 审批

```text
POST /api/ai/approve
请求：{ "nodes": [...], "edges": [...] }
响应：{ "approved": true, "nodes": [...], "edges": [...] }
```

直接返回请求中的 nodes 和 edges，不调用外部服务。

### 6.5 戳一戳

```text
POST /api/poke
请求：{ "from": "小陈", "to": "n_brand" }
```

当 `to === 'n_brand'`：

```json
{
  "message": "陈总好，首页设计稿还差品牌素材，方便今天给我吗？🙏",
  "reply": "收到，10 分钟内发你 🙌",
  "channel": "feishu"
}
```

其他节点：

- `message`：`「{节点名}」快好了吗？下游在等你 👀`
- `reply`：`好，我尽快 👌`
- `channel`：`feishu`

### 6.6 标记完成

```text
POST /api/node/complete
请求：{ "nodeId": "n_design" }
响应：{ "nodeId": "n_design", "notifications": [...] }
```

从 edges 中查找 `from === nodeId` 的直接下游。每条通知使用下游节点负责人，并包含：

```json
{
  "id": "ntf1",
  "to": "老李",
  "type": "upstream_done",
  "message": "上游已完成，你可以开始了",
  "channel": "feishu"
}
```

对 `n_design` 应返回两条通知：`n_dev/老李` 和 `n_test/小赵`，ID 依次为 `ntf1`、`ntf2`。

### 6.7 关灯

```text
POST /api/clock/off
请求：{}
响应：{ "status": "off" }
```

### 6.8 今日指标

```text
GET /api/metrics
响应：{ "doneToday": 3, "alignedPeople": 5, "blocked": 0 }
```

## 7. 实现边界

- 延迟逻辑集中在一个小型 helper 或中间件中，范围固定在 200–500ms。
- 有效请求必须返回 JSON，不能向响应写入调试文本。
- 不要把网络数据复制到前端，也不要改动 GameContext。
- 不实现认证安全、持久化、真实消息发送或真实 AI。
- 不为未来任务预建未要求的抽象层。

## 8. 跨平台验收

启动服务器：

```bash
npm --prefix server start
```

在另一个终端依次运行以下命令；它们使用 Node 内置 `fetch`，可在 macOS、Windows PowerShell 和 Windows CMD 使用：

```bash
node -e "fetch('http://localhost:3001/api/feishu/auth',{method:'POST'}).then(r=>r.json()).then(console.log)"
node -e "fetch('http://localhost:3001/api/feishu/data').then(r=>r.json()).then(x=>console.log(x.tasks.length))"
node -e "fetch('http://localhost:3001/api/ai/parse',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}).then(r=>r.json()).then(x=>console.log(x.pendingApproval,x.nodes.length,x.edges.length))"
node -e "fetch('http://localhost:3001/api/poke',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({from:'小陈',to:'n_brand'})}).then(r=>r.json()).then(console.log)"
node -e "fetch('http://localhost:3001/api/node/complete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({nodeId:'n_design'})}).then(r=>r.json()).then(x=>console.log(x.notifications.length))"
node -e "fetch('http://localhost:3001/api/metrics').then(r=>r.json()).then(console.log)"
```

最低预期：

- auth 返回 `mock-token`
- data 返回 6 个任务
- parse 输出 `true 6 6`
- poke 返回固定 message、reply 和 `feishu`
- complete 输出 `2`
- metrics 返回 `3 / 5 / 0`
- 每个 Task 02 接口实测延迟在 200–500ms
- 服务端控制台无错误

最后执行：

```bash
npm run build
git diff --check
git status --short
```

## 9. 交付要求

完成后报告：

1. 8 个接口逐项是否通过。
2. 实测延迟范围。
3. 改动文件列表。
4. 没通过的项目、原因和阻塞点。
5. 提交到 `feat/backend`，不要自行合并 `main`。
