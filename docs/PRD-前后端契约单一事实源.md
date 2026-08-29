# PRD：前后端契约单一事实源（Shared Contract）

> **一句话**：把端口和接口路径从「三处各写一份」收敛成一份 `shared/contract.json`，前端、后端、Vite 全从它读；再加一条校验命令，任一侧改完能立刻验证两边还对得上。
>
> **定位**：本 PRD 是 [00-开发契约.md](../../../../黑客松/00-开发契约.md) 的**可执行化**，不是替代。字段名、枚举、节点 id 一律仍以那份契约为准，本文只负责把「靠人记」变成「靠文件 + 校验」。
>
> 版本 v1.0 ｜ 状态：待评审

---

## 1. 背景与问题

### 1.1 现状：同一个端口写了三份

| 位置 | 内容 | 谁负责（按分工表） |
|---|---|---|
| `server/index.js:7` | `const PORT = 3001;` | A · 后端 |
| `vite.config.js:11` | `target: 'http://localhost:3001'` | 阶段 1 的人（共享文件） |
| `src/api/gameApi.js:2` | `import.meta.env.VITE_API_URL \|\| 'http://localhost:3001'` | 共享文件，三人可改 |

`5173` 另外写在 `vite.config.js:8`。项目里**没有 `.env`**，所以没有任何一处是共同来源。

### 1.2 附带发现：Vite 的 proxy 是死代码

`vite.config.js` 配了 `/api` → `http://localhost:3001` 的代理，但 `gameApi.js` 用的是**绝对地址**，请求根本不走代理。等于维护了一份永远不生效的配置——它一旦和真实端口不一致，也不会有任何报错提示。

### 1.3 后果

A 把后端端口从 3001 改成 3002 时：

- 前端不会有编译错误，Vite 照常启动
- 页面进入 `/network` 后停在「正在同步飞书文档 / 看板 / 聊天…」
- 控制台只有一条 `TypeError: Failed to fetch`，**不指向端口不一致这个根因**
- B 和 C 会先怀疑自己的组件，平均要花 10~20 分钟才定位到是 A 改了端口

在 6 小时的黑客松里，这类「改一处、另一处静默失效」的问题是最贵的。

---

## 2. 目标与非目标

### 2.1 目标

| # | 目标 | 可衡量 |
|---|---|---|
| **G1** | 端口与接口路径只有一处定义 | 全仓库 grep `3001`，只在 `shared/contract.json` 命中 |
| **G2** | 任一侧改完能一条命令验证 match | `npm run contract:check` 输出逐项 PASS/FAIL |
| **G3** | 前端不再需要知道后端端口 | `gameApi.js` 里不出现任何 host/port |
| **G4** | 双向发现漂移 | 后端加了契约外的路由、或前端调了契约外的路径，校验都要报错 |

### 2.2 非目标（本次明确不做）

- ❌ 不改任何业务逻辑、不改 UI（`/network` 静止画面必须仍与定稿图逐像素一致）
- ❌ 不引入新依赖 —— 遵守开发契约禁令第 4 条
- ❌ 不做 TypeScript 类型生成、OpenAPI、代码生成（超出 demo 范围）
- ❌ 不改字段名 / 枚举 / 节点 id —— 那是 00-开发契约的地盘
- ❌ 不上云、不接真实 IM

---

## 3. 方案

### 3.1 新增单一事实源 `shared/contract.json`

放在仓库根的 `shared/`，前后端都能 import（Vite 原生支持 JSON import；Node 侧用 `fs.readFileSync` 读，避免 import attributes 的版本差异）。

