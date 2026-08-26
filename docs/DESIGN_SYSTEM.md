# 光盒 UI Design System

> **任何涉及 UI 的开发任务,动手前必须先读完本文档。**
> 本系统面向持续演进的产品:新功能、新面板、新工具、新画布交互、新对话框都必须由这里的 token 与组件组合而成,不允许 feature 自带视觉规范。

## 0. 一页速览

| 你要做什么 | 去哪里 |
|---|---|
| 需要颜色/字号/间距/圆角/阴影/z-index/动效 | `static/css/design-tokens.css` 的 `--ui-*` 变量(§2) |
| 需要按钮/输入框/菜单/对话框/面板等新控件 | `static/css/ui-primitives.css` 的 `.ui-*` 类(§3) |
| 改已有界面 | 沿用该界面既有的基准类(§4 清单),值换成 token |
| token/组件不够用 | 先扩展 Design System,再写 feature(§6 流程) |

**加载链**(所有入口 HTML 一致,顺序不可变):
`design-tokens.css` → `ui-primitives.css` → 业务 CSS → `dark-desaturated/*` → `minimax-visual.css`(皮肤,末位覆盖)

---

## 1. 架构与分层

本项目是无构建系统的原生 HTML/CSS/JS,多入口(壳 `index.html`、画布 `smart-canvas.html`、对话 `apps/gpt-dock/`、`canvas.html`(legacy)、`api-settings.html`、`director3d/`、`apps/studio-coding/`、`apps/runninghub-settings/`),通过 iframe + postMessage 组合。

样式分层(自底向上):

1. **Token 层** `design-tokens.css` —— 唯一视觉值来源,只声明 `--ui-*` 变量。
2. **Primitive 层** `ui-primitives.css` —— 共享组件基类 `.ui-*`,只消费 token。
3. **业务层** 各 `smart-canvas*.css` / `shell/*.css` / 各 app CSS —— 布局与业务态。
4. **历史主题层** `dark-desaturated/*`(生成物)、`studio-theme-dark.css` 等 —— 遗留暗色覆盖,**冻结:不再往里加东西**。
5. **皮肤层** `minimax-visual.css` —— MiniMax 风格全局覆盖,末位加载。视觉微调优先改这里或 token 层。

历史 token 体系(`--mm-*`、`--gh-*`、`--sc-*`、`--page/--panel/--line` 系、`--ios-*`、`--lb-panel-*`、`--api-*`)仍在运行,**属遗留,新代码禁止引入新的此类变量**。`--mm-*` 调色板已改为引用 `--ui-*`(见 §5),其余按 §7 计划逐步收敛。

## 2. Design Tokens(`--ui-*`)

定义于 `static/css/design-tokens.css`,已在全部 8 个入口加载。**深浅主题切换只发生在 token 层**:浅色为 `:root` 默认值,深色在 `html/body` 的 `.theme-dark` / `.studio-theme-dark` 类下覆盖。组件代码不写主题分支。

### 2.1 语义颜色

| Token | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--ui-surface-canvas` | `#fcfcfc` | `#101010` | 画布底 |
| `--ui-surface-chrome` | `#f7f7f8` | `#1b1b1b` | 窗口栏/侧栏/入坞面板 |
| `--ui-surface-card` | `#ffffff` | `#212121` | 卡片/对话框 |
| `--ui-surface-elevated` | `#ffffff` | `#232323` | 菜单/弹层 |
| `--ui-surface-input` | `#ffffff` | `#1e1e1e` | 输入框 |
| `--ui-surface-composer` | `#ffffff` | `#181818` | 画布底部输入卡片；浅色纯白、深色沿用壳层深度 |
| `--ui-hover` / `--ui-active` / `--ui-selected` | 黑 5%/8%/8% | 白 7%/11%/11% | 悬停/按下/选中；普通选中态不占用强调色 |
| `--ui-backdrop` | 黑 40% | 黑 55% | 模态遮罩 |
| `--ui-disabled-opacity` | `.45` | `.45` | 控件禁用透明度 |
| `--ui-border` / `--ui-border-strong` | 黑 10%/16% | 白 8%/14% | 边框/分隔线 |
| `--ui-border-focus` / `--ui-border-danger` | accent / danger | accent / danger | 焦点边框/危险边框 |
| `--ui-text` / `-secondary` / `-muted` | `#41444a`/`#697077`/`#9299a2` | `#d1d3d6`/`#9c9c9c`/`#6e6e6e` | 文字三级；主前景使用柔和炭灰/浅灰，避免纯黑纯白的生硬对比 |
| `--ui-text-disabled` | 灰 46% | 灰 46% | 禁用文字/图标 |
| `--ui-accent` / `--ui-accent-hover` | `#0a84ff`/`#339dff` | `#0a84ff`/`#339dff`(深浅同蓝,用户定稿) | 强调色 |
| `--ui-accent-rgb` / `--ui-danger-rgb` | `10,132,255` / `255,69,58` | `10,132,255` / `255,92,92` | 半透明通道,写法 `rgba(var(--ui-accent-rgb), .12)` |
| `--ui-danger` / `--ui-success` | `#ff453a`/`#3dd68c` | `#ff5c5c`/`#3dd68c` | 状态色 |
| `--ui-success-text` / `--ui-warning-text` | `#15803d` / `#b45309` | 同浅色 | 状态反馈文字(验证结果等) |
| `--ui-shadow-pop` / `--ui-shadow-dialog` | 浅投影 | 深投影 | 仅弹层/对话框可用阴影 |

**材质原则**:平面组件(按钮、面板、工具条)一律无阴影、无 `backdrop-filter`;只有脱离文档流的弹层(菜单/对话框)允许用 `--ui-shadow-pop/-dialog`。

### 2.2 字体与字阶

字族 `--ui-font` 使用随软件嵌入的 MiSans 字体：英文与数字由固定350实例承接，11px/16px中文由 MiSans Variable 380承接，14px与12.5px中文通过 CJK 固定实例使用330；需要独立可变轴的区域使用 `--ui-font-variable`，右侧对话正文由当前实际中文330下调到 `--ui-weight-dock-body:300`，底部输入栏与右侧对话栏占位说明使用 `--ui-weight-placeholder:250`；`--ui-font-mono` 继续只用于代码。**文字色只允许三级**：主文 `--ui-text`、控件/次级 `--ui-text-secondary`、说明/元信息 `--ui-text-muted`（禁用另写 `#343a40/#575757/#747b85` 等私有灰）。字阶收敛为三档：页级/展示标题16px；面板标题、菜单、正文、输入与控件14px；时间、模型信息、标签与状态等辅助文字11px。行高 `--ui-leading-control 1 / tight 1.2 / body 1.5`;字距 `--ui-tracking-title: -0.01em`(仅页级标题)。通用图标 `--ui-icon-lg/icon/icon-sm = 18/16/14`,描边 `--ui-icon-stroke: 1.5`；左侧一级导航及与其对齐的右侧标题栏操作图标共用 `--ui-sidebar-nav-icon-size:15px`，右侧标题栏图标沿用通用 `--ui-icon-stroke` 以获得更细描边。

