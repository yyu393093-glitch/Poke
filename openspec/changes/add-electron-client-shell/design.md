## Context

当前仓库以 React 19、Vite、Tailwind CSS 和本地 Node/Express 为基础。网络图和戳一戳已经能在网页模式运行，但 Electron、跨窗口会话、托盘、热键和配置存储尚不存在。`NetworkPage.jsx` 曾同时承担地图与交互状态，后续必须通过平台 Bridge 防止 Renderer、Electron 生命周期和 Node 业务再次耦合。详见 `proposal.md` 与三个 delta specs。

## Goals / Non-Goals

**Goals:**

- 让现有 React 应用在安全 Electron 壳中运行，同时保持浏览器开发预览。
- 用稳定 Bridge 契约隔离 Web 与 Electron 差异。
- 将窗口生命周期放在 Electron 主进程，将消息和会话逻辑放在 Node Service。
- 保持 A/B/C 文件所有权清晰，使 Electron 合并不要求重写网络图。

**Non-Goals:**

- 不把真实 AI、真实 IM、团队权限或消息队列伪装成本阶段已完成能力。
- 不实现安装包签名、自动更新、系统级划词或文件读取。
- 不引入 Rust；当前主要负载是窗口调度和网络 I/O。

## Decisions

### Decision: 使用同仓库 Electron Wrapper

Electron 主进程与 React Renderer 位于同一仓库，Vite 继续负责渲染层开发和构建。这样可以复用现有页面、测试和数据契约，避免两个仓库产生版本漂移。

备选方案是独立客户端仓库，边界更强但会增加当前 MVP 的发布、同步和依赖管理成本；本阶段不采用。

### Decision: 使用 Platform Bridge，而非组件内环境判断

`src/platform/desktopBridge.js` 暴露桌面和网页都具备的接口。Electron 模式通过 preload 白名单 IPC 实现，网页模式使用应用内 fallback。组件不得导入 Electron 或直接判断 `process`。

备选方案是在每个组件中使用 `window.electron` 分支，短期代码少但会造成测试困难和平台逻辑扩散；不采用。

### Decision: 主进程只管理生命周期，业务进入 Node Service

Electron 主进程负责单实例、窗口、托盘、快捷键和 IPC 调度。Poke、Chat、Config、Session 分别进入服务模块。后续 CPU 密集任务优先进入 `utilityProcess` 或 `worker_threads`，只有原生系统能力或明确性能瓶颈才评估 Rust/N-API。

### Decision: 双窗口共享事件源

主窗口与悬浮窗口不互相直接持有 React 状态。Node 层保存当前会话和待投递事件，通过 IPC 广播同一结构化消息。隐藏窗口恢复时读取待投递事件，避免丢失或重复创建窗口。

### Decision: 配置使用原子 JSON 存储

窗口配置保存至 Electron `userData`，写入临时文件后原子替换。读取时进行 schema 校验并将屏幕外坐标纠正至当前显示器工作区。该方案足以覆盖少量本地配置，无需提前引入数据库。

### Decision: 安全默认值

BrowserWindow 使用 `contextIsolation: true`、`nodeIntegration: false`，在依赖兼容时启用 sandbox。preload 仅暴露列明方法；所有 IPC 输入拒绝未知字段、空团队、超长文本、任意路径、命令和 URL。导航只允许开发期本地 Vite 地址与打包后的本地资源。

## Risks / Trade-offs

- [托盘图标缺少正式资产] → 首个切片使用仓库内占位资产，并将视觉替换留给 C，不影响行为验收。
- [全局快捷键与系统软件冲突] → 注册失败时保留托盘和主程序入口，并返回可见错误。
- [开发模式依赖 Vite 服务启动顺序] → Electron 开发脚本显式等待 Vite 端口后再启动主进程。
- [跨窗口事件重复] → 以 `pokeId`/`sessionId` 去重，并由 Node 层作为唯一事件源。
- [配置异常导致窗口不可见] → schema 校验、默认值和显示器工作区纠正共同兜底。
- [Electron 增加依赖和包体] → 本阶段接受桌面运行时开销，不引入额外 UI 框架或原生模块。

## Migration Plan

1. 在现有 `feat/poke-functional` 基础上引入 Electron，不改变浏览器运行命令。
2. 先落 IPC schema、窗口状态机和 Bridge 测试，再创建主进程与窗口。
3. 将现有 Poke 回调接入 Bridge；网页 fallback 保持当前行为。
4. 跑 Node 单测、Vite 构建和 Electron 手工 Smoke。
5. 若客户端启动阻断，回滚 Electron 相关提交即可恢复既有网页分支；不修改 A 的 `server/` 数据契约。
