# 光盒 UI Design System

> **给用户看的标准：** [`UI_VISUAL_STANDARD.md`](UI_VISUAL_STANDARD.md)（简单中文，亮/暗主题完整规范）  
> **给开发用的索引：** 本文档

## 1. 目标

- 全产品视觉一致、可维护
- 新功能不自带独立视觉规范
- **亮/暗两套主题：只有颜色不同，字号/圆角/间距/组件尺寸完全相同**
- 深浅主题在 token 层统一切换
- **悬浮层统一磨砂浮层**（80% 透明 + `blur(80px)`，见视觉标准第八章）

## 2. 样式分层

加载顺序（所有入口 HTML 一致，**顺序不可变**）：

```
design-tokens.css → ui-primitives.css → 业务 CSS → dark-desaturated/* → minimax-visual.css
```

| 层级 | 文件 | 职责 |
|------|------|------|
| Token | `static/css/design-tokens.css` | 唯一视觉值来源（`--ui-*`） |
| Primitive | `static/css/ui-primitives.css` | 共享组件基类（`.ui-*`、目标 `.ui-float`） |
| 业务 | 各 feature CSS | 布局与业务态 |
| 遗留 | `dark-desaturated/*` 等 | 冻结，只修 bug |
| 皮肤 | `minimax-visual.css` | 全局覆盖，末位加载；画布网格当前在此 |

## 3. 基本约定

### 3.1 Token（`--ui-*`）

- 颜色、字号、间距、圆角、阴影、磨砂、z-index、动效 → 一律走 token
- 新值先在 `design-tokens.css` 登记，再由业务消费
- 深浅主题只在 token 层切换，组件不写 `theme-dark` 颜色分支

### 3.2 组件（`.ui-*`）

- 新 UI 优先使用 `ui-primitives.css` 中的 `.ui-btn`、`.ui-input`、`.ui-menu`、`.ui-float` 等
- 已有成熟组件（画布节点、composer、侧栏等）可继续沿用，不强制一次性迁移

### 3.3 磨砂浮层（v10 定稿，待落地）

样板类名 `.lb-float`，产品目标类名 **`.ui-float`**：

| Token（待登记） | 值 |
|-----------------|-----|
| `--ui-glass-bg` | 亮 `rgba(255,255,255,.80)` / 暗 `rgba(35,35,35,.80)` |
| `--ui-glass-filter` | `blur(80px) saturate(160%)` |
| `--ui-shadow-float` | 亮 `0 4px 18px rgba(0,0,0,.12)` / 暗 `0 4px 16px rgba(0,0,0,.30)` |
| `--ui-radius-float` | `16px` |

**适用范围：** 全部下拉/上拉菜单、右键菜单、生成栏、框选胶囊工具栏、图片工具栏、小地图等。  
**例外：** 生成栏上方窄工具栏 `box-shadow: none`；侧栏/顶栏/对话栏主体无交界处投影。

### 3.4 画布网格（v10 定稿，部分在 minimax-visual.css）

| Token | 值 |
|-------|-----|
| `--ui-canvas-grid-size` | `18px` |
| `--ui-canvas-grid-dot-size` | `0.6px`（渐隐至 `1.1px`） |
| `--ui-canvas-grid-dot` | 亮 `rgba(0,0,0,.11)` / 暗 `rgba(255,255,255,.055)` |

### 3.5 字号（v10 定稿）

| Token（待统一命名） | 值 | 用途 |
|---------------------|-----|------|
| `--ui-type-display` | `18px` | 弹窗标题 |
| `--ui-type-body` | `16px` | 菜单、按钮、对话、生成栏 |
| `--ui-type-compact` | `14px` | 资产树、搜索框 |
| `--ui-type-meta` | `13px` | 快捷键、积分 |
| `--ui-weight-body` | `380` | 控件正文 |
| `--ui-weight-latin` | `350` | 英文/数字 |

### 3.6 禁止事项

- 硬编码颜色 / 字号 / 圆角 / 阴影 / 间距 / z-index
- feature 自建 Button / Input / Menu / Dialog / Panel / Float
- 悬浮层混用实色底与不同 blur 值
- 往冻结层（`dark-desaturated/`、`studio-theme-dark.css`）新增代码

## 4. 视觉样板（定稿参考，不改产品代码）

| 路径 | 说明 |
|------|------|
| `docs/prototypes/spectrum-full-shell.html` | **v10 完整壳层样板**（主参考） |
| `docs/prototypes/build_full_shell.py` | 样板生成脚本，改样式后运行重建 HTML |
| `docs/prototypes/打开视觉样板.bat` | 双击打开 |
| `docs/prototypes/字体说明.html` | 字号字重对照 |
| `docs/prototypes/README.md` | 打开方式与反馈说明 |

样板分支：`cursor/spectrum-visual-prototypes-58b1`（PR #86）。  
规范文档分支：`cursor/cleanup-design-rules-58b1`（PR #85）。

**阶段划分：**

1. **当前（A）：** 样板 + 规范定稿 ← 进行中
2. **下一步（B）：** token / primitive 落地 → 菜单 → 生成栏 → 画布浮层 → 壳层
3. **之后（C）：** 技术债（`minimax-visual.css` 的 `!important`、`dark-desaturated/` 停用）

## 5. 待梳理清单

- [ ] 登记 `--ui-glass-*`、`--ui-radius-composer*` 等 v10 token
- [ ] 实现 `.ui-float` primitive，替换各 feature 浮层样式
- [ ] `minimax-visual.css` 中 `!important` 桥接规则的去留
- [ ] 遗留变量（`--mm-*`、`--gh-*`、`--sc-*`）的迁移或删除
- [ ] `dark-desaturated/*` 冻结层的停用计划
- [ ] 存量组件基准清单（哪些继续用、哪些标记 legacy）
- [ ] 窗框颜色 CSS 与 `win_launcher.py` 的同步策略
- [ ] 正文字号 14px → 16px 的全局迁移计划

## 6. 扩展流程

1. 确认现有 token / primitive 无法表达需求
2. 在 `design-tokens.css` 或 `ui-primitives.css` 登记
3. 更新 `UI_VISUAL_STANDARD.md` 对应章节
4. 更新本文档
5. feature 再消费

## 7. 关键文件索引

| 用途 | 路径 |
|------|------|
| 用户视觉标准 | `docs/UI_VISUAL_STANDARD.md` |
| 视觉样板 | `docs/prototypes/spectrum-full-shell.html` |
| Design Tokens | `runtime/service/static/css/design-tokens.css` |
| UI Primitives | `runtime/service/static/css/ui-primitives.css` |
| 全局皮肤 | `runtime/service/static/css/minimax-visual.css` |
| 窗口壳 | `runtime/service/static/css/desktop-window-frame.css` |
| 启动器（窗框色） | `runtime/service/win_launcher.py` |
| Agent 规则 | `AGENTS.md` |