### 2.3 间距

`--ui-space-1..9 = 2/4/6/8/12/16/20/24/32`。禁止使用不在此列的 padding/margin/gap 值(布局定位类的特殊几何除外,如面板宽度)。

### 2.4 圆角

`--ui-radius-control/card/panel = 6/8/10`,胶囊 `--ui-radius-pill`(仅历史组件),圆 `--ui-radius-round`。画布内容容器保持直角；Windows 原生外窗口在窗口化/精简态使用原生层 18px 圆角（`win_launcher.py` 的 `WINDOW_CORNER_RADIUS`，SetWindowRgn 裁剪，不走 CSS 圆角变量），最大化保持直角。**新组件禁止出现 12/14/16/18/22/24/28px 等历史大圆角。**

### 2.5 z-index 阶

`raised 10 / toolbar 60 / overlay 120 / panel 160 / menu 200 / sidebar 300 / dialog 400 / chrome 500 / top 10000`。新代码取档位,不写裸数字;层级不够先加档。

### 2.6 动效

时长 `fast 140 / base 180 / surface 240 / panel 340 (ms)`;缓动 `--ui-ease`(常规)、`--ui-ease-emphasized`(面板滑动)。hover 不许改字重(会引起宽度跳动)。

### 2.7 应用级尺寸

`--ui-titlebar-h 28 / --ui-sidebar-w 208 / --ui-sidebar-logo-h 9.333 / --ui-dock-w 460 / --ui-composer-w 760 / --ui-composer-surface-h 174 / --ui-composer-surface-bottom-gap 15 / --ui-control-h 28 / --ui-control-h-sm 24`。布局层历史变量 `--mm-titlebar-h`、`--mm-sidebar-w`、`--chat-dock-width` 仍在被 JS 读写,暂不合并(见 §7 风险)。

### 2.8 画布专用 tokens

网格 `--ui-canvas-grid-dot/-size`,选区 `--ui-canvas-selection/-fill`,对齐线 `--ui-canvas-guide`,端口 `--ui-canvas-port/-active`,连线 `--ui-canvas-connection/-active`。画布新交互 UI 的颜色一律从这里取。

## 3. Shared UI Primitives(`.ui-*`)

定义于 `static/css/ui-primitives.css`。**新 UI 一律用这些类**;不重写已有成熟组件(那些继续用 §4 的基准类)。

| Primitive | 类名 | 说明 |
|---|---|---|
| Button | `.ui-btn`(+`.is-primary/.is-danger/.is-outline`) | 默认幽灵态 |
| IconButton | `.ui-icon-btn`(+`.is-sm`) | 方形纯图标 |
| Input/Textarea/NumberInput | `.ui-input`(textarea 同类名;number 加 `type=number`) | |
| Select | `.ui-select` | 原生 select 皮 |
| Checkbox | `.ui-check`(包 `input[type=checkbox]`) | |
| Switch | `.ui-switch` + `.ui-switch-track` | |
| Slider | `.ui-slider`(`input[type=range]`) | |
| Tabs | `.ui-tabs` > `.ui-tab`(+`.is-active`) | |
| Tooltip | 原生 `title` 属性(现阶段约定,勿自绘) | |
| Popover/DropdownMenu/ContextMenu | `.ui-menu` > `.ui-menu-item`(+`.is-danger`)、`.ui-menu-divider` | 定位由 JS 设 left/top,容器样式统一 |
| Dialog | `.ui-dialog-backdrop` > `.ui-dialog`(head/body/foot) | |
| Panel | `.ui-panel`(+`.is-left`,head/body) | 入坞面板:贴边全高直角 |
| Divider | `.ui-divider`(+`.is-vertical`) | |
| PropertyRow | `.ui-row` > `.ui-row-label` + `.ui-row-control` | |
| PropertySection | `.ui-section` > `.ui-section-title` | |

画布专用 primitives **复用现有成熟实现**(不新建平行类):

| 画布组件 | 基准实现 |
|---|---|
| SelectionBox | `#selectionBox.selection-box` + capsule(`smart-canvas-selection-box.js`) |
| ResizeHandle | `.node-resize-handle`(smart-canvas.css) |
| RotationHandle | 暂无(2D 无旋转);未来新增时进本系统再实现 |
| SnapGuide | `.smart-guide-line`(`smart-canvas-smart-guides.js`) |
| CanvasTooltip | 空态 `#canvasEmptyHint.canvas-empty-hint`;控件用 `title` |
| CanvasContextMenu | `.node-context-menu`(简单操作)/`.port-link-pick-menu`(丰富创建) |
| NodePort/连线 | `.node-port` + `.connection-layer`(smart-canvas.css) |

这些组件后续调色时改为消费 §2.8 的画布 token,不改结构与交互。

## 4. 存量组件基准清单(改旧界面时沿用)

审计结论:同类控件 4~8 套并存。**基准面 = smart-canvas + shell 现行实现**;`canvas.html` 与部分 `api-settings` 按钮体系标记为 legacy,只修 bug 不扩写。

| 类别 | 基准(继续用) | Legacy(勿扩写) |
|---|---|---|
| 按钮 | 壳 `.dock-chrome-btn`;画布 `.asset-mini-btn`/`.composer-tool-btn` | `canvas.css` 的 `.primary-btn`、api-settings 多套 btn |
| 图标按钮 | `.asset-mini-btn`/`.preview-icon-btn`;壳导航 `.shell-primary-rail-item` | |
| 输入 | `.ui-input`;对话 `#messageInput`;画布主输入 `#promptInput`(contenteditable,勿改造) | 未迁移的业务表单输入 |
| 下拉 | `.composer-tool-popover`;节点浮层 `.iqt-dropdown-menu` | 原生 `.provider-select` |
| 布尔/滑条 | `.setting-check`;`.shell-user-theme-switch`;`.smart-range` | `.check-dot`、`.ios-switch` |
| Tabs | `.asset-tab` | RunningHub `.tab` |
| 弹层菜单 | 壳 `.shell-user-menu`;画布 `.composer-tool-popover` | |
| 对话框 | 全局 `.shell-settings-dialog`;画布轻确认 `.asset-dialog`;全屏 `.image-edit-modal` | RunningHub 原生 `<dialog>` |
| 面板 | `.asset-panel`、`.canvas-history-panel`、`.mm-sidebar` | `.gate-panel` |
| 工具条 | 底栏 `.canvas-bottom-capsule`;节点 `.image-quick-toolbar` | `.floating-toolbar` 残留 |
| 节点 | `.image-node` 变体体系 | `canvas.html` 的 `.node` |

## 5. 已完成的 token 迁移

