# 光盒 · Agent 开发规则

## 项目形态

- 桌面画布软件(Windows,Python 后端 `runtime/service/` + WebView2 前端)。
- 前端为**无构建系统**的原生 HTML/CSS/JS,多入口 iframe 组合:壳 `static/index.html`、画布 `static/smart-canvas.html`、对话 `static/apps/gpt-dock/`、设置 `static/api-settings.html` 等,iframe 间用 postMessage 通信。
- 静态资源带 `?v=` 版本参数,由 Python 中间件处理缓存。

## UI 开发规则(强制)

**任何涉及 UI 的任务,第一步是通读 `docs/DESIGN_SYSTEM.md`。**

1. 检查已有共享组件:先查 `static/css/ui-primitives.css`(`.ui-*` 类)和 DESIGN_SYSTEM.md §4 的存量基准清单。
2. 优先复用已有组件;不为统一而重写现有成熟组件。
3. 一律使用 design tokens:颜色/字号/间距/圆角/阴影/z-index/动效全部取 `static/css/design-tokens.css` 的 `--ui-*` 变量。
4. **禁止** feature 自己实现 Button / Input / Menu / Dialog / Panel 等基础控件。
5. **禁止**随意创造新的颜色值、字号、圆角、阴影、间距、z-index 裸数字。
6. Design System 无法满足需求时:先在 `design-tokens.css` / `ui-primitives.css` 登记新 token 或变体,并同步更新 `docs/DESIGN_SYSTEM.md`,然后 feature 才能消费。
7. 深浅主题只在 token 层切换,组件代码不写 `theme-dark` 颜色分支。
8. 冻结层(`static/css/dark-desaturated/`、`studio-theme-dark.css`、`canvas.html` 的 legacy 组件)只修 bug,不新增代码。
9. 高风险区见 DESIGN_SYSTEM.md §7:窗框颜色需 CSS 与 `runtime/service/win_launcher.py` 两处同步;主题双类名机制、`minimax-visual.css` 的 `!important` 桥接、`#promptInput` contenteditable 不得擅动。

## 通用约束

- 不改变现有业务逻辑与功能行为;每一行 diff 必须能追溯到任务需求。
- 不做超范围的"顺手改进";与现有代码风格保持一致。
- 样式加载顺序不可变:`design-tokens.css` → `ui-primitives.css` → 业务 CSS → `dark-desaturated/*` → `minimax-visual.css`。
