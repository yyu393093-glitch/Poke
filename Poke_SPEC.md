# 「戳戳」项目 Spec —— 演示剧本的可实现规格

> **文档类型：** 实现规格（Spec），不是 PRD、不是分镜，而是「照着能写代码」的工程规格。
> **上游依赖：** [Poke_MVP_PRD.md](./Poke_MVP_PRD.md)（做什么）、[Poke_DEMO_DESIGN.md](./Poke_DEMO_DESIGN.md)（每一秒演什么）。
> **读者：** vibe coding 的 AI / 接手的开发者。目标是——读完这份 spec，能不用再猜，直接把 demo 做出来。

---

## 0. 文档定位与硬约束（先钉死）

这份 spec 只回答一个问题：**如何用代码把「下班前 180 秒」这个演示剧本完整、可复现地做出来，并且满足下面三条铁律。**

| # | 硬约束 | 含义（大白话） |
|---|---|---|
| H1 | **飞书连接 = 模拟** | 不接飞书/企微/钉钉的真实 OAuth、真实 API、真实数据。所有「飞书数据」都是本地假数据。 |
| H2 | **多端交互 = 模拟** | 「桌面悬浮窗」是真的；「飞书/企微/钉钉」这几个端全是**假的迷你窗口**，消息在假窗口之间"演"出来。 |
| H3 | **只本地部署** | 不部署到 Vercel/Netlify/任何云。一条命令在本地跑起来，浏览器打开 `localhost` 即演示。 |

> 这三条是 spec 的地基。**任何违反它们的实现（比如引入飞书开放平台 SDK、上云）都算偏离规格，直接否掉。**

---

## 1. 目标与范围

### 1.1 一句话目标

> 做一个**本地运行的网页**，它看起来是一个「桌面悬浮协作网络图」，能完整复现 [Poke_DEMO_DESIGN.md](./Poke_DEMO_DESIGN.md) 第 5 节的 180 秒分镜（从 17:57 打开，到 18:00 关灯下班）。

### 1.2 纳入（这次要做）

- 仿桌面背景 + 悬浮球（灯仔）入口。
- 协作依赖网络图（节点、连线、上下游、并行/分叉/汇聚、瓶颈、关键路径）。
- 智能任务节点（状态查看 + 「进行中→已完成」更新）。
- 「戳一戳」催进度（自动生成消息 + 灯仔飞行动画 + 地图公开可见）。
- 状态更新自动通知下游（节点点亮）。
- 延期连锁影响（延期标记 + 影响预览）。
- 涟漪展示（下游任务 / 影响部门 / 触达用户）。
- 今日对齐度指标、数据回放。
- 下班关灯（关灯状态 + 时钟）。
- 飞书连接模拟、多端交互模拟。

### 1.3 不纳入（这次不做）

- 真实飞书/企微/钉钉接入（H1 禁止）。
- 移动端、Web 端产品形态（PRD 非目标）。
- 真实多人实时协作（demo 是单机脚本，不是真多人）。
- 真实 AI 大模型调用（「AI 解析」用本地规则模拟，见 4.2）。
- 任何云部署（H3 禁止）。

---

## 2. 技术栈与运行形态

### 2.1 关键决策：用「网页模拟桌面」，不用真桌面应用

PRD 说产品是「桌面悬浮应用」。但 demo 要「模拟飞书、模拟多端、只本地部署」，最省事且效果最好的方案是：

> **做一个全屏网页，把它渲染成一个「假的桌面」**（仿 macOS/Windows 桌面背景）。悬浮球、悬浮窗、假飞书窗口，全都长在这个假桌面上。

理由（说人话）：
1. 「桌面悬浮」用网页就能 100% 还原——一个圆形按钮固定在右下角就是悬浮球，一个可拖拽的层就是悬浮窗。
2. 「多端」如果做真桌面应用，飞书/企微/钉钉就得开多个真进程、真窗口，demo 根本没法演。用网页，假 IM 窗口想开几个开几个，同屏摆着。
3. 只本地部署 = 打开 `localhost` 就完事，不用打包 Electron。

> 这一步和 GAME_DESIGN 里 Phase 1 的「FakeDesktop（假桌面）」是同一个思路——**用网页演一个桌面**。