- `minimax-visual.css` 的 `--mm-*` 调色板与半径已改为引用 `--ui-*`(单一来源在 token 层,`--mm-*` 成为兼容别名)。
- `shell/mm-sidebar.css`(左侧栏)的颜色/圆角/动效已消费 `--ui-*`。
- 画布网格点(深浅两色)已由 `--ui-canvas-grid-dot/-size` 驱动(minimax-visual.css §9 及深色 board 规则)。
- 桌面端 110% 原生 UI 缩放通过 `native-ui-zoom.css` 使用 18.1818182px 的 CSS 补偿值，最终保持 `--ui-canvas-grid-size` 对应的网格物理间距。
- **2026-08 视觉收敛第一批**(依据 `docs/VISUAL_SYSTEM_AUDIT_2026-08.md`):
  - `--gh-*`(visual-typography-system.css)全部别名化为 `var(--ui-*)`,`--gh-*` 仅作兼容别名;暗色 ink 覆写按现值保留。
  - 业务层与 shell 层的 `#0a84ff`/`#007aff` → `var(--ui-accent)`、`rgba(10,132,255,α)` → `rgba(var(--ui-accent-rgb),α)`、`#dc2626`/`rgba(220,38,38,α)` → `var(--ui-danger)`/`rgba(var(--ui-danger-rgb),α)` 已全量替换(dark-desaturated 冻结层与注释除外)。深色主题下强调色由此统一为 `#4d6bfe`。
  - `smart-canvas.css` 遗留变量 `--text/--muted/--faint/--line/--strong/--accent` 已映射到 `--ui-*`。
  - 内联/JS 的 `font-weight:800/750/720/900/bold` 已收敛为 600(全库最大字重 600)。
  - hover 加粗规则已移除(visual-system-preview.css);全局键盘焦点环基线落在 `ui-primitives.css` 尾部(`:focus-visible` outline 2px accent)。
  - `.node-context-menu` 已 token 化(elevated 面、`--ui-radius-card`、item 高 `--ui-control-h`)。
  - **深色强调色定稿回退**:深浅统一为 `#0a84ff`(用户否决 `#4d6bfe` 紫蓝);minimax 皮肤内的紫蓝光晕字面量与 fallback 已同步回蓝。
  - **杂蓝清剿**:`#2563eb`/`#3b82f6`/`#60a5fa`/`#5b8cff`/`#0875df`/`#4ea2ff`/`#93c5fd`/`#006de8`(文字用)等近似蓝的 accent 语义用法已全部收敛为 `var(--ui-accent)` 家族(api-settings 推荐皮肤、director3d、canvas.html 遗留、gpt-dock、composer 二级弹层、JS 注入样式);`dark-desaturated/*` 冻结层内同语义杂蓝已按字面量同步为 `10,132,255` 家族(该层深色下会覆盖业务层,必须同步)。保留:数据色板(LTX 分段色、3D 对象色)、api-settings 深色皮肤 `#bfdbfe` 淡蓝文字层(成套设计)、主蓝渐变深端 `#006de8`(gradient 内,待 M5 渐变扁平化决策)、侧栏头像装饰渐变。
  - JS 注入样式的状态反馈色已消费 `--ui-success-text/--ui-warning-text`(api-settings.js);LTX 时间轴播放头红统一为 `#ff453a`(canvas 2D 无法用 var)。
- **2026-08 M5 Surface/材质统一批**:
  - Surface token 落地:`--ui-surface-canvas/-chrome/-card/-elevated/-input` 与 `--ui-shadow-pop/-dialog` 定稿(design-tokens.css);业务层 `--page/--panel/--card/--soft`(smart-canvas/api-settings/visual-system-preview)全部映射到 `--ui-surface-*`。
  - **液态玻璃/新拟态全量拆除**:玻璃配方层(`--vs-glass-*`、`--gh-glass-*`、`--sc-glass`/`--canvas-glass-*`)全部实底化;面板/菜单/工具条/胶囊/节点的 `backdrop-filter` 一律 `none`,装饰性 `::before/::after`(流光、锥形渐变描边、shimmer、glass trail)一律 `content:none`。覆盖:composer 卡片、底部胶囊、选择胶囊、IQT 及其下拉、port-link 菜单、浮动工具条、左侧主轨、顶栏项目胶囊、用户菜单、资产面板、设置对话框、下载中心、多视图/视频/笔刷/inline 工具面板、gpt-dock/studio-coding 顶栏与弹层、窗口控制按钮(desktop-window-frame,仅视觉皮肤,未动几何/事件/窗框底色)。交互 glider(浮动工具条/composer footer/选择胶囊)保留位移动效,底改 `var(--ui-active)` 实色。
  - `canvas-clear-glass.css` 已清空(目标伪元素均已拆除,文件保留占位维持加载顺序)。
  - **例外保留**:全屏遮罩 scrim 的 blur(log/shortcut/image-edit/lightbox/asset-dialog/music/dialog::backdrop)、视频播放浮钮的深色毛玻璃、冻结层(`canvas.css`、`studio-theme-dark.css`)。
  - **api-settings 深色皮肤合并**:`#bfdbfe/#9ed0ff/#dbeafe/#eff6ff` 淡蓝层收敛为 accent 家族(文字 `--ui-accent-hover`,hover 实底 `--ui-accent`,淡蓝边框 → `--ui-border` 或 `rgba(accent-rgb,.2)`);dark-desaturated 对应字面量已同步。
  - 阴影收敛:面板浮层统一 `--ui-shadow-pop`,对话框 `--ui-shadow-dialog`,控件不带投影。
- **2026-08 M6 字号/圆角/菜单几何**:
  - 行高 token:`--ui-leading-control/tight/body`、`--ui-tracking-title`。
  - 刻度外字号归位:`12.5px`→control 12;`22/24px` 标题与用量数字→display 20。
  - Composer 一/二/三级菜单共用 `--ctrl-font/--ctrl-pop-font = --ui-type-control`(原 10.5px 半档取消);弹层高度 `--ctrl-pop-height = --ui-control-h-sm`。
  - 覆盖层曾写在 `visual-typography-system.css` / `smart-canvas-control-metrics.css`，但 `canvas-dark-glass.css` 的 `10px !important` 更后、选择器更长，嵌套菜单实际仍是 10px。真正生效点改到末层 `minimax-visual.css` §10：复刻完整 ID+类链，一/二/三级菜单打到 `--ui-type-section`（13px）。
  - 输入框 `#promptInput` 从字重暴力补丁中豁免,保持 regular 400。
  - 菜单容器圆角:`dropdown/popover`→`--ui-radius-card`;大面板类(create-menu/user-menu/preset)→`--ui-radius-panel`;胶囊按钮保持 pill。
  - 菜单 hover 基线:`--ui-hover`(不含已选/强调态)。
  - 汉字独立字重：`ui-cjk` 为 Noto Sans SC；CSS 400-499 走 Regular，500+ 走 Medium。存储位置说明文字与输入框为 400，右侧对话正文为 445。
  - **2026-08 文字色/字重收口**：深色冻结层把标题钉成浅底灰 `#575757/#707070`，与 `--ui-text` 三级脱节。末层 `minimax-visual.css` §11 按角色覆盖资产库、设置中心（含存储/历史）、API 设置、用户菜单、底栏控件：标题 `600 + --ui-text`，控件/导航 `445 + --ui-text-secondary`，说明/元信息 `400 + --ui-text-muted`。`--gh-ink-*` 深色硬编码已改回 `--ui-text*` 别名。强调色/危险色/白字压强调底不改。
