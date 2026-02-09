# st-grok2img

`st-grok2img` 是一个 SillyTavern 扩展，用于通过 Grok2API 生成图片，并将结果回写到当前聊天。

## 功能概览

- 独立弹窗 UI（主设置 / 提示词 / 世界书 / 日志）
- Grok2API 生图（通过 ST 代理 `/api/backends/chat-completions/generate`）
- 提示词预设（保存、另存、导入、导出、删除）
- 世界书核心兼容（`key`、`keysecondary`、`selective`、`selectiveLogic`、`constant`、`order`、`disable`、`caseSensitive`、`matchWholeWords`）
- 变量替换支持 `{{getvar::xxx}}`
- 手动触发与标签自动触发
- 队列串行执行与任务间隔控制
- 结果回写聊天（默认插图，可选附带原文标签）
- 可配置日志上限、日志清理

## 安装

1. 将本仓库放入 SillyTavern 扩展目录（通常为 `SillyTavern/public/scripts/extensions/third-party/`）。
2. 保持目录名为 `st-grok2img`。
3. 重启 SillyTavern 或刷新扩展。
4. 在页面右下角点击 `G2` 按钮打开插件面板。

## 快速配置

在 `主设置` 中填写：

- `API 地址`：Grok2API 网关地址（例如 `http://127.0.0.1:8100`）
- `API Key`：支持粘贴 `Bearer xxx` 或纯 token
- `模型`：默认 `grok-imagine-1.0`
- `自动触发`：是否监听消息标签
- `开始标记` / `结束标记`：默认 `[` 与 `]`
- `间隔毫秒`：队列任务间隔（0 表示不延迟）
- `插入原文标签`：是否将触发片段与图片一并回写

## 使用方式

### 1) 手动生图

在 `主设置 -> 手动生成` 输入提示词后点击 `生成`。

### 2) 自动触发

当开启自动触发后，发送消息包含标签内容即可触发：

- 示例：`请生成一张图 [1girl, city night, cinematic lighting]`
- 支持一条消息多个片段，按队列顺序执行

## 提示词与世界书

### 提示词拼装链

最终 prompt 按以下顺序构造：

1. 原始输入
2. 替换规则（`from => to`）
3. 固定前置
4. 世界书命中内容
5. 固定后置
6. 负面提示词（追加为 `Negative prompt: ...`）

### 世界书

- 默认加载 `defaults/worldbook-default.json`
- 支持世界书预设保存、另存、导入、导出、删除
- `变量` 需填写 JSON 对象，用于替换 `{{getvar::xxx}}`

## 事件

插件会发出以下事件：

- `st_grok2img_generation_started`
- `st_grok2img_generation_succeeded`
- `st_grok2img_generation_failed`

## 返回解析优先级

按以下顺序从响应中取图：

1. `data[0].b64_json`
2. `data[0].url`
3. `choices[0].message.content` 中的 markdown 图片链接

## 常见问题

- **报错 `API key is empty`**：请在主设置填写 API Key。
- **报错 `API base URL is empty`**：请确认 API 地址不为空。
- **超时 `Request timeout`**：检查网关响应速度，或提高 `timeoutMs`（代码默认 60s）。
- **无图返回**：说明响应不包含上述三种可解析格式，请检查上游服务返回体。
- **变量替换为空**：说明 `{{getvar::key}}` 在变量 JSON 中未提供，默认降级为空字符串。

## 开发说明

- 配置根路径：`extensionSettings['st-grok2img']`
- 默认分支：`main`
- 版本：`0.1.0`