### 2.2 技术选型（沿用 Poke 现有栈，零新概念）

| 层 | 技术 | 干什么 |
|---|---|---|
| 前端 | React + Vite | 渲染假桌面、网络图、动画、假 IM 窗口 |
| 样式 | Tailwind CSS | 布局 + 配色 + 动效 |
| 本地后端 | Node.js + Express（`server/`） | 扮演「飞书服务器」：吐出假飞书数据、模拟 AI 解析、模拟消息推送 |
| 数据 | 内存 + 一份 `mock-data.json` | 假飞书数据、节点/依赖/通知，全部本地 |

> 为什么要有本地后端？因为「飞书连接」要演得像，前端必须真的发一次请求、后端真的返回一份假数据——这条「请求→返回」链路一跑，观众就信了「数据是从飞书流进来的」。

---

## 3. 系统架构总览

```
┌─────────────────── 浏览器（假桌面，单页）─────────────────────┐
│                                                              │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐                │
│   │ 悬浮球    │   │ 悬浮窗    │   │ 假IM窗口  │                │
│   │ (灯仔)    │   │ (网络图)  │   │ 飞书/企微 │                │
│   └──────────┘   └──────────┘   │ /钉钉     │                │
│                                 └──────────┘                │
│            │              │              │                   │
│            └────── fetch ─┴──────────────┘                   │
│                    (POST /api/...)                            │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌─────────────────── 本地后端（Express）────────────────────────┐
│                                                              │
│  POST /api/feishu/auth     → 假授权，返回假 token             │
│  GET  /api/feishu/data     → 返回 mock-data.json 的任务数据    │
│  POST /api/ai/parse        → 本地规则"解析"出节点+依赖         │
│  POST /api/poke            → 生成戳一戳消息 + 模拟推送到IM端    │
│  POST /api/node/complete   → 标记完成 + 生成下游通知           │
│  POST /api/clock/off       → 关灯                            │
│                                                              │
│  数据源：mock-data.json（写死的假飞书数据）                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. 三大模拟方案（本 spec 的核心）

### 4.1 模拟「桌面悬浮」

| 项 | 实现 |
|---|---|
| 假桌面背景 | 一个全屏 `div`，渐变壁纸 + 底部任务栏 + 右上角时钟（17:57 → 18:00 走秒） |
| 悬浮球 | 固定在右下角的圆形按钮（灯仔 icon），`position: fixed` |
| 悬浮窗 | 点击悬浮球后展开的可拖拽面板，承载网络图；可缩放收起 |
| 关灯后 | 悬浮窗收起回悬浮球，球体变「已下班 🌙」 |

### 4.2 模拟「飞书连接」（对应 PRD 7.1）

**目标：演出一条「授权 → 拉数据 → AI 解析 → 审批 → 生成网络」的完整链路，但不碰真实飞书。**

| 步骤 | 屏幕演出 | 代码真相 |
|---|---|---|
| ① 授权 | 弹一个假「飞书授权」对话框，按钮「授权并接入」 | 点击后 `POST /api/feishu/auth`，后端返回假 `{token:"mock-token"}` |
| ② 拉数据 | 显示「正在同步飞书文档/看板/聊天…」进度 | `GET /api/feishu/data`，返回 `mock-data.json` 里的任务列表 |
| ③ AI 解析 | 网络连线逐层「生长」，节点逐层点亮（demo 里用动画隐喻压缩，不逐字展示） | `POST /api/ai/parse`，后端用**本地规则**（非真 LLM）把任务列表整理成节点+依赖，标记 `pendingApproval` |
| ④ 审批 | 一条「已生成待审批网络」提示一闪而过 | `POST /api/ai/approve`，把 `pendingApproval` 置为 `approved` |
| ⑤ 生成网络 | 正式网络图定格 | 前端用审批后的数据渲染网络 |

> 「AI 解析」**不调真大模型**（1.3 已排除），而是后端写死的解析规则：读到「品牌素材」「首页设计稿」「前端开发」等关键词，就按 mock-data.json 里预设的依赖关系拼出网络。观众看到的是「AI 神奇地解析出了依赖」，实际是写死的结果。

### 4.3 模拟「多端交互」（对应 H2）

**目标：桌面悬浮窗里的「戳一戳」，要"飞"进一个假飞书窗口，让对方在"飞书"里收到。**

| 端 | 形态 | 是否真做 |
|---|---|---|
| 桌面悬浮窗 | 产品本体 | ✅ 真做 |
| 假飞书窗口 | 迷你聊天窗（头像 + 消息气泡） | 🎭 假窗口 |
| 假企微窗口 | 迷你聊天窗 | 🎭 假窗口 |
| 假钉钉窗口 | 迷你聊天窗 | 🎭 假窗口 |

**跨端消息流（一次「戳一戳」）：**

```
1. 用户在悬浮窗点「戳一戳」
2. POST /api/poke  → 后端生成消息，返回 {channel:'feishu', message:'陈总好…'}
3. 前端灯仔飞行动画（悬浮窗 → 假飞书窗口方向）
4. 假飞书窗口新增一条消息气泡（对方的「已读」红点亮起）
5. 悬浮窗网络图上公开显示一条「戳一戳」记录
```

> 三个假 IM 窗口默认**同屏平铺在假桌面下半部**，或按需弹出。demo 里只用「假飞书」一个窗口就够，企微/钉钉作为静态图标收在角落（收尾时露个脸证明「三端都接」）。

---

## 5. 数据模型（字段级定义，可直接建数据）

```typescript
// 任务节点
interface Node {
  id: string;                 // 唯一 id，如 'n_design'
  name: string;               // '首页设计稿'
  owner: string;              // 负责人 '小陈'
  dept: string;               // 部门 '设计部'
  status: 'done' | 'doing' | 'todo';   // 已完成/进行中/未开始
  isBottleneck: boolean;      // 是否瓶颈卡点
  isDelayed: boolean;         // 是否延期（带 ⏰ 标记）
  x: number; y: number;       // 图上坐标
}