- **2026-08 M7 首批真实组件接入**：画布历史、最近项目、项目历史卡片的重命名输入接入 `.ui-input`；画布空白区与节点右键菜单接入 `.ui-menu/.ui-menu-item`；设置中心的 hover/selected/disabled/focus/danger 状态改由语义 token 驱动；移除非标准字重 `520`。
- **2026-08 M8 文字颜色语义化**：文字只按功能分为五类——标题/名称/输入值使用 `--ui-text`，普通操作与字段标签使用 `--ui-text-secondary`，说明/时间/占位/空状态使用 `--ui-text-muted`，不可用状态使用 `--ui-text-disabled`，强调底文字使用 `--ui-text-on-accent`；成功、警告、危险分别使用对应状态 token。已覆盖侧栏、设置、项目历史、画布历史、底部生成栏及其尺寸/质量/数量/API 弹层、双击空白创建面板、媒体上方工具栏、多选胶囊、空白与媒体右键菜单，以及菜单/选择器/对话框/toast 等按功能出现的非常驻文字。分类色、媒体内容色与品牌强调色不做中性色替换。
- **2026-08 M9 几何与状态收敛**：紧凑控件按 `24 / 28 / 32px` 三档组织，菜单行固定使用 `--ui-menu-item-h:32px`，底部同级工具与媒体上方工具栏统一为 32px；单行控件使用 `--ui-radius-control`，多行功能项与菜单容器使用 `--ui-radius-card`，大面板继续使用 `--ui-radius-panel`。交互只保留六类语义：hover=`--ui-hover`、pressed=`--ui-pressed`、selected/open=`--ui-selected`、focus=`--ui-focus-ring`、disabled=`--ui-text-disabled` 且不再叠加 opacity、danger hover=`--ui-danger-hover`。底部 composer 归入 `--ui-z-overlay`，右键/下拉保持 `--ui-z-menu`，避免菜单被底栏遮挡。已覆盖原子按钮/图标按钮/输入/选择器/check/switch/slider/tab/menu，以及底部生成栏、媒体工具栏、多选胶囊、双击空白入口、画布与媒体右键菜单、设置导航、用户菜单、历史和聊天功能弹层；复合卡片只统一外轮廓和状态，不压缩内容布局。
- **2026-08 M10 应用层动效首批收敛**：历史面板、资产面板、底部生成栏及其弹层、右侧对话按钮与历史菜单统一消费 `--ui-motion-fast/base/surface/panel` 和 `--ui-ease/-emphasized`；颜色反馈只使用 fast，菜单开合使用 base，浮层/生成栏使用 surface，侧面板使用 panel。移除这些组件的 `transition:all`，并补齐 `prefers-reduced-motion`。节点拖拽、缩放、选框、端口与连线等直接操作动效暂不迁移，保持即时反馈与既有命中行为。
- **2026-08 M11 壳层明度分层**：新增 `--ui-surface-shell`，只供顶部窗口栏与左侧主导航使用；深色为 `#181818`、浅色为 `#f3f3f4`。内容面板继续使用 `--ui-surface-chrome`，避免调整壳层时连带改变右侧对话栏、弹层和节点卡片。
- **2026-08 M12 底部输入栏外框拆除**：`#composer .composer-card` 保持透明、无边框和无投影，`.composer-card-material` 停用；内部 `.composer-card-surface` 继续承载输入区底色与边界，顶部模式工具和底部操作区的布局、状态及命中范围不变。
- **2026-08 M13 全局投影清零与圆角平滑（历史）**：软件内容区（主壳、画布及右侧对话 iframe）统一取消 `box-shadow`、`text-shadow` 与连线/流程箭头 `drop-shadow`，`--ui-shadow-pop/dialog` 固定为 `none`；只保留 `win_launcher.py` 独立原生伴随窗口绘制的整窗投影。该阶段的外窗圆角裁剪与补边实现已在 M33 删除。
- **2026-08 M14 Medium 字重统一为 445**：全产品原 `font-weight:500` 的界面文字与 `--ui-weight-medium` 统一为 445；400 正文、600 标题和 700 强调保持不变。`ui-cjk` 的 Regular 匹配范围扩展到 400-499，确保中文 445 实际选择 Regular 字形，而不是继续命中静态 Medium 文件。
- **2026-08 M15 文字交互静态化**：全产品 hover/focus 不得改变 `color` 或 `font-weight`，也不得把二者写入 `transition` / `transition-property`；选中、激活、危险和禁用状态的静态文字语义仍保留。背景、边框、位移、透明度等非文字反馈不受影响。
- **2026-08 M16 节点创建面板紧凑化**：空白画布/端口拉线唤起的 `.port-link-pick-menu` 主选项统一为 12px；以原 14px 为基准同比收紧面板宽度、壳层内边距、分组间距、行内边距、图标底框与图标。分组标题降为 10px、说明文字降为 10px、“正在开发”徽标降为 9px，深浅主题使用同一套最终几何。
- **2026-08 M17 一级参数按钮自适应**：模型按钮显示当前模型完整名称及品牌图标，并随名称长度自适应宽度；尺寸按钮对默认、自适应和非标准比例统一显示 `Auto`，同时保留 `1K/2K/4K` 等质量信息，按钮宽度随内容收紧。
- **2026-08 M18 画布操作栏文字统一**：媒体上方工具栏、工具栏下拉项以及选区“打组/解组”等操作统一为 12px / 445 / 0 字距；最终层按真实 DOM 覆盖旧的 `font:revert`，避免前层规则再次失效。
- **2026-08 M19 最近创作尾部信息与菜单**：项目尾部按“节点数p · 相对时间”显示，例如 `12p · 刚刚`、`12p · 5分钟`、`12p · 3小时`；悬停时信息让位给单个三点按钮，点击后显示仅含“重命名、删除”的紧凑菜单。菜单使用固定视口定位并在边缘自动翻转，避免被最近列表滚动区裁切。
- **2026-08 M20 顶部窗口栏分割线（历史）**：原先由窗口栏 `::after` 单独绘制，已在 M34 合并到左侧栏共用的分割线参数。
- **2026-08 M21 右侧对话气泡与输入区**：用户消息气泡内边距收紧为 6px × 10px，字号、行高和 445 字重不变；删除消息区与底部输入区之间的横向分割线，输入卡片自身边界保留。
- **2026-08 M22 整窗恢复直角**：窗口化、最大化与紧凑窗口的原生 HWND 均固定使用 `DWMWCP_DONOTROUND`；网页外壳直接使用直角规则。内部面板与控件圆角不受影响，窗口化整窗阴影继续保留。
- **2026-08 M23 浅色底部输入卡片纯白化**：画布底部 `.composer-card-surface` 改用 `--ui-surface-composer`；浅色由原壳层近白灰调整为纯白，深色继续保持 `#181818`，不影响右侧对话输入框与其他面板。
- **2026-08 M24 底部输入卡片收窄**：画布底部 composer 基准宽度由 800px 收至 `--ui-composer-w:720px`，继续受视口宽度约束；卡片外层 padding 与区块 gap 收至 `--ui-space-2`。文字、图标、控件高度、输入区高度和模型名完整显示规则保持不变。
- **2026-08 M25 左侧栏欢迎字标缩小**：左侧栏 `.mm-sidebar-logo` 的嵌入式 “Welcome to’ 光盒” 字标高度由 14px 降至 `--ui-type-control`（12px）；收起按钮、侧栏宽度与头部间距不变。
- **2026-08 M26 底部输入卡片小幅放宽**：画布底部 composer 基准宽度由 720px 调整为 `--ui-composer-w:760px`，左右各增加约 20px；内部文字、图标、控件尺寸与高度保持不变，窄视口仍沿用既有自适应约束。
- **2026-08 M27 左侧一级菜单与右侧对话正文字号对齐**：左侧栏“新建画布 / 资产中心 / Skill / 全部创作”和右侧对话中的用户、AI 正文统一使用 `--ui-type-section`（13px）；两处字重继续保持 `--ui-weight-medium`（445），字体、行高、间距及气泡几何不变。
- **2026-08 M28 画布输入卡片与操作工具栏统一 13px**：画布底部 composer 内所有可见文字、媒体上方工具栏及下拉项、选区“打组 / 解组”等操作栏及弹层统一使用 `--ui-type-section`（13px）；输入正文原有 400 字重、工具栏 445 字重、图标和控件几何保持不变。右侧对话输入框继续使用 12px，不受本批调整影响。
- **2026-08 M29 画布底部栏拉丁与数字字体统一**：画布底部一级模型 / 尺寸 / 质量 / 数量菜单与左侧栏 `Skill` 使用完全相同的 `--ui-font`（Segoe UI 优先）、`--ui-type-section`（13px）和 500 字重，并在高特异度规则中避免历史 Inter 反向覆盖；中文继续按字体栈回退。媒体工具栏与选区操作栏沿用同一字体栈，右侧对话输入框保持原有 Inter 优先级。
- **2026-08 M30 底部一级参数按钮收紧**：模型与尺寸一级按钮的左右内边距统一收至 `--ui-space-2`（4px），模型名称、品牌图标、尺寸、质量和数量内容尺寸保持不变；深浅主题使用相同宽度。
- **2026-08 M31 左侧一级菜单字重调整**：左侧栏“新建画布 / 资产中心 / Skill / 全部创作”四个一级菜单保持 13px 与 Segoe UI 字体栈，字重统一调整为 500；画布底部一级参数菜单同步维持与 `Skill` 完全一致。最近创作分组、项目列表、用户区与 Welcome 字标不受影响。
- **2026-08 M32 左右底部输入面对齐**：画布发送区移除包住成本与箭头的外框/底色但保留原命中范围；画布占位文字向下微调 6px；右侧对话输入面高度统一为 `--ui-composer-surface-h`（174px），左右两侧可见输入框底边均离各自画布底部 `--ui-composer-surface-bottom-gap`（15px）；画布预览行和底部一级菜单的左侧内容各向右收进 4px，内部字号、图标与按钮尺寸保持不变。
- **2026-08 M33 外窗口圆角代码清除**：删除网页外壳 `--lightbox-window-radius`、窗口化/精简态圆角消费规则，以及原生 `WINDOW_RADIUS`、`CreateRoundRectRgn`、圆弧阴影与抗锯齿补边逻辑；仅保留 Windows 11 禁止系统自动圆角的直角保护。独立外阴影改为矩形渐隐投影。
- **2026-08 M34 顶部窗口栏收窄与去标志**：窗口栏高度由 32px 收窄为 `--ui-titlebar-h: 28px`，画布、左右栏顶部起点同步；删除窗口栏 LOGO 元素及专用样式。窗口栏底线与左侧栏右线统一消费 `--ui-shell-divider-size: 1px` 和 `--ui-shell-divider`（浅色 7% 黑、深色 8% 白），窗口栏不再使用投影或独立伪元素画线。
- **2026-08 M35 全产品字阶与字重收敛**：取消 20px 展示字，展示/页级标题统一为 16px；面板标题、一级菜单、右侧对话正文、底部栏、媒体与选区工具栏、普通正文、输入和控件统一为 14px；时间、模型信息、标签、状态、最近创作分组标题，以及二级菜单/引用面板中的分组说明和功能描述统一为 11px。所有可见界面文字统一为 450，最终视觉层覆盖遗留业务样式和内联字重；代码编辑器字号与 SVG 图形不参与字号重置。
- **2026-08 M36 英文与数字字重 470**：新增 `--ui-weight-latin:470` 并由最终文字层统一消费；同时把遗留高优先级规则依赖的四个语义字重 token 同步为 470，防止模型名、尺寸数字和媒体类型被压回 450。Segoe/Inter 英文与数字按 470 渲染，中文继续命中 `ui-cjk` 的 400–499 Regular 字体面，不切换到 Medium。字号分类和代码编辑器排版不变。
- **2026-08 M37 MiSans Variable 全局字体**：随软件嵌入小米官方 `MiSans VF.ttf` 与许可协议，`--ui-font` 统一承接中文、英文和数字；最终文字层同时覆盖遗留的 Inter/Segoe 字体栈。所有语义字重 token 收敛为真实可变轴 450，在 14px 正文/控件与 11px 辅助文字上保持中等灰度；代码编辑器继续使用 `--ui-font-mono`。
- **2026-08 M38 全局字重 400**：MiSans Variable 的五个语义字重 token 统一调整为 400，最终文字层继续覆盖正文、标题、菜单、输入、辅助信息、动态内容与伪元素，确保中文、英文和数字使用相同字重；字号、颜色和布局不变。
- **2026-08 M39 全局字重 380**：MiSans Variable 的五个语义字重 token 统一调整为 380，最终文字层继续覆盖正文、标题、菜单、输入、辅助信息、动态内容与伪元素；字号、颜色和布局不变。
- **2026-08 M40 默认窗口同比缩小 20%**：窗口化启动尺寸由屏幕工作区宽高的 85% 同比调整为 68%，继续居中显示；内部 UI 缩放、窗口化最小尺寸与最大化/紧凑窗口逻辑保持不变。
- **2026-08 M41 MiSans 可变轴显式锁定**：全产品可见文字及伪元素除 `font-weight:380` 外，同步显式消费 MiSans 的 `wght` 380 可变轴；左右侧栏、画布与右侧对话文字使用同一真实字形轴值。
- **2026-08 M42 14px 中文试用 360**：新增随软件内嵌的 MiSans 中文 360 固定字形，仅供 14px 正文、菜单、控件和输入文字使用；同一段中的英文与数字、11px 辅助文字及 16px 页级标题继续保持 MiSans Variable 380。通过 CJK `unicode-range` 分流，避免混合文本整体变细。
- **2026-08 M55 14px / 12.5px 中文试用 330**：由 MiSans Variable 生成中文330固定实例，替换14px中文原360字形，并让12.5px项目名、底部栏、对象工具栏和框选工具栏共同使用；中文11px辅助文字及16px标题继续保持 MiSans Variable 380。
- **2026-08 M57 英文与数字实际350**：由 MiSans Variable 生成并裁剪拉丁/数字350固定实例，通过 `unicode-range` 优先覆盖英文、数字、拉丁扩展、常用标点及全角英数；中文14px/12.5px继续实际330，中文11px/16px继续实际380。
- **2026-08 M43 最近创作项目名 13px**：左侧栏“未命名项目”等最近创作项目名称及其重命名输入统一使用独立 `--ui-type-project-title`（13px）；尾部节点数/时间、“最近创作/更早”分组说明继续为 11px，左侧一级菜单继续为 14px。
- **2026-08 M44 深色发送区外框取消**：深色模式下画布底部输入栏右下角的积分与发送按钮外层 `.composer-run-capsule` 固定为透明、无边框、无投影；内部积分文字、发送按钮、间距、命中范围和浅色模式保持不变。
- **2026-08 M45 右侧对话栏响应式宽度**：桌面版右侧对话栏取消固定 488px，改由窗口内容宽度连续计算：最低 360px、最高保持 488px，中间使用 `221px + 12.6% × 窗口宽度`；窗口缩放事件同步更新画布让位宽度。左缘拖拽条继续永久隐藏且不接收指针，用户不能单独拉伸对话栏。
- **2026-08 M46 右侧角落控件常驻**：空画布状态下右上角 Agent 展开按钮与右下角画布控制组不再依赖边缘靠近或画布点击后滑入；两组控件默认保持可见，并取消该显隐过程的位移、透明度与可见性过渡。资产库和历史面板打开时的正常避让隐藏继续保留。
- **2026-08 M47 左上欢迎字标再缩小**：左侧栏 “Welcome to’ 光盒” 图片字标按当前实际 14px 高度缩小三分之一，独立使用 `--ui-sidebar-logo-h:9.333px`；收起按钮、侧栏宽度、头部留白和纵向对齐不变。
- **2026-08 M48 节点创建面板纵向收紧**：引用节点生成面板保持主标题、功能名称、图标和说明字号不变，收紧面板壳层内边距、功能行上下留白、列表/分组间距及分割线留白；“正在开发”徽标显式统一为 11px，并同步收紧徽标高度。面板定位估算高度由 410px 调整为 370px，底部弹出时继续按实际紧凑高度避让视口。
- **2026-08 M49 右侧上下文百分比移除**：删除右侧对话输入框右下角的上下文记忆圆环与百分比，以及仅供该显示使用的 token 估算、usage 更新和渲染链路；右侧操作区只保留发送按钮，不留空占位。
- **2026-08 M50 用户菜单单层紧凑化**：左下用户菜单收窄并改为锚定在“用户”按钮上方，按可用高度自动限高，始终保留间隔且不遮挡触发按钮；删除内部内容卡片的第二层边框与底色，功能项统一为项目列表式无底框行，开关状态只由开关本体表达，积分区改为中性紧凑卡片，最末项统一为红色“退出账号”。

