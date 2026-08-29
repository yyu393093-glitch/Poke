## 1. Harness 与客户端地基

- [ ] 1.1 先为窗口状态机、IPC schema、配置恢复和 Bridge fallback 编写失败测试，并验证 `npm test` 因缺少实现按预期失败
- [ ] 1.2 添加 Electron 及开发启动依赖和 `electron:dev`、`electron:start` 脚本，并验证 `npm install` 与现有 `npm run build` 均成功
- [ ] 1.3 创建 `electron/`、`electron/ipc/`、`electron/windows/`、`electron/services/` 和 `src/platform/` 边界文件，并通过模块导入测试确认 Renderer 不直接依赖 Electron

## 2. IPC 契约与平台 Bridge

- [ ] 2.1 实现白名单通道常量和 Poke/Chat payload 校验，验证合法输入通过且未知字段、空 `teamId`、超长文本、路径和 URL 输入被拒绝
- [ ] 2.2 实现安全 preload，只暴露 OpenSpec 设计列出的 Bridge 方法，并通过契约测试确认不存在任意 `send`、Node 或文件系统入口
- [ ] 2.3 实现 `desktopBridge` 的 Electron 代理与 Web fallback，并验证两种模式暴露相同接口且浏览器构建不包含 Electron 导入

## 3. Electron 生命周期与窗口

- [ ] 3.1 实现单实例主进程和主窗口工厂，验证重复启动只聚焦既有窗口且不创建第二个实例
- [ ] 3.2 实现悬浮窗口的 NOT_CREATED、VISIBLE、BALL、HIDDEN、DESTROYED 状态转换，并通过状态机测试覆盖全部合法转换
- [ ] 3.3 实现托盘的“打开悬浮助手 / 打开主程序 / 完全退出”行为，并通过手工 Smoke 确认关闭窗口只隐藏、托盘退出才结束进程
- [ ] 3.4 注册 `Alt+A` 全局快捷键并实现创建、显示和收球三态行为，验证注册冲突时客户端仍能通过托盘和主程序入口打开助手

## 4. 配置与安全门禁

- [ ] 4.1 实现窗口位置、尺寸、置顶、快捷键和浮球状态的原子 JSON 存储，并通过测试验证正常恢复与损坏配置回退
- [ ] 4.2 实现显示器工作区纠正，验证屏幕外坐标和过小或过大尺寸会恢复到安全可见范围
- [ ] 4.3 配置 BrowserWindow 安全默认值和导航白名单，并验证 `contextIsolation=true`、`nodeIntegration=false`、未授权导航与新窗口被拒绝

## 5. 悬浮助手与戳一戳衔接

- [ ] 5.1 创建独立悬浮助手 Renderer 入口，提供消息列表、多行输入、置顶、浮球、隐藏和离线提示，并验证应用内交互无控制台错误
- [ ] 5.2 将现有 Poke 请求接入 Node `pokeService` 和统一 Bridge，验证相同 `pokeId` 同步进入主窗口日志和悬浮助手且不会重复
- [ ] 5.3 验证悬浮窗口隐藏期间保存待投递 Poke，窗口恢复后展示消息且不会创建第二个窗口
- [ ] 5.4 保留网页 Demo fallback，验证无 Electron 时页面内悬浮窗仍可运行并明确显示“不会真实发送”
- [ ] 5.5 验证 Production 业务失败只显示失败状态，不写成功日志、不向悬浮助手追加已发送消息

## 6. 综合验收与交付

- [ ] 6.1 执行 `npm test`、`npm run build` 和 Production 配置构建，确认测试全绿且无构建警告或敏感信息
- [ ] 6.2 执行 Electron Smoke：主窗口、主程序入口、托盘、`Alt+A`、置顶、浮球、隐藏、完全退出和配置恢复全部通过
- [ ] 6.3 执行戳一戳跨窗口闭环：节点点击、自动消息、公开日志、悬浮助手接收和失败提示全部通过且控制台零错误
- [ ] 6.4 运行 `openspec validate add-electron-client-shell --strict --no-interactive` 并确认 change validation 通过后再提交实现