// 依赖连线
interface Edge {
  id: string;
  from: string;   // 上游节点 id
  to: string;     // 下游节点 id
  isCritical: boolean;  // 是否关键路径
}

// 戳一戳记录
interface Poke {
  id: string;
  from: string;       // 谁戳
  to: string;         // 戳谁
  message: string;    // 系统自动生成的消息
  channel: 'feishu' | 'wecom' | 'dingtalk';
  time: string;       // '17:57:32'
}

// 通知
interface Notification {
  id: string;
  to: string;                  // 发给谁
  type: 'poke' | 'upstream_done' | 'offline_boundary';
  message: string;
  channel: 'feishu' | 'wecom' | 'dingtalk';
}

// 涟漪影响
interface Ripple {
  downstreamTasks: string[];   // 下游任务 id 列表
  departments: string[];       // ['研发部','运营部']
  reachUsers: number;          // 1200000
}

// 今日对齐度指标
interface DailyMetrics {
  doneToday: number;       // 3
  alignedPeople: number;   // 5
  blocked: number;         // 0
}
```

**预设的 demo 网络（写死在 `mock-data.json`，对应分镜第 3 章拓扑）：**

| id | name | owner | dept | status | isBottleneck | isDelayed |
|---|---|---|---|---|---|---|
| n_req | 需求文档 | 王姐 | 产品部 | done | false | false |
| n_brand | 品牌素材 | 陈总 | 设计部 | doing | false | **true** |
| n_design | 首页设计稿 | 小陈 | 设计部 | doing | **true** | false |
| n_dev | 前端开发 | 老李 | 研发部 | todo | false | false |
| n_test | 联调测试 | 小赵 | 研发部 | todo | false | false |
| n_copy | 运营文案 | 阿May | 运营部 | done | false | false |

连边（关键路径：req→brand→design→dev→test；并行：req→copy）：

```
req → brand → design → dev → test   (关键路径)
req → copy                           (并行分支)
design → dev, design → test          (design 阻塞两个下游)
```

---

## 6. 本地 Mock API 接口规格

> 前端只通过下面这些接口拿数据，**不直接读写 mock-data.json**。这样「飞书连接」的链路才真实。

| 方法 | 路径 | 输入 | 输出 | 对应分镜 |
|---|---|---|---|---|
| POST | `/api/feishu/auth` | `{}` | `{ token: "mock-token" }` | 4.2 ① |
| GET | `/api/feishu/data` | `?token=mock-token` | `{ tasks: [...] }`（6 个任务） | 4.2 ② |
| POST | `/api/ai/parse` | `{ tasks }` | `{ nodes, edges, pendingApproval: true }` | 4.2 ③ |
| POST | `/api/ai/approve` | `{ nodes, edges }` | `{ approved: true, nodes, edges }` | 4.2 ④ |
| POST | `/api/poke` | `{ from, to }` | `{ message, reply, channel }` | 4.3 |
| POST | `/api/node/complete` | `{ nodeId }` | `{ nodeId, notifications: [...] }` | 1:00–1:12 |
| POST | `/api/clock/off` | `{}` | `{ status: "off" }` | 1:50–2:02 |
| GET | `/api/metrics` | `{}` | `{ doneToday, alignedPeople, blocked }` | 1:20 |

> 示例（一次戳一戳）：
> `POST /api/poke {from:'小陈', to:'n_brand'}` → `{message:'陈总好，首页设计稿还差品牌素材，方便今天给我吗？🙏', reply:'收到，10 分钟内发你 🙌', channel:'feishu'}`

---

## 7. 功能模块拆解（对应分镜，可直接派活）

| 模块 | 职责 | 关键点 |
|---|---|---|
| `FakeDesktop` | 假桌面背景 + 任务栏 + 时钟 | 时钟从 17:57 走到 18:00 |
| `FloatingBall` | 悬浮球（灯仔）+ 展开/收起 | 关灯后变「已下班 🌙」 |
| `NetworkGraph` | 渲染节点+连线+关键路径+瓶颈 | 节点按状态上色；瓶颈红呼吸边框 |
| `NodeCard` | 节点详情（负责人/状态/字段/延期） | 悬停展开 |
| `PokeAction` | 戳一戳按钮 + 自动消息 + 灯仔飞行 | 调 `/api/poke` |
| `PokeLog` | 地图上公开的戳一戳记录 | 👍 气泡 |
| `StatusUpdate` | 进行中→已完成 + 颜色切换 | 调 `/api/node/complete` |
| `NotifyDownstream` | 自动通知下游 + 节点点亮 | 用 complete 返回的 notifications |
| `DelayImpact` | 延期标记 + 连锁影响预览 | ⏰ + 影响文案 |
| `RippleView` | 涟漪扩散 + 影响面板 | 波纹动画 + 数字 |
| `MetricsBar` | 今日对齐度指标 | 调 `/api/metrics` |
| `OffClock` | 关灯 + 时钟归零 + 收工 | 调 `/api/clock/off` |
| `FakeIMWindow` | 假飞书/企微/钉钉窗口 | 收戳一戳消息气泡 |
| `EndingScreen` | 标语 + 数据回放 + 平台图标 | 2:02–3:00 |

---

## 8. 分镜 → 功能 → 模块 全覆盖映射表

> 保证 [Poke_DEMO_DESIGN.md](./Poke_DEMO_DESIGN.md) 每一秒都有模块和接口接着，不漏功能。

| 分镜时间码 | 剧本内容 | 触发模块 | 走哪个接口 |
|---|---|---|---|
| 0:00–0:07 | 悬浮球浮现 + 时钟 17:57 | FakeDesktop, FloatingBall | — |
| 0:07–0:11 | 点开 → 网络生长（含飞书授权+解析隐喻） | NetworkGraph | auth→data→parse→approve |
| 0:11–0:15 | 节点按状态点亮 | NetworkGraph | parse 结果 |
| 0:15–0:23 | 瓶颈红框 + 关键路径高亮 | NetworkGraph | — |
| 0:23–0:27 | 延期 ⏰ 标记 | DelayImpact | — |
| 0:27–0:31 | 通知条「阻塞 2 个下游」 | NotifyDownstream | — |
| 0:31–0:36 | 节点详情展开 | NodeCard | — |
| 0:36–0:40 | 延期连锁影响预览 | DelayImpact | — |
| 0:40–0:48 | 戳一戳 + 自动消息 | PokeAction | `/api/poke` |
| 0:48–0:52 | 灯仔飞行 + 公开记录 | PokeAction, PokeLog | poke 返回 |
| 0:52–0:56 | 消息进假飞书窗口（多端交互） | FakeIMWindow | poke 返回的 channel |
| 1:00–1:08 | 标记完成 + 颜色切换 | StatusUpdate | `/api/node/complete` |
| 1:08–1:16 | 自动通知下游 + 节点点亮 | NotifyDownstream | complete 返回 |
| 1:20–1:24 | 今日对齐度指标 | MetricsBar | `/api/metrics` |
| 1:24–1:36 | 涟漪 + 影响面板 | RippleView | — |
| 1:44–2:02 | 收工 + 关灯 + 时钟 18:00 | OffClock | `/api/clock/off` |
| 2:02–3:00 | 标语 + 数据回放 + 三平台图标 | EndingScreen | — |

> 结论：180 秒分镜，**19 个镜头全部落到具体模块和接口**，无孤儿功能。

---

## 9. 状态机（产品状态流转）

```
节点状态：  todo ──▶ doing ──▶ done
                  (下游就绪点亮)  (标记完成)