## 6. 扩展流程(token/组件不够用时)

1. 先确认现有 token/primitive 真的表达不了(通常是可以的)。
2. 在 `design-tokens.css` 对应分区**登记语义 token**(命名 `--ui-<域>-<语义>`,同时给深浅两色),或在 `ui-primitives.css` 增加变体类(`.is-xxx`)。
3. 在本文档 §2/§3 表格补一行。
4. 然后 feature 才可以消费它。
5. 一次性/实验性的值不进 token 层,直接不允许出现。

## 7. 未迁移区域与风险(收敛路线)

**未迁移**(仍硬编码/用旧变量,按优先级排):

1. `dark-desaturated/*` 生成层:整目录冻结(内部 `#0a84ff` 等硬编码保留,accent/淡蓝语义已按字面量同步),待 token 化完成后停止生成并删除。
2. z-index 裸数字与 JS 内联样式(选区/节点定位属布局态,不迁;颜色类内联已基本清完,新增需逐个防守)。
3. 旧变量 `--page/--panel/--card/--soft` 等仍存在于各文件,但已全部指向 `--ui-surface-*`(别名态);后续 M7 可做一次机械替换后删除别名。
4. `canvas.css`/`studio-theme-dark.css` 冻结层内的玻璃与旧色(只修 bug,不迁)。
5. 业务层仍有大量硬编码 `font-size:10/11/12px`(节点内部文案、表单说明);菜单/弹层已由覆盖层统一,节点内部字号可在确认菜单观感后再机械替换为 `--ui-type-*`。
6. 通用面板 padding/gap 尚未全量改为 `--ui-space-*`;菜单项高度已走 `--ui-control-h` 家族。