```json
{
  "ports": {
    "web": 5173,
    "api": 3001
  },
  "api": {
    "prefix": "/api",
    "endpoints": {
      "health":       { "method": "GET",  "path": "/api/health" },
      "feishuAuth":   { "method": "POST", "path": "/api/feishu/auth" },
      "feishuData":   { "method": "GET",  "path": "/api/feishu/data" },
      "aiParse":      { "method": "POST", "path": "/api/ai/parse" },
      "aiApprove":    { "method": "POST", "path": "/api/ai/approve" },
      "poke":         { "method": "POST", "path": "/api/poke" },
      "nodeComplete": { "method": "POST", "path": "/api/node/complete" },
      "clockOff":     { "method": "POST", "path": "/api/clock/off" },
      "metrics":      { "method": "GET",  "path": "/api/metrics" }
    }
  },
  "enums": {
    "nodeStatus": ["done", "doing", "todo"],
    "phase": ["IDLE", "OPEN", "ACTIVE", "OFF"],
    "channel": ["feishu", "wecom", "dingtalk"],
    "notificationType": ["poke", "upstream_done", "offline_boundary"]
  },
  "fixtures": {
    "nodeIds": ["n_req", "n_brand", "n_design", "n_dev", "n_test", "n_copy"],
    "edgeIds": ["e1", "e2", "e3", "e4", "e5", "e6"],
    "currentUser": "小陈",
    "bottleneck": "n_design",
    "delayed": "n_brand",
    "criticalPath": ["n_req", "n_brand", "n_design", "n_dev", "n_test"]
  }
}
```

> `enums` 和 `fixtures` 是从 00-开发契约第 1、2、4 节**原样搬过来**的，作用是让校验脚本能自动比对，不是新增约定。

### 3.2 三个消费方各接一处

| 文件 | 改动 | 改动量 |
|---|---|---|
| `server/index.js` | `const PORT = contract.ports.api`，路由路径改用 `contract.api.endpoints.*.path` | ~10 行 |
| `vite.config.js` | `server.port` 与 proxy `target` 从 contract 读 | ~5 行 |
| `src/api/gameApi.js` | **base 改为空字符串走 Vite proxy**，路径从 contract 读；保留 `VITE_API_URL` 作为覆盖开关 | ~8 行 |

关键点：`gameApi.js` 改成相对路径 `/api/...` 后，请求走 Vite proxy，**前端从此不需要知道后端端口**（G3）。同时那份原本失效的 proxy 配置也真正生效了。

### 3.3 校验脚本 `scripts/contract-check.mjs`

一条命令跑完三类检查：

**A 类 · 运行时契约（起后端打真接口）**
- 9 个接口逐个请求，断言 HTTP 200
- `/api/feishu/data` 返回的 6 个 task：`id` 必须是 `fixtures.nodeIds` 的集合，`status` 必须属于 `enums.nodeStatus`
- `/api/ai/parse` 返回 6 nodes + 6 edges，`edge.from/to` 必须都在 `nodeIds` 内
- `/api/node/complete` 的 `notifications[].type` 必须属于 `enums.notificationType`
- `/api/metrics` 必须含 `doneToday / alignedPeople / blocked` 三个字段

**B 类 · 静态漂移（防止一边偷偷加东西）**
- 扫 `src/api/gameApi.js` 里所有 `/api/...` 字面量 → 必须都在 contract 的 endpoints 里
- 扫 `server/index.js` 里所有 `app.get/post('...')` → 必须都在 contract 的 endpoints 里
- **双向**：contract 里有、但某一侧没实现，也报 FAIL

**C 类 · 端口一致性**
- 全仓库 grep 裸写的 `3001` / `5173`，除 `shared/contract.json` 外命中即 FAIL

**输出示例**
```
契约校验  shared/contract.json

[运行时]  9/9 接口可达
[运行时]  节点 id / 状态枚举          PASS
[运行时]  连线 from/to 引用           PASS
[静态]    前端调用路径 ⊆ 契约          PASS
[静态]    后端注册路由 ⊆ 契约          PASS
[静态]    契约端点均已实现             FAIL
          └ 契约里有 metrics，server/index.js 未注册
[端口]    无裸写端口                   PASS

7 项通过 / 1 项失败
```

### 3.4 接进 npm scripts

```json
"scripts": {
  "contract:check": "node scripts/contract-check.mjs"
}
```