关灯状态：  on ──(收工)──▶ off
              ↑                │
              └────(重开演示)──┘

演示阶段：  IDLE(17:57) ─▶ OPEN(网络展开) ─▶ ACTIVE(戳/完成/涟漪) ─▶ OFF(18:00)
```

---

## 10. 本地运行与部署（H3）

```bash
# 1. 装依赖（一次性）
npm install
npm --prefix server install

# 2. 启动本地后端（终端 1）—— 扮演「飞书服务器」
npm --prefix server start          # http://localhost:3001

# 3. 启动前端（终端 2）—— 打开假桌面
npm run dev                         # http://localhost:5173
```

- 前端通过 Vite proxy 把 `/api/*` 转发到 `localhost:3001`。
- 所有数据都在 `server/mock-data.json`，**不出本机**。
- **没有**任何云地址、环境变量里的真实密钥、飞书开放平台配置。

---

## 11. 验收标准（怎么算「达到演示剧本」）

对照 [Poke_DEMO_DESIGN.md](./Poke_DEMO_DESIGN.md) 第 14 节，spec 层面再补三条**工程验收**：

| # | 验收项 | 通过标准 |
|---|---|---|
| S1 | 本地可跑 | 两条命令起服务，浏览器打开 `localhost:5173` 能看完整假桌面 |
| S2 | 飞书链路可复现 | 点「授权并接入」→ 网络从空到生成，全程无真飞书请求（看网络面板无 `feishu.cn` 域名） |
| S3 | 多端消息可复现 | 戳一戳后，假飞书窗口出现对应消息气泡，灯仔飞行一次 |
| S4 | 剧本全覆盖 | 第 8 节 19 个镜头全部有对应画面，无一缺失 |
| S5 | 零真实接入 | 代码里搜不到飞书/企微/钉钉的 SDK、真实 API key、云 URL |

---

## 12. 风险与降级（借鉴 GAME_DESIGN）

| 风险 | 降级方案 |
|---|---|
| 网络图动画卡顿 | 节点点亮、连线生长本身可慢，观众看不出卡 |
| 灯仔飞行 / 涟漪动画崩 | 台词已是陈述句，靠画外音兜底（见 DEMO_DESIGN 第 10 节） |
| 后端没起（只开了前端） | 前端对 `/api/*` 做**兜底**：请求失败时用内置的 mock-data 兜底渲染，demo 不崩 |
| 时钟不同步 | 时钟是前端本地 `setInterval` 走秒，与后端无关 |

---

## 13. 待确认（写代码前可先拍板）

1. **假桌面皮肤**：仿 macOS 还是 Windows？（建议 macOS，和"设计岗"氛围更搭）
2. **三端假窗口**：demo 里要不要企微/钉钉也各弹一个窗口，还是只弹飞书、另外两个当图标？（建议后者，省时间）
3. **是否要音效**：戳一戳/关灯要不要配轻音效？（建议加两个极简提示音，提质感）

---

*文档版本 v1.0 | 关联：[Poke_MVP_PRD.md](./Poke_MVP_PRD.md) · [Poke_DEMO_DESIGN.md](./Poke_DEMO_DESIGN.md) | 下一步：按第 7 节模块 + 第 6 节接口，直接开工*