**高风险区(动之前必须小步验证)**:

- `desktop-window-frame.css` + `win_launcher.py`:窗框颜色在 CSS/Python 两处硬编码同步(`#f7f7f8`/`#1b1b1b`),改 chrome 色必须两边一起改。
- 主题切换机制:`theme-dark`/`studio-theme-dark` 双类名同挂 html+body,postMessage 跨 iframe 同步;合并类名易闪屏,不做。
- `minimax-visual.css` 大量 `!important` 桥接:删除任何一条都可能让底层旧样式复活。
- `#promptInput` contenteditable 与节点渲染的 inline style:属交互核心,禁止为"统一"而改造。

**收敛路线**(每步独立可回滚):浅色 `#0a84ff` → `var(--ui-accent)` 批量替换 → 业务层 `--page` 系映射到 `--ui-*` → 停用 `dark-desaturated` 生成 → 精简 `minimax-visual.css` 桥接。

## 8. UI 开发守则(强制)

1. 动 UI 前先读本文档,再查 §3/§4 有没有现成组件。
2. 优先复用;primitives 不够用走 §6 扩展流程,**先进系统,再写 feature**。
3. 禁止 feature 自己实现 Button/Input/Menu/Dialog/Panel。
4. 禁止硬编码颜色、字号、圆角、阴影、间距、z-index、动效时长——一律 `var(--ui-*)`。
5. 深浅主题只靠 token 切换,组件不写 `theme-dark` 颜色分支。
6. 不往 `dark-desaturated/`、`studio-theme-dark.css` 等冻结层加代码。
7. 平面组件无阴影无模糊;弹层只用 `--ui-shadow-pop/-dialog`。
   Windows 原生窗口是系统层例外：窗口化/精简态允许紧凑实体窗体阴影，最大化时必须关闭。
8. 新增视觉值的 PR 必须同步更新本文档。
9. 提交前运行 `node tools/check-visual-system.js`；既有技术债允许下降，不允许任何受监控裸值计数上升。

### M51：底部输入栏与画布工具栏前景色静态统一

- 底部输入栏、媒体上方工具栏、选区/打组工具栏及其下拉菜单统一使用 `--ui-text`，与左侧一级菜单文字颜色一致。
- `hover`、`focus`、`active`、`open`、`selected`、`expanded`、`disabled` 与删除入口不再改变文字或图标颜色。
- 交互反馈只允许使用背景、边框、阴影、位移或透明度；`color`、`stroke`、`fill` 不参与过渡。

