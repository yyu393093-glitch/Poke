# 任务 02：本地 Mock 后端（飞书连接模拟）

## 开发目的
实现本地 mock 后端，模拟「飞书连接」的完整链路：**授权 → 拉数据 → AI 解析 → 审批 → 生成网络**，以及戳一戳、标记完成、关灯、指标四个动作接口。全部数据来自 `mock-data.json`，不接真实飞书、不调真实大模型（H1/H3）。

## 前置依赖
- 任务 01 完成（Express 骨架 + `mock-data.json` 占位 + `gameApi.js` 封装就绪）

## 需要完成的事项

### 1. 假飞书数据 — `server/mock-data.json`

写入以下内容（字段和 00-总览数据模型一致）：

```json
{
  "tasks": [
    { "id": "n_req",    "name": "需求文档",  "owner": "王姐",  "dept": "产品部", "status": "done",  "isBottleneck": false, "isDelayed": false },
    { "id": "n_brand",  "name": "品牌素材",  "owner": "陈总",  "dept": "设计部", "status": "doing", "isBottleneck": false, "isDelayed": true  },
    { "id": "n_design", "name": "首页设计稿","owner": "小陈",  "dept": "设计部", "status": "doing", "isBottleneck": true,  "isDelayed": false },
    { "id": "n_dev",    "name": "前端开发",  "owner": "老李",  "dept": "研发部", "status": "todo",  "isBottleneck": false, "isDelayed": false },
    { "id": "n_test",   "name": "联调测试",  "owner": "小赵",  "dept": "研发部", "status": "todo",  "isBottleneck": false, "isDelayed": false },
    { "id": "n_copy",   "name": "运营文案",  "owner": "阿May", "dept": "运营部", "status": "done",  "isBottleneck": false, "isDelayed": false }
  ],
  "edges": [
    { "id": "e1", "from": "n_req", "to": "n_brand", "isCritical": true },
    { "id": "e2", "from": "n_brand", "to": "n_design", "isCritical": true },
    { "id": "e3", "from": "n_design", "to": "n_dev", "isCritical": true },
    { "id": "e4", "from": "n_dev", "to": "n_test", "isCritical": true },
    { "id": "e5", "from": "n_req", "to": "n_copy", "isCritical": false },
    { "id": "e6", "from": "n_design", "to": "n_test", "isCritical": false }
  ],
  "coordinates": {
    "n_req":   { "x": 400, "y": 80 },
    "n_brand": { "x": 200, "y": 180 },
    "n_copy":  { "x": 600, "y": 180 },
    "n_design":{ "x": 400, "y": 300 },
    "n_dev":   { "x": 300, "y": 420 },
    "n_test":  { "x": 500, "y": 420 }
  }
}
```

### 2. 服务器与路由 — `server/index.js`

把任务 01 的占位端点替换为完整路由，全部挂到 `/api` 前缀。所有响应都模拟真实飞书的延迟（`setTimeout 200~500ms`），让「数据从飞书流进来」有真实感。

| 方法 | 路径 | 逻辑 | 返回 |
|---|---|---|---|
| POST | `/api/feishu/auth` | 直接成功 | `{ token: "mock-token" }` |
| GET | `/api/feishu/data` | 读 mock-data.json 的 tasks | `{ tasks: [...] }` |
| POST | `/api/ai/parse` | 见下方「本地 AI 解析规则」 | `{ nodes, edges, pendingApproval: true }` |
| POST | `/api/ai/approve` | 直接放行 | `{ approved: true, nodes, edges }` |
| POST | `/api/poke` | 见下方「戳一戳消息 + 领导回复生成」 | `{ message, reply, channel }` |
| POST | `/api/node/complete` | 见下方「完成通知」 | `{ nodeId, notifications: [...] }` |
| POST | `/api/clock/off` | 直接成功 | `{ status: "off" }` |
| GET | `/api/metrics` | 返回固定指标 | `{ doneToday: 3, alignedPeople: 5, blocked: 0 }` |

### 3. 本地「AI 解析」规则（模拟，不调真 LLM）

`POST /api/ai/parse` 收到 tasks 后，**用写死的规则**返回节点和连线，不调用任何大模型：

- 直接把 tasks 映射为 nodes（补上 `coordinates` 里的坐标）
- 直接把 mock-data.json 的 edges 原样返回
- 给返回体加 `pendingApproval: true`（表示「待审批」，制造审批环节）
- 规则注释里写清楚：真实版本这里会调 LLM 从飞书文档/看板/聊天里「读懂」依赖，本 demo 用预设结果代替

### 4. 「戳一戳」消息 + 领导回复生成

`POST /api/poke { from, to }` 根据 `to` 节点生成一句得体消息，同时生成领导的回复（都写死模板）：

- `to === 'n_brand'`（催陈总）→ 发出的消息：`"陈总好，首页设计稿还差品牌素材，方便今天给我吗？🙏"`
- 其余情况 → 发出的消息：`"「{to 节点名}」快好了吗？下游在等你 👀"`
- 同时生成领导的回复 `reply`（写死，供桌宠飞回时展示）：
  - `to === 'n_brand'`（陈总）→ `reply: "收到，10 分钟内发你 🙌"`
  - 其余情况 → `reply: "好，我尽快 👌"`
- 返回 `{ message, reply, channel: 'feishu' }`（demo 统一走飞书数据源）

### 5. 「标记完成」自动通知下游

`POST /api/node/complete { nodeId }`：

- 从 edges 里找出所有 `from === nodeId` 的边，取这些边的 `to` 作为「直接下游」
- 为每个下游生成一条通知：`{ type: 'upstream_done', message: '上游已完成，你可以开始了', channel: 'feishu' }`
- 返回 `{ nodeId, notifications: [...] }`

## 约束
- **不要**引入任何真实飞书/企微/钉钉 SDK、真实 API key、真实 URL（H1）
- **不要**调用真实大模型 API（AI 解析是写死规则）
- **不要**连接数据库，所有数据读 `mock-data.json`
- 不要上云，只监听 `localhost:3001`（H3）

## 验证方法
1. `curl -X POST http://localhost:3001/api/feishu/auth` 返回 `{"token":"mock-token"}`
2. `curl http://localhost:3001/api/feishu/data` 返回 6 个任务
3. `curl -X POST http://localhost:3001/api/ai/parse -H "Content-Type: application/json" -d '{}'` 返回 `pendingApproval: true` 和 6 节点 6 连线
4. `curl -X POST http://localhost:3001/api/poke -H "Content-Type: application/json" -d '{"from":"小陈","to":"n_brand"}'` 返回 `{ message, reply, channel }`，其中 `reply` 为 `"收到，10 分钟内发你 🙌"`
5. `curl -X POST http://localhost:3001/api/node/complete -H "Content-Type: application/json" -d '{"nodeId":"n_design"}'` 返回 2 条下游通知（n_dev、n_test）
6. `curl http://localhost:3001/api/metrics` 返回 `{"doneToday":3,"alignedPeople":5,"blocked":0}`
7. 所有接口响应有 200~500ms 延迟，console 无报错
