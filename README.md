# 戳戳 Poke

「戳戳」是一个本地运行的协作依赖网络 Demo。桌宠“灯仔”作为入口，点击后进入协作网络页面；后续任务会逐步补齐模拟数据、网络图、戳一戳、通知、涟漪和收尾演出。

## 当前状态

- `main`：Task 01 已完成，包括 React/Vite/Tailwind/React Router 骨架、视频桌宠、全局状态、API 封装和 Express 健康检查。
- `feat/backend`：Task 02 后端开发分支，用于实现本地 Mock API。开始开发前请先阅读 [CLAUDE.md](./CLAUDE.md)。
- 当前 `/network` 只显示“网络图 TODO”，这是预期占位，不要在 Task 02 中实现前端业务。

## 环境要求

- Node.js `24.3.x`
- npm `11.4.x`
- 仅在 localhost 运行，不需要任何真实飞书、企微、钉钉或大模型凭据

版本已记录在 `.nvmrc` 和 `package.json`。三位协作者应使用相同版本。

## 安装依赖

在仓库根目录依次执行：

```bash
npm ci
npm --prefix server ci
```

两个命令均可直接用于 macOS、Windows PowerShell 和 Windows CMD。

## 本地启动

终端 1——前端：

```bash
npm run dev
```

终端 2——后端：

```bash
npm --prefix server start
```

访问地址：

- 前端入口：<http://localhost:5173/>
- 网络页占位：<http://localhost:5173/network>
- 后端健康检查：<http://localhost:3001/api/health>

跨平台健康检查命令：

```bash
node -e "fetch('http://localhost:3001/api/health').then(r => r.text()).then(console.log)"
```

预期输出：

```json
{"ok":true}
```

## 构建

```bash
npm run build
```

构建产物写入 `dist/`，不要提交 `dist/` 或任何 `node_modules/`。

## Task 02 范围

Task 02 只实现 `server/` 下的本地 Mock 后端：

- 假授权与假飞书数据
- 本地规则模拟的 AI 解析和审批
- 戳一戳消息与固定回复
- 节点完成后的下游通知
- 关灯和今日指标

必须新增以下 8 个接口：

| 方法 | 路径 |
| --- | --- |
| POST | `/api/feishu/auth` |
| GET | `/api/feishu/data` |
| POST | `/api/ai/parse` |
| POST | `/api/ai/approve` |
| POST | `/api/poke` |
| POST | `/api/node/complete` |
| POST | `/api/clock/off` |
| GET | `/api/metrics` |

禁止接入真实第三方服务、真实大模型、数据库或云部署。完整字段、数据、响应和验收契约见 [CLAUDE.md](./CLAUDE.md)。

## 目录结构

```text
Poke/
├── src/                    # React 前端；Task 02 不修改
│   ├── api/gameApi.js
│   ├── components/DeskPet.jsx
│   ├── context/GameContext.jsx
│   └── pages/
├── server/                 # Task 02 唯一主要工作区
│   ├── index.js
│   ├── mock-data.json
│   ├── package.json
│   └── package-lock.json
├── video/                  # 桌宠视频素材
├── CLAUDE.md               # Agent 开发契约
├── package.json
└── vite.config.js
```

## 协作约定

1. 后端 Agent 从 `feat/backend` 开始，只修改 Task 02 范围内的文件。
2. 不擅自改变接口字段、枚举、节点 ID 或端口。
3. 提交前运行后端接口验证、`npm run build` 和 `git diff --check`。
4. 不把 `feat/backend` 直接合并进 `main`；先提交并推送该分支，等待人工审查。