### M52：设置中心紧凑宽度与左栏节奏

- 设置中心桌面宽度上限收敛为 `1180px`，内部内容和字号保持不变。
- 左侧设置菜单项间距使用 `--ui-space-5`，提高纵向辨识度；移动端横向菜单继续沿用原响应式规则。
- 左侧栏目宽度在桌面和中等窗口分别为 `285px`、`238px`，较原规格增加四分之一；窄屏仍切换为横向菜单。

### M54：画布紧凑标签字阶

- 左侧最近创作项目名、画布底部输入栏、对象上方媒体工具栏、框选与打组/解组工具栏统一使用 `--ui-type-compact-label`（`12.5px`）。
- 图标尺寸以及节点数、时间、状态等 `11px` 辅助信息保持不变。

### M56：浅色悬停底色统一

- 浅色主题普通按钮、菜单项和工具栏项的悬停底色统一使用 `--ui-hover`，其值与右侧用户消息气泡灰色一致；底部输入栏、媒体/选区工具栏下拉菜单及双击空白出现的引用面板专用 glider 同样消费该 token。
- 悬停时边框颜色透明，保留原有盒模型尺寸；选中态、主操作和危险操作继续使用各自语义状态色。

### M59：右侧对话正文与标题栏层级

- 右侧对话用户及 AI 正文从当前实际 MiSans 中文330下调30，切换到可变字体并消费 `--ui-weight-dock-body:300`；字号、行高和气泡几何不变。
- “未命名对话”标题严格复用左侧“新建画布”的字体、实际中文字形字重和 `--ui-text` 颜色。
- 右侧标题栏操作图标与左侧一级导航图标共用 `--ui-sidebar-nav-icon-size` 和 `--ui-text`；描边使用更细的通用 `--ui-icon-stroke`。

### M61：底部输入栏顶排与主体接缝

- 半透明模式顶排使用 `--ui-composer-topbar-h` 向下扩展，左右功能内容按 `--ui-composer-topbar-content-inset` 同步下移。
- 白色输入主体从 `--ui-composer-surface-top` 开始绘制，并位于顶排之上，完整保留与其余三边同色同粗的顶部边框。
- 卡片与输入正文按 `--ui-composer-topbar-growth` 同步增高，新增高度只归顶排使用，不压缩白色主体；`--ui-composer-prompt-padding-top` 让占位文字同步下移，缩略图、底部参数栏和发送区几何不变。
- 顶排高度与白色主体起点共用同一 token，二者不再相互覆盖；顶排按钮位于正文命中层之上，参考、共创及媒体模式切换必须保持可点击。

### M62：右上画布导航整理入口与几何

- 下载记录左侧新增“整理全局”入口，直接复用画布右键菜单现有的全局整理逻辑，不另建布局算法。
- 整理、下载、小地图、视角重置四个按钮统一消费 `--ui-canvas-nav-control-size` 与 `--ui-canvas-nav-icon-size`；外框圆角统一消费 `--ui-canvas-nav-radius`。

### M63：左下用户面板紧凑化

- 用户名、充值/积分主值和功能项名称严格复用最近创作“未命名项目”的 12.5px 主文字层级与 `--ui-text`；用户名、状态等辅助字保持原有辅助层级，退出账号继续保留危险色。
- 用户面板宽度统一消费 `--ui-user-menu-w`，外层圆角使用 `--ui-radius-panel`；面板内边距、积分卡纵向留白和菜单行高同步收紧。

### M64：节点选中边框同轨加粗

- 删除节点容器外侧的选中 `box-shadow` 描边，不再生成与原边框圆角、位置不一致的第二层选中线。
- 媒体内容以及空白、提示、循环、分组等有框节点，选中时直接把自身边框从 `--ui-canvas-node-border-size` 增加至 `--ui-canvas-node-selected-border-size`，即仅增加 0.5px；圆角继续沿用组件原值。

### M65：底部输入栏白色主体层级

- 浅灰磨砂材质从顶栏交互容器中拆为独立底层；白色主体及其顶部边框绘制在浅灰背景之上，正文内容继续位于白色主体之上。
- 参考、共创及媒体模式按钮所在的左右容器独立提升到交互层，保证白色顶部边框可见的同时，所有顶栏按钮保持可点击。

### M66：底部输入栏顶排单层化

- 顶排仅由整体浅灰磨砂材质提供背景；参考、共创及 Audio / Text / Image / Video 不再绘制各自的底色、边框、阴影或伪元素。
- 删除模式切换滑动高亮块的可见样式；默认、悬停、聚焦、按下和选中状态都保持透明，状态变化不再改变文字和图标颜色。

### M67：底部输入栏主体横向扩展

- 白色输入主体左右内缩统一消费 `--ui-composer-surface-side-inset: 7px`，由原来的 10px 各减少 3px，因此主体总宽度增加 6px。
- 顶部浅灰磨砂区域、主体高度、内部文字与底部控件位置保持不变。

### M68：右侧对话栏无闪屏开合

- 对话 iframe 在首次初始化后保持常驻，收起时只禁用交互并移出视口，不再切换到 `about:blank`；再次展开无需重新加载对话内容。
- 右侧栏仅以 `transform` 参与合成动画，取消透明度渐变；侧栏和中间画布统一消费 `--ui-motion-panel` 与 `--ui-ease-panel`，避免不同动画时长造成跳帧。
- 关闭兜底发生在面板动画时长之后，不能在侧栏仍移动时提前切换 `visibility`。

### M69：底部输入栏顶排高度

- 参考/共创与生成模式共用的浅灰顶排高度为 `--ui-composer-topbar-h: 30px`，较原 46px 缩短约三分之一。
- 白色输入面始终从 `--ui-composer-surface-top` 开始；卡片总高同步缩短，不能通过拉高白色输入面来抵消顶排变化。
- 顶排按钮尺寸保持不变，只压缩顶排上下留白。

### M70：右上角画布控制组

- “Agent 对话”按钮与左侧画布导航长条统一使用 `--ui-shell-top-control-h` 高度和 `--ui-shell-top-control-radius` 方形圆角。
- Agent 按钮取消固定最小宽度，消费 `--ui-shell-agent-control-w: auto` 并随当前文案收紧；画布导航根据按钮实际宽度自动预留右侧空间。右上画布导航图标统一消费 `--ui-icon-xs`（12px）。
- 文字尺寸保持不变；左侧导航图标缩至 `--ui-icon-sm`，两组外框共用同一主题表面和边框。
- Agent 控件相对标题栏下移 3px，与画布导航顶线对齐。

### M71：移除画布历史面板

- 画布空白处右键菜单不再提供“打开历史记录”。
- `canvasHistoryPanel` 及其列表 DOM 从画布页面删除，外壳消息不能再唤起该面板。
- 视觉系统检查的真实 `.ui-menu-item` 消费者下限随该入口删除由 13 调整为 12。
- 最近创作列表和设置中心自身的记录页不属于本面板，继续保留。

### M72：右上画布导航长条外观

