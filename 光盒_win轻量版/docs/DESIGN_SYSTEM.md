# 光盒 UI Design System

> **给用户看的标准：** [`UI_VISUAL_STANDARD.md`](UI_VISUAL_STANDARD.md)（简单中文，亮/暗主题完整规范）  
> **给开发用的索引：** 本文档

## 1. 目标

- 全产品视觉一致、可维护
- 新功能不自带独立视觉规范
- **亮/暗两套主题：只有颜色不同，字号/圆角/间距/组件尺寸完全相同**
- 深浅主题在 token 层统一切换

## 2. 样式分层

加载顺序（所有入口 HTML 一致，**顺序不可变**）：

```
design-tokens.css → ui-primitives.css → 业务 CSS → dark-desaturated/* → minimax-visual.css
```

| 层级 | 文件 | 职责 |
|------|------|------|
| Token | `static/css/design-tokens.css` | 唯一视觉值来源（`--ui-*`） |
| Primitive | `static/css/ui-primitives.css` | 共享组件基类（`.ui-*`） |
| 业务 | 各 feature CSS | 布局与业务态 |
| 遗留 | `dark-desaturated/*` 等 | 冻结，只修 bug |
| 皮肤 | `minimax-visual.css` | 全局覆盖，末位加载 |

## 3. 基本约定

### 3.1 Token（`--ui-*`）

- 颜色、字号、间距、圆角、阴影、z-index、动效 → 一律走 token
- 新值先在 `design-tokens.css` 登记，再由业务消费
- 深浅主题只在 token 层切换，组件不写 `theme-dark` 颜色分支

### 3.2 组件（`.ui-*`）

- 新 UI 优先使用 `ui-primitives.css` 中的 `.ui-btn`、`.ui-input`、`.ui-menu` 等
- 已有成熟组件（画布节点、composer、侧栏等）可继续沿用，不强制迁移

### 3.3 禁止事项

- 硬编码颜色 / 字号 / 圆角 / 阴影 / 间距 / z-index
- feature 自建 Button / Input / Menu / Dialog / Panel
- 往冻结层（`dark-desaturated/`、`studio-theme-dark.css`）新增代码

## 4. 待梳理清单

以下区域需要在后续迭代中逐步收敛，当前仅作记录：

- [ ] `minimax-visual.css` 中 `!important` 桥接规则的去留
- [ ] 遗留变量（`--mm-*`、`--gh-*`、`--sc-*`）的迁移或删除
- [ ] `dark-desaturated/*` 冻结层的停用计划
- [ ] 存量组件基准清单（哪些继续用、哪些标记 legacy）
- [ ] 窗框颜色 CSS 与 `win_launcher.py` 的同步策略
- [ ] 画布专用 token 与组件的完整列表

## 5. 扩展流程

1. 确认现有 token / primitive 无法表达需求
2. 在 `design-tokens.css` 或 `ui-primitives.css` 登记
3. 更新本文档对应章节
4. feature 再消费

## 6. 关键文件索引

| 用途 | 路径 |
|------|------|
| Design Tokens | `runtime/service/static/css/design-tokens.css` |
| UI Primitives | `runtime/service/static/css/ui-primitives.css` |
| 全局皮肤 | `runtime/service/static/css/minimax-visual.css` |
| 窗口壳 | `runtime/service/static/css/desktop-window-frame.css` |
| 启动器（窗框色） | `runtime/service/win_launcher.py` |
| Agent 规则 | `AGENTS.md` |
