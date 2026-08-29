# 戳戳 Task 01：项目骨架与桌宠设计

## 目标

在仓库根目录建立可本地运行的 React + Vite + Tailwind CSS 前端和 Node.js + Express 后端。入口页只展示固定在右下角的桌宠“灯仔”；桌宠使用仓库已有的 `video/生成灯笼小精灵视频.mp4` 占位。点击桌宠后以 SPA 路由跳转到 `/network`，该页仅显示“网络图 TODO”。本任务不实现网络图、戳一戳、通知、涟漪或其他后续业务。

## 技术与依赖边界

- 前端仅使用 React、Vite、Tailwind CSS、`@tailwindcss/vite`、`@vitejs/plugin-react` 和 `react-router-dom`。
- 后端仅使用 Node.js、Express 和 CORS，监听 `localhost:3001`。
- 不连接真实飞书、企微、钉钉或大模型，不使用真实品牌 Logo，不部署云服务。
- `server/mock-data.json` 保持空对象 `{}`。

## 目录与运行方式

仓库根目录是 Vite 前端项目，包含根 `package.json`、`index.html`、`vite.config.js` 和 `src/`。`server/` 是独立的 ESM Node 包，拥有自己的 `package.json`、入口文件和占位数据文件。

前端通过根目录的 `npm run dev` 启动在 `http://localhost:5173`。后端在 `server/` 安装依赖后，通过仓库根目录执行 `node server/index.js`，监听 3001 端口。

## 前端架构

`src/App.jsx` 负责应用级组合：`GameProvider` 包裹 `BrowserRouter`，路由表只包含 `/` 和 `/network`。未知路径不在本任务范围内，不额外引入错误页或路由依赖。

`src/pages/DeskPetPage.jsx` 提供深色渐变桌面背景和可选提示文字。`src/components/DeskPet.jsx` 提供一个语义化圆形按钮，导入 `video/生成灯笼小精灵视频.mp4`，以静音、自动播放、循环、内联播放的视频呈现灯笼小精灵，并加轻微暖黄色光晕。按钮固定在 `bottom: 24px; right: 24px`，唯一交互是调用 `navigate('/network')`；没有播放器控件、拖拽、菜单、展开状态或额外动画。

`src/pages/NetworkPage.jsx` 调用 `useGame()` 读取 `state.phase`，并用 DOM 属性保留可验证的初始阶段；可见内容只有“网络图 TODO”占位文字，不承载后续任务逻辑。

## 全局状态

`src/context/GameContext.jsx` 使用 `createContext + useReducer`。初始 state 精确保留任务文档要求的字段：

- `phase: 'IDLE'`
- `nodes`、`edges`、`pokes`、`notifications` 为空数组
- `currentUser: '小陈'`
- `integrity: 100`
- `escapeProgress: 0`
- `metrics: { doneToday: 0, alignedPeople: 0, blocked: 0 }`

模块导出 `PHASES`、`GameProvider` 和 `useGame()`。reducer 只预留并实现契约锁定的 8 个 action：`SET_PHASE`、`SET_NODES`、`SET_EDGES`、`ADD_POKE`、`ADD_NOTIFICATION`、`UPDATE_NODE_STATUS`、`SET_METRICS`、`RESET`。未知 action 返回原 state，不引入额外 action 或异步业务。

## API 与后端

`src/api/gameApi.js` 导出 `request(path, options)`。请求基址来自 `import.meta.env.VITE_API_URL || 'http://localhost:3001'`，统一处理 JSON 请求、JSON 响应和非成功状态错误。此任务不调用任何业务 API。

`vite.config.js` 同时配置 React、Tailwind 插件，并把 `/api` 代理到 `http://localhost:3001`，供同机联调使用。

`server/index.js` 启用 CORS 和 Express JSON 解析，只实现 `GET /api/health`，返回 `{ "ok": true }`。其他 8 个业务接口属于后续任务，不在本次创建。

## 错误处理与可访问性

`request()` 在 HTTP 响应非成功时抛出包含状态码的错误；无响应体时返回 `null`。桌宠使用 `<button>` 和明确的 `aria-label`，支持键盘聚焦和触发。视频设为 `muted` 和 `playsInline`，确保浏览器允许无交互自动播放。页面不发起自动网络请求，因此后端未启动时前端控制台也不应报错。

## 验证

1. 分别安装根目录和 `server/` 的依赖。
2. 执行 `npm run build`，确认前端生产构建通过。
3. 执行 `node server/index.js`，再用 `curl http://localhost:3001/api/health` 核对精确 JSON。
4. 执行 `npm run dev`，在真实浏览器打开 `/`，检查右下角视频桌宠的位置、循环播放状态和控制台。
5. 点击桌宠，确认 URL 变为 `/network`、页面显示“网络图 TODO”，并检查 `data-phase="IDLE"`。
6. 检查浏览器控制台在首页和渲染页均无错误。