- “对话”按钮左侧的画布导航长条，浅色常驻背景使用纯白 `--ui-surface-card`，外框使用 `1px --ui-border` 浅灰细描边。
- 深色底色继续复用 `--ui-active`，边框保持既有颜色与粗细。
- 长条内部按钮、图标、间距与交互状态不变。

### M73：浅色全产品悬停面与描边

- 浅色主题所有普通按钮、工具栏、底部输入栏、右侧对话栏、画布双击/右击面板、左侧栏及用户面板的悬停底色统一为 `--ui-hover: #f3f3f4`。
- `--gh-quiet-hover-surface` 改为 `--ui-hover` 的兼容别名，不再保留独立的 `#f9fafb` 悬停色。
- 按钮型控件在鼠标悬停时统一使用透明边框，并清除悬停轮廓及伪描边阴影；选中、禁用等非悬停状态不受影响。
- 右上角“对话”按钮的浅色常驻背景同样使用 `--ui-hover`，边框保持透明；深色常驻背景不变。

### M74：右上角画布倍率控制

- “整理全局”右侧依次放置分割线、缩小、当前倍率下拉和放大，继续位于同一画布导航长条内。
- 新建画布的真实视口倍率为 100%；倍率显示订阅统一视口状态，滚轮、快捷键、适应视图和菜单操作必须同步更新，禁止维护独立的显示倍率。
- 下拉菜单依次提供缩小、放大、适应视图、50%、100%、200%、300%、400%；快捷键为 `Ctrl -`、`Ctrl +`、`Shift 1`。
- 百分比缩放以当前画布可视区域中心为锚点，视口允许范围扩展至 400%，并继续通过既有保存链路持久化。
- 顶部百分比、菜单主文字、倍率数字和快捷键辅助文字统一复用左侧最近创作尾部信息的最终 10px 字阶；该左侧样式由后加载的 `mm-sidebar.css` 定稿为 10px。减号/百分比/加号使用 20px / 38px / 20px 的紧凑宽度并清除组内额外间隙。桌面启动器会归一化静态资源版本，因此这组局部关键尺寸随页面本体加载，避免 WebView 沿用旧缓存。

### M75：画布直角与窗口化圆角/投影（原生层）

- 画布容器 `.stage` 及内部 iframe 全状态直角、无描边：`desktop-window-frame.css` 与 `minimax-visual.css` 的 32px 圆角、2px 白描边及深色描边变体全部归零删除，末位防覆盖块同步改为直角。
- Windows 原生外窗口在窗口化/精简态恢复圆角：Win10 无 DWM 圆角，由 `win_launcher.py` 的 `apply_rounded_window_region`（SetWindowRgn，半径 `WINDOW_CORNER_RADIUS: 18px` 物理像素）裁剪；最大化清除 region 保持直角；Win11 系统自动圆角继续禁用，避免双重裁剪。
- 整窗投影加重：`SHADOW_MARGIN` 6→16、`SHADOW_RING_ALPHA` 18→48；投影环由方角矩形改为随距离增大的同心圆角矩形（抗锯齿路径描边）。
- region 裁剪锯齿由伴随阴影窗补边：在阴影窗上以窗框色（`CHROME_BG`，深浅主题各自取色）实心填充同半径圆角矩形，四角透出的平滑圆弧盖住主窗硬裁剪锯齿；主题切换时强制重绘。四角 region 由对称椭圆拼合，不再用 `CreateRoundRectRgn(w+1,h+1)`，避免右下椭圆偏移让下圆角看起来更小。

### M76：底部输入栏顶排接缝与入口微调

- 顶排磨砂材质改由 `.composer-card-material` 承载（原 `.composer-card-topbar::before` 置空），层级低于白色输入面并向下延伸 `--ui-space-5`，白色主体直接压在磨砂上，顶排与白色之间不再有透缝。
- 左侧最近创作行高收敛：`.mm-recent-item` 由 36px 改为 `--ui-control-h`（28px），行间 gap 归零，行内打开按钮高度改为 100% 跟随。
- 参考按钮组右移（topbar-left 边距 -15px → -7px，参考组再 +5px），批量与参考之间由 `.co-create-bar` 左边框提供竖直分割线（皮肤层恢复其可见性）。
- 顶排六个入口（参考/批量/Audio/Text/Image/Video）文字与图标统一减淡为 `--ui-text-secondary`。

### M77：指定浮层表面恢复投影

- 新增 token `--ui-shadow-float`（浅色 `0 4px 14px rgba(0,0,0,.05), 0 1px 4px rgba(0,0,0,.03)`；深色 `.26/.16` 同几何），`--ui-shadow-pop/dialog` 维持 none。
- 消费者（皮肤层末尾以 M13 同级特异度覆盖）：画布底部输入白面 `.composer-card-surface`、右侧对话输入卡 `.composer`（canvas-mode）、媒体上方工具栏 `#imageQuickToolbar`、选区打组/解组胶囊 `.selection-capsule-bar`、双击空白引用面板 `.port-link-pick-menu`、画布右键面板 `.node-context-menu/.canvas-context-menu`、左下用户面板 `.shell-user-menu`、底部一级按钮上拉菜单 `#composerApiSettingsPopover/#composerSizePopover/#composerKindPopover/#composerVideoReferencePopover`。

### M78：输入栏占位说明字重 250

- 新增 `--ui-weight-placeholder:250`。画布底部 `#promptInput:empty::before` 与右侧对话 `#messageInput::placeholder` 改走 `--ui-font-variable` 并消费该 token，避免 350 固定实例把说明文字钉在 330/350。

### M79：画布网格间距收紧

- `--ui-canvas-grid-size` 由 20px 调整为 18px。深色画布实际点阵由 `canvas-dark-glass.css` 的 24px SVG 瓷砖改为消费该 token，浅色径向点阵同步收紧。

### M80：窗口化最小尺寸

- 窗口化不可小于 `WINDOW_MIN_WIDTH × WINDOW_MIN_HEIGHT`（1440×850），对应三栏（侧栏、画布、对话）仍完整可见的大致下限；精简小窗仍用 320×420。

### M81：全部创作打开独立历史面板

- 左侧栏「全部创作」打开壳层独立历史面板 `#shellProjectHistoryModal`（全部画布视图），再点一次关闭；点击面板内部或侧栏不再被全局 click-out 立刻关掉。设置中心里的历史页仍是内嵌汇总，互不影响。

### M82：历史记录改为居中模态

- 独立历史面板改为窗口正中的对话框，不再从右侧滑入；背后全屏遮罩使用 `--ui-backdrop` 并与设置中心共用 `blur(8px) saturate(80%)`，打开后挡住后面的点击。设置中心内嵌历史页仍原地展开，不套这层遮罩。

### M83：底部一级上拉菜单收小并加投影

- 模型 / 尺寸 / 质量 / 数量 / 参考等一级按钮的上拉面板使用 `--ui-shadow-float`。
- 面板内边距、宽度和选项行高收一档；选项文字改用 `--ui-type-meta`（11px），一级按钮仍为 `--ui-type-section`。