约定：**每次 merge 回 `main` 之前跑一次**（对应分工文档第 4 节「每个 task 写完立刻 merge」）。

---

## 4. 验收标准

| # | 验收项 | 怎么验 |
|---|---|---|
| AC1 | 端口只有一处定义 | `grep -rn "3001" --exclude-dir=node_modules` 只命中 contract.json |
| AC2 | 改端口不需要动前端 | 把 `ports.api` 改成 3002，重启前后端，`/network` 正常加载 |
| AC3 | 前端无 host/port | `gameApi.js` 里搜不到 `localhost` |
| AC4 | 后端删一个路由能被抓到 | 注释掉 `/api/metrics`，`contract:check` 报 FAIL 并指出是哪个端点 |
| AC5 | 前端加一个契约外路径能被抓到 | 在 gameApi 加 `/api/foo`，`contract:check` 报 FAIL |
| AC6 | 枚举漂移能被抓到 | 把 mock-data 里某个 `status` 改成 `'Done'`，`contract:check` 报 FAIL |
| AC7 | **UI 零回归** | `npm run build` 通过；`/network` 静止画面与定稿图逐像素比对仍为 0 差异；`node scripts/uitest.mjs` 七个场景全通过、控制台无错误 |

> AC7 是硬性红线：本次改动不允许动到任何视觉层。

---

## 5. 影响面与分工

| 文件 | 是否共享文件 | 按分工归属 | 改前要做的事 |
|---|---|---|---|
| `shared/contract.json` | 🆕 新增 | 三人共有 | 新增字段可直接加；**改已有 key 必须群里喊** |
| `server/index.js` | 否 | A · 后端 | A 自己改 |
| `vite.config.js` | 是 | 阶段 1 的人 | 群里喊一声 |
| `src/api/gameApi.js` | **是**（契约 6 节明列） | 三人可改 | ⚠️ 群里喊；只改 base 与路径来源，**不动 `request` 签名** |
| `scripts/contract-check.mjs` | 🆕 新增 | 谁做谁维护 | 无冲突风险 |

**冲突风险评估**：`gameApi.js` 是三个已知冲突文件之一，但本次只改前 2 行的 base 定义和各函数里的路径字面量，`request()` 签名与所有导出函数名保持不变 —— B、C 已写好的调用**不需要改一行**。

---

## 6. 里程碑

| # | 内容 | 预估 | 前置 |
|---|---|---|---|
| M1 | 落 `shared/contract.json` + 三处接线 | 30 min | 无 |
| M2 | `contract-check.mjs`（运行时 + 静态 + 端口三类） | 40 min | M1 |
| M3 | 接 npm script，跑通 AC1–AC7 | 20 min | M2 |

总计约 1.5 小时，可与前端改动并行（M1 完成后前端就已解耦）。

---

## 7. 风险与对策

| # | 风险 | 影响 | 对策 |
|---|---|---|---|
| R1 | 前端改相对路径后，**脱离 Vite 直接开 `dist/index.html`** 会请求不到后端 | 中 | 保留 `VITE_API_URL` 覆盖；预览用 `npm run preview`（Vite 提供同样的 proxy） |
| R2 | contract.json 被打进前端 bundle | 低 | 体积 < 2KB，可忽略；如介意可只 import 需要的子集 |
| R3 | 三人同时改 contract.json 造成冲突 | 中 | JSON 按 key 分区，各改各段；改已有 key 必须先喊 |
| R4 | 校验脚本需要后端在跑，CI 里可能没起 | 低 | 脚本自己 spawn 后端、跑完 kill（与现有 `uitest.mjs` 同样做法） |
| R5 | 过度设计，挤占 demo 时间 | 中 | 严格守住第 2.2 节非目标；不做类型生成 |

---

## 8. 回滚

改动集中在 5 个文件、无数据迁移、无依赖变更。回滚 = `git revert` 单个 commit。

---

*v1.0 ｜ 上游：00-开发契约.md · 00-分工与协作.md ｜ 评审通过后再动手*
