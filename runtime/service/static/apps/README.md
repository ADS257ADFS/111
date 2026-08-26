# Static Apps（纯净版功能模块）

与 `static/deprecated/`、`static/js/shell/` 分离，按功能独立目录：

| 目录 | 入口 | 说明 |
|------|------|------|
| `studio-coding/` | `agent-chat.html` | Studio Coding Agent 全页 Tab |
| `gpt-dock/` | `gpt-chat.html` | GPT 对话（全页 Tab + 画布 Dock `?dock=1`） |

壳层 `index.html` 通过 iframe 加载；完整目录说明见 [`docs/frontend-layout.md`](../../docs/frontend-layout.md)。
