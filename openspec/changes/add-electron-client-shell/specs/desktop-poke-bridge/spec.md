## Purpose

在网络图、Node 业务服务和悬浮助手之间建立稳定且受校验的戳一戳消息通道，使桌面端可以跨窗口展示事件，同时保留网页演示模式的可运行降级路径。

## ADDED Requirements

### Requirement: 戳一戳请求经过统一 Bridge
Renderer MUST 通过统一平台 Bridge 提交戳一戳请求，不得直接调用 Electron、Node 模块或真实 IM Webhook。

#### Scenario: 桌面端发送合法请求
- **WHEN** Renderer 提交包含 `from`、`to` 和 `teamId` 的合法戳一戳请求
- **THEN** Bridge 将请求交给 Node 业务服务处理
- **AND** 返回包含 `pokeId`、`message`、`channel` 和 `pushStatus` 的结构化结果

#### Scenario: 请求字段非法
- **WHEN** 请求缺少团队 ID、包含未知字段或字符串超过允许长度
- **THEN** Bridge 拒绝请求且不触发消息生成或推送

### Requirement: 桌面端向悬浮助手广播成功事件
桌面客户端 SHALL 将成功生成的戳一戳事件发送给唯一悬浮助手窗口，并保留主窗口公开日志。

#### Scenario: 悬浮窗口当前隐藏
- **WHEN** 戳一戳成功且悬浮助手处于隐藏状态
- **THEN** 客户端保存事件供窗口恢复后展示
- **AND** 不创建重复悬浮窗口

#### Scenario: 悬浮窗口当前可见
- **WHEN** 戳一戳成功且悬浮助手可见
- **THEN** 悬浮助手追加自动生成的只读消息
- **AND** 主窗口公开日志追加同一 `pokeId` 的记录

### Requirement: 生产失败不得伪装成功
生产模式 MUST 在业务服务或真实推送失败时返回失败状态，不得生成本地成功结果或成功日志。

#### Scenario: 生产请求失败
- **WHEN** Node 业务服务返回失败或不可达
- **THEN** Renderer 显示明确失败提示
- **AND** 悬浮助手不追加已发送消息
- **AND** 公开日志不记录成功发送

### Requirement: 网页模式保留演示降级
网页演示模式 SHALL 在无 Electron Bridge 时继续使用应用内悬浮层和本地演示消息，并明确标注不会真实发送。

#### Scenario: 网页 Demo 后端不可用
- **WHEN** 网页演示模式提交戳一戳且本地接口不可用
- **THEN** 页面生成演示消息并更新应用内日志与悬浮层
- **AND** 页面明确标注该行为不是外部 IM 推送
