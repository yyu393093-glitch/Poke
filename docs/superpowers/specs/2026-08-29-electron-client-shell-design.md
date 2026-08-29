# Poke Electron 客户端与全局悬浮助手设计

日期：2026-08-29  
交付等级：T2（内部客户端原型）  
目标分支：`feat/electron-float-shell`

## 1. 产品定位

Poke 的最终形态是 Electron 团队协同客户端。现有 React/Vite 网络图、戳一戳和悬浮 IM 是客户端渲染层的前置原型，不是最终产品边界。

本阶段交付一个安全、可运行的桌面壳，把已有业务页面接入客户端，并为全局悬浮助手建立窗口、进程和 IPC 契约。网页模式继续用于快速开发与降级预览，但不提供系统托盘、全局快捷键或跨应用划词承诺。

## 2. 本阶段目标

1. Electron 启动后加载现有 React 主应用。
2. 全局只创建一个主窗口和一个悬浮助手窗口。
3. 支持主程序按钮、托盘菜单和 `Alt+A` 打开或切换悬浮助手。
4. 悬浮助手支持显示、隐藏、置顶、收成浮球、恢复和位置尺寸记忆。
5. 点击悬浮窗关闭按钮只隐藏窗口；仅托盘“完全退出”结束进程。
6. 戳一戳事件可通过安全 IPC 转发给悬浮窗口。
7. Electron 与网页版共用 React 业务组件，通过平台 Bridge 隔离运行环境差异。

## 3. 明确不做

- 不接入真实飞书、企业微信或钉钉。
- 不接入真实 AI 模型；`/api/ai/chat` 先保留契约或使用本地演示响应。
- 不静默读取屏幕、剪贴板、文档或本地文件。
- 不实现系统级划词抓取。
- 不引入 Rust；当前工作以窗口控制和网络 I/O 为主，Node 足够。
- 不完成安装包签名、自动更新和公开生产发布。

## 4. 架构

```text
React Renderer
  网络图 / 戳一戳 / 悬浮助手 UI
          │
          ▼
src/platform/desktopBridge.js
  Web fallback / Electron IPC 统一接口
          │
          ▼
electron/preload.js
  contextBridge 白名单、参数序列化
          │
          ▼
electron/main.js + electron/ipc/
  单实例、窗口、托盘、热键、IPC 校验
          │
          ▼
electron/services/
  Poke、Chat、Config、Session 业务服务
          │
          ▼
server/ 或外部 AI / IM 适配器（后续）
```

Electron 主进程只负责生命周期和调度。消息生成、会话、权限和推送位于 Node Service；若以后出现 OCR、大文件解析或本地向量计算，再迁移至 `utilityProcess`、`worker_threads` 或 Rust 原生模块。

## 5. 目录与所有权

```text
electron/
├─ main.js
├─ preload.js
├─ ipc/
│  ├─ contracts.js
│  └─ handlers.js
├─ windows/
│  ├─ mainWindow.js
│  └─ floatWindow.js
└─ services/
   ├─ configStore.js
   ├─ pokeService.js
   └─ chatService.js

src/
├─ features/assistant/
│  ├─ AiFloatWindow.jsx
│  └─ assistantModel.js
└─ platform/
   └─ desktopBridge.js
```

- A 负责 `server/`、真实 AI/IM、团队权限和推送状态。
- B 负责网络图、节点状态和交互锚点。
- C 负责 `electron/`、悬浮助手 UI、窗口行为与交互演出。
- `electron/ipc/contracts.js` 由 Electron 负责人维护；字段变更必须同步 Bridge 测试。
- `NetworkPage.jsx` 只挂入口和事件桥，不保存 Electron 窗口生命周期状态。

## 6. 平台 Bridge 契约

渲染组件只能调用：

```js
desktopBridge.isDesktop()
desktopBridge.openAssistant()
desktopBridge.toggleAssistant()
desktopBridge.setAssistantAlwaysOnTop(enabled)
desktopBridge.sendPoke(payload)
desktopBridge.sendChat(payload)
desktopBridge.onPokeReceived(listener)
desktopBridge.onSessionUpdated(listener)
```

网页版 fallback 在页面内打开悬浮组件；Electron 实现通过 preload 调用 IPC。业务组件禁止直接导入 `electron`、访问 Node API 或保存密钥。

