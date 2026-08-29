## Why

Poke 的最终交付形态是桌面客户端，但当前实现仅包含 React/Vite 网页渲染层，无法提供系统托盘、全局快捷键、独立悬浮窗口或可靠的跨窗口消息。现在需要建立安全的 Electron 客户端边界，使现有网络图和戳一戳原型成为客户端能力的可复用渲染层，而不是继续在页面组件中堆积平台逻辑。

## What Changes

- 新增 Electron 单实例客户端壳，承载现有 React 主应用。
- 新增独立悬浮助手窗口、托盘菜单、全局快捷键、置顶和浮球状态。
- 新增安全 preload 与白名单 IPC，禁止 Renderer 直接访问 Node/Electron API。
- 新增 Web/Electron 统一 `desktopBridge`，让网页模式保留应用内降级体验。
- 将戳一戳事件通过 Bridge 转发至悬浮助手窗口，同时保留现有网页 Demo 行为。
- 新增窗口位置、尺寸、置顶状态和快捷键配置持久化。
- 明确不读取屏幕、剪贴板、外部文档或本地文件；不在本阶段接入真实 AI、真实 IM 或 Rust 模块。

## Capabilities

### New Capabilities

- `desktop-client-shell`: Electron 单实例、主窗口、托盘、全局快捷键、安全退出与配置恢复。
- `floating-assistant`: 独立悬浮助手的显示、隐藏、浮球、置顶、会话容器和隐私边界。
- `desktop-poke-bridge`: 戳一戳事件在 Renderer、Node 服务和悬浮窗口之间的安全转发与网页降级。

### Modified Capabilities

无。仓库尚未建立 OpenSpec 基线能力，本变更只新增能力。

## Impact

- 新增 `electron/` 主进程、窗口、IPC 和 Node Service 文件。
- 新增 `src/platform/desktopBridge.js` 与悬浮助手渲染入口。
- 调整 `package.json`、Vite 构建入口和极少量主页面挂载代码。
- 引入 Electron 开发依赖及桌面开发脚本。
- A 继续负责 `server/` 真实业务接口；B 保持网络图所有权；C 负责 Electron 和悬浮助手交互。
- 本阶段交付等级为 T2，真实 AI/IM、批量推送或系统划词能力必须另建 T1 OpenSpec change。
