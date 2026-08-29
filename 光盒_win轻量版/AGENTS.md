# 光盒 · Agent 开发规则

## 项目形态

- 桌面画布软件（Windows，Python 后端 `runtime/service/` + WebView2 前端）
- 前端为**无构建系统**的原生 HTML/CSS/JS，多入口 iframe 组合
- 静态资源带 `?v=` 版本参数，由 Python 中间件处理缓存

## UI 开发

涉及 UI 时，参考 `docs/DESIGN_SYSTEM.md`。

核心原则：

1. 视觉值走 `design-tokens.css` 的 `--ui-*` 变量
2. 新控件优先用 `ui-primitives.css` 的 `.ui-*` 类
3. 样式加载顺序不可变：`design-tokens.css` → `ui-primitives.css` → 业务 CSS → `dark-desaturated/*` → `minimax-visual.css`
4. 不改变现有业务逻辑；每一行 diff 必须能追溯到任务需求

## 通用约束

- 不做超范围的"顺手改进"
- 与现有代码风格保持一致