## 7. IPC 数据契约

### 7.1 Poke

```js
{
  from: '小陈',
  to: 'n_brand',
  teamId: 'team-demo'
}
```

主进程校验字段、调用 `pokeService`，返回：

```js
{
  pokeId: 'poke-xxx',
  message: '陈总好，……',
  channel: 'feishu',
  pushStatus: 'success' | 'fail'
}
```

### 7.2 Chat

```js
{
  sessionId: 'session-demo',
  teamId: 'team-demo',
  query: '总结这段内容',
  useTeamKnowledge: false
}
```

所有字符串设置长度上限；拒绝未知字段、空 `teamId`、空查询和非法渠道。Electron IPC 不接受任意文件路径、命令或 URL。

## 8. 窗口状态机

悬浮助手状态：

```text
NOT_CREATED → VISIBLE → BALL → VISIBLE
                  │         │
                  └→ HIDDEN ←┘

托盘完全退出：任意状态 → DESTROYED → app.quit()
```

- 第一次唤起创建窗口并恢复配置。
- 隐藏状态唤起：显示、置顶、聚焦输入框。
- 可见状态按 `Alt+A`：收为浮球。
- 浮球点击：恢复完整窗口。
- 关闭按钮：进入 `HIDDEN`，不销毁会话。
- 应用启用单实例锁；第二次启动只聚焦已有窗口。

## 9. 配置与会话

配置存入 Electron `userData` 目录下的 JSON 文件，采用临时文件写入后原子替换，避免异常退出损坏：

```json
{
  "position": { "x": 1200, "y": 200 },
  "size": { "width": 420, "height": 600 },
  "alwaysOnTop": false,
  "globalHotkey": "Alt+A",
  "isMinToFloatBall": false
}
```

读取时执行 schema 校验并限制窗口必须落在当前显示器可见范围。V1.0 会话先由 Node 层内存维护并同步两个窗口；持久化接口保留，真实团队会话由 A 的服务接管。

## 10. 安全边界

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`（若依赖兼容）
- 禁止 `remote` 模块和任意 IPC 通道透传。
- preload 仅暴露本设计列出的函数。
- 导航仅允许本地 Vite 开发地址或打包后的本地文件。
- 拒绝新窗口、任意外链跳转和未经验证的协议。
- API key、Webhook 和访问令牌不得进入 Renderer、环境示例或 Git。
- 不主动读取剪贴板、屏幕、文档和文件系统。

## 11. 错误处理

- 热键注册冲突：保留托盘与主程序入口，并显示可理解的设置提示。
- 配置文件损坏：恢复安全默认值，不阻止应用启动。
- AI/IM 请求失败：返回结构化失败状态；Renderer 不伪造生产成功。
- 悬浮窗口崩溃：允许下一次唤起重新创建，主窗口不退出。
- 主服务不可用：悬浮助手展示离线提示，保留未发送输入。

## 12. 验收与 Harness

### 自动化

- IPC schema：合法输入通过，未知字段、空团队和超长文本拒绝。
- 窗口状态机：创建、显示、隐藏、浮球、恢复、销毁。
- 配置：保存恢复、损坏回退、屏幕外位置纠正。
- Bridge：Web fallback 与 Electron preload 暴露相同方法。
- Poke：Production 失败不写成功日志。

### 手工 Smoke

```text
npm run electron:dev
→ 主窗口显示现有网络图
→ 主程序入口打开独立悬浮助手
→ Alt+A 收球/恢复
→ 戳一戳消息进入悬浮助手
→ × 隐藏但托盘仍存在
→ 托盘完全退出
→ 重启恢复位置、尺寸和置顶状态
```

### 交付门禁

本阶段为 T2：必须通过 lint、单元测试、生产构建、Electron smoke 和无敏感信息扫描，才允许合并。真实 IM、真实 AI、批量消息或外部划词升级为 T1，需增加权限、限流、审计和失败重试门禁。

## 13. 首个实施切片

只交付 Electron 安全壳、双窗口、托盘、热键、配置恢复、Bridge 和现有 Poke 事件转发。AI 输入与会话 UI 只提供可扩展容器，不在此切片内伪造“已接入真实 AI”。
