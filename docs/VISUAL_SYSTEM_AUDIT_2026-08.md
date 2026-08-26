# VISUAL SYSTEM AUDIT & CONSOLIDATION PROPOSAL

> 光盒 · 当前源码复核版 · 2026-08-20  
> 范围：`runtime/service/static/` 的 CSS / HTML / JS，排除 `vendor/`、`node_modules/`。  
> 本阶段仅 Scan / Audit / Classification / Proposal / Migration Plan；**未修改产品代码或交互**。
> 决策用一页版：[`VISUAL_SYSTEM_SIMPLE_SUMMARY_2026-08.md`](VISUAL_SYSTEM_SIMPLE_SUMMARY_2026-08.md)  
> 原始统计总表：[`VISUAL_SYSTEM_AUDIT_STATISTICS_2026-08.md`](VISUAL_SYSTEM_AUDIT_STATISTICS_2026-08.md)

## 1. Executive Summary

光盒不是“没有设计系统”，而是处于**系统已建立、局部视觉已收敛，但旧级联架构仍主导实现**的阶段。

已完成且应保留：`--ui-*` 语义 token 已建立；固定字号已基本收敛到 10/11/12/13/14/16/20px；700+ UI 字重已清除；accent 已统一为 `#0a84ff`；主界面和设置中心已从玻璃/新拟态明显转向扁平实色。

当前最高优先级问题：

1. 主画布加载 35 个 stylesheet，全库 9,937 个 `!important`；文档描述的加载顺序与 7 个实际入口不一致。
2. 8 个入口均加载 `ui-primitives.css`，但 HTML/JS 中 `.ui-*` 消费者仍为 **0**；Button 10+ 套、Menu 7 套、Input 7 套并存。
3. 数值收敛不等于语义收敛：10/11/12px 仍跨角色使用；text/icon 仍有 379 种字面形式。
4. spacing 54 值、radius 60 形式，控件高度 22–48px 多套并存。
5. Canvas token 除网格外几乎未接线，screen-space/world-space 策略不一致。

目标不是再设计产品，而是把当前已经可见的扁平、克制、密度适中方向变成唯一可执行规则。

## 2. Current Visual Problems

### Critical

- **级联不可预测**：`smart-canvas.html` 35 个、`index.html` 20 个 stylesheet；token/primitive 靠后加载并依赖大量 bridge override。
- **Shared UI 为纸面系统**：规范没有真实消费者，未来功能仍会自然复制 feature-local 控件。

### High

- 同屏出现多种 selected 语言：最近项目“灰底+蓝条”、资产 tab“蓝底白字”、设置导航“白底+蓝描边”。
- 精确 height 声明有 117 个值；22/24/26/28/30/32/34/36/38/40/42/44/48px 均承担控件或 row。
- 活跃层 text/icon 仍有 246 种颜色字面形式。
- Port/连线 stroke 已 screen-space，resize handle/连线端点仍随 zoom。

### Medium / Low

- line-height 35 值、letter-spacing 30 值、font-family 24 种、motion duration 47 值。
- 35 个非 `none` backdrop-filter、390 个 gradient 仍在源码；实景多被末层关闭。
- `outline:none` 139 处，不能用 focus-visible 规则数量证明键盘焦点完整。
- `font-weight:520` 仅 1 处，是明确尾项。

## 3. Typography Audit

共 1,109 个 `font-size` 声明：

| 值 | 次数 | 主要用途 / 判定 |
|---|---:|---|
| 10px | 259 | badge、micro、节点小字；角色混用 |
| 11px | 330 | meta、hint、label、项目时间 |
| 12px | 197 | body、button、input、menu；最拥挤 |
| 13px | 80 | menu、section、input、panel row |
| 14px | 49 | panel title、dialog、composer |
| 16px | 21 | page/wizard title |
| 20px | 6 | display/title/数字 |

另有 API 设置页 2 个 `clamp()` display 值；画布节点 `--prompt-font-size:32px` 是 world-space 内容，不计 Application UI 字阶。

Typography roles：

| Role | Size / weight / leading | Color | Usage |
|---|---|---|---|
| display | 20 / 600 / 1.2 | text | 欢迎页、关键数字 |
| page | 16 / 600 / 1.2 | text | 页面/大型 dialog 标题 |
| panel | 14 / 600 / 1.2 | text | Panel 标题 |
| section | 13 / 600 / 1.2 | text | 分区标题、菜单分组 |
| body | 12 / 400 / 1.5 | text | 正文、说明、对话 |
| control | 12 / 500 / 1 | secondary | Button/Input/Menu/Tab |
| meta | 11 / 400 / 1.2 | muted | 时间、状态、辅助信息 |
| micro | 10 / 500 / 1 | muted | Badge/角标，不作长文 |

Weight 当前 400(117)/500(239)/600(419)/520(1)，建议 4→3；`@font-face 500 900` 是字体区间，不是 UI 使用 900。Family 只保留 `--ui-font`/`--ui-font-mono`；品牌字体必须显式例外。

## 4. Color Audit

| Scope | Occurrences | Distinct lexical forms |
|---|---:|---:|
| 全产品颜色字面量 | 13,987 | 1,782 |
| 活跃层（排除 11 个冻结/legacy 文件） | 4,642 | 1,093 |
| 冻结/legacy 层 | 9,345 | 1,032 |
| text + icon (`color/fill/stroke`) | 3,755 | 379 |
| text + icon 活跃层 | 1,344 | 246 |
| surface (`background*`) | 4,019 | 793 |
| surface 活跃层 | 1,454 | 487 |
| border / outline | 2,386 | 493 |

Alpha、渐变颜色和同色不同格式分别计 lexical form；该指标衡量实现碎片度。

主要灰簇：secondary 的 `#697077/#747b85/#50565e/#555b63/#505761`；muted 的 `#9299a2/#9aa0a9/#9aa0a8/#888`；浅 surface 的 `#fff/#f9fafb/#f7f9fa/#f5f6f8/#f1f2f4`；深 surface 的 `#131416/#1b1c20/#1e1f23/#232327/#2e2f33`。

Semantic proposal：Text 为 primary/secondary/muted/disabled/on-accent/accent/danger；Icon 通过 `currentColor` 别名到 text roles；Feedback 为 danger/success/warning+tint；Border 为 subtle/strong/focus/danger；Canvas 颜色独立。

## 5. Surface / Material Audit

- `box-shadow` 2,135 声明、650 种形式：`none` 726，`--ui-shadow-pop` 88，dialog 12。
- `backdrop-filter` 288 声明：253 个 `none`、35 个 blur/saturate。
- gradient 390 个；部分是数据/遮罩，部分是旧玻璃高光。
- 实景中主界面与设置中心已基本扁平，说明后层收敛有效；源码仍有大量被关闭的旧材质。

Surface roles：

| Token | Use | Do not use |
|---|---|---|
| `--ui-surface-canvas` | 无限画布、空白工作区 | Panel/Card |
| `--ui-surface-chrome` | titlebar/sidebar/docked panel | 自由浮层 |
| `--ui-surface-card` | card/dialog body/node shell | hover 状态 |
| `--ui-surface-input` | input/select/textarea | 普通 panel |
| `--ui-surface-elevated` | menu/popover/context menu | 入坞 panel |
| `--ui-hover/active` | 交互叠层 | 结构背景 |
| `--ui-backdrop` | modal scrim | canvas feedback |

平面组件无 blur/shadow/装饰渐变；自由弹层只用 pop 阴影，modal 只用 dialog 阴影。全屏 scrim blur、视频浮钮、数据渐变可登记例外。

## 6. Spacing Audit

2,802 个 padding/margin/gap 声明、2,912 个 px occurrence、**54 个 distinct px 值**，`--ui-space-*` 属性引用 41 次。高频：8(457)、10(343)、6(281)、12(252)、4(228)、2(218)、7(186)、5(134)、14(121)、3(116)、9(96)、16(91)、18(74)。

保留基础 scale `2/4/6/8/12/16/20/24/32`。Panel/dialog/menu/control padding 由 component/pattern own，feature 不自行决定。统计只取 UI spacing 属性，未混入 JS 节点坐标。

## 7. Border / Radius / Shadow Audit

- Border/outline width 1,493 occurrence、10 个值；1px 占 1,362，2px 98。Application UI 结构边框仅 1px，2px 仅 focus；Canvas stroke 独立。
- Radius 1,315 声明、60 形式。高频：999(291)、12(110)、10(105)、8(101)、14(95)、16(74)、9(58)、0/50%(各48)、6(48)、13/18(各40)、11(34)、22(30)。
- Radius proposal：0/control 6/card 8/panel 10/round 50%；pill 999 只用于真胶囊。聊天气泡/composer 大圆角如保留，必须登记 pattern token。
- Shadow 650→3 levels：none/pop/dialog。旧 inset glass shadow 与 `none` 覆盖成对出现，需在 visual diff 后删除。

## 8. Component Audit

| Component | Current | Consolidation target |
|---|---:|---|
| Button / IconButton | 10+ / 6 | `.ui-btn/.ui-icon-btn`，24/28 两尺寸 |
| Input | 7 | rename-input 先归并；`#promptInput` 保持特殊 |
| Select/Dropdown | 5 | 保留 native/custom 行为差，统一外观 |
| Checkbox/Switch | 6 | `.ui-check/.ui-switch` |
| Tabs/Segmented | 4 / 4 | nav/tab/segmented 分 pattern |
| Menu/Popover | 7 | `.ui-menu` plain/rich |
| Dialog | 5 | 设置中心重 dialog + asset 轻确认，共享骨架 |
| Panel | 5 | docked/floating 两结构 |
| Slider | 2–3 | 设置中心 slider 为基准 |

`.ui-*` 消费者为 **0**。目标 variant：Button=ghost/primary/outline/danger × normal 28/small 24；Input/Select=default/error/disabled；Tabs 默认 neutral selected，只有主模式可 accent fill。

## 9. Interaction State Audit

CSS 中 hover 2,643、active 119、focus-visible 781、disabled selector 565、`outline:none` 139。重复冻结层使规则数量失真。

- Hover：只变 overlay/border/text/icon，禁止 scale/translate 和改字重。
- Pressed：active overlay，短于 hover，不等于 selected。
- Selected：持续状态；列表/tab 默认 active overlay+主文字，全局唯一主模式才用 accent fill。
- Focus-visible：2px accent outline+1px offset；禁止无替代的 `outline:none`。
- Disabled：opacity .45 + 禁止 pointer；当前尚有 .32–.78 旁支。
- Loading：容器尺寸固定，spinner 替换内容但不引起 layout shift。

实景中设置导航 hover=灰底+细边框、selected=白底+蓝描边；资产 tab selected=蓝底白字。可分别归类为导航与主模式，但必须由 pattern 明确。

## 10. Motion Audit

629 个 transition/animation 声明、845 个 time occurrence、**47 个 duration**。高频 160ms(155)、180(150)、140(141)、150(88)、200(49)、220(43)、120(23)、300(22)、320(20)、500(18)。Easing 798 次、28 种；`@keyframes` 58。

Proposal：140 fast / 180 base / 240 surface / 340 panel；ease/emphasized 两条 easing。Canvas drag/resize/zoom/snap 为 0ms；loading/进度 linear 为行为例外。

## 11. Canvas UI Audit

`--ui-canvas-selection/guide/port/connection` 已定义，但除 grid dot/size 外无实际消费者。

| Element | Current | Proposed |
|---|---|---|
| Selection box/capsule | `worldToScreen` | 保持 screen-space |
| Port size/hit area | `/ --world-scale` | 保持 screen-space |
| Connection/guide stroke | non-scaling-stroke | 保持 |
| Resize handle | 18px world | 14px screen token |
| Connection end/cut | SVG r=2.6/7 world | screen-space 补偿 |
| Selected outline | 随 node zoom | screen-space stroke |
| Node content | world-space | 保持，不套 App spacing |

Handle/port/guide/selection/connection/cut control 恒定 screen-space；节点内容随 zoom。

## 12. Current Best Visual References

1. **设置中心 dialog（本次鼠标实测）**：结构、sidebar、card、slider、primary action、disabled、hover 最完整，是 Dialog/Settings/Property 第一基准。
2. **`.mm-sidebar` + shell chrome**：扁平实色、清晰 hover、低阴影，是 Application surface 基准。
3. **资产库 panel**：标题、tab、select、textarea、button 同屏，适合作为密度校准页。
4. **`.shell-user-menu` / `.port-link-pick-menu`**：plain/rich menu 结构基准。
5. **现有 canvas selection/port/guide 行为结构**：只换 token/空间策略，不重做事件。

不作为新基准：`canvas.html` legacy、API settings 多皮肤、`dark-desaturated/*`、底层 glass 配方。

## 13. Proposed Visual Design System

- Foundation：7 size/8 type roles，3 weights，3 leading；5 surfaces；9 spacing；0/6/8/10/round radius；1px border/2px focus；none/pop/dialog shadow；4 motion/2 easing。
- Semantic：text/icon roles、hover/pressed/selected/focus/disabled/loading、feedback+tint、Canvas roles。
- Components：Button、IconButton、Input/NumberInput、Select、Check、Switch、Slider、Tabs、Segmented、Menu、Dialog、Panel、Row/Section、Toast/Badge。
- Patterns：Toolbar、Sidebar、PropertyPanel/Section/Row、FloatingPanel、ContextMenu、Dialog、Composer、CanvasChrome。
- Feature 只组合 pattern/primitive，不创建基础控件视觉。

## 14. Proposed Tokens

下表为最小完整集；现有正确值保留，“新增”项需审批后加入。

| Token | Value | Meaning / usage | Replaces |
|---|---|---|---|
| `--ui-type-display/page/panel/section` | 20/16/14/13px | 四级标题 | clamp 外 20/22/24、feature title |
| `--ui-type-body/control/meta/micro` | 12/12/11/10px | 正文/控件/meta/badge | 硬编码 10/11/12 |
| `--ui-weight-regular/medium/semibold` | 400/500/600 | 唯一字重 | 520、任何 700+ |
| `--ui-leading-control/tight/body` | 1/1.2/1.5 | 单行/标题/正文 | 35 种 leading |
| `--ui-tracking-title/caps` | -.01em/.06em(新增) | title/uppercase micro | 字距散值 |
| `--ui-surface-canvas/chrome/card/elevated/input` | 现有浅/深值 | 五级 surface | 浅深灰簇 |
| `--ui-hover/active/selected` | 现值/`active`(新增) | hover/pressed/neutral selected | alpha 与 selected 旁支 |
| `--ui-backdrop` | black .40/.55(新增) | modal scrim | dialog 遮罩散值 |
| `--ui-text/-secondary/-muted/-disabled/-on-accent` | 现值 | 文字层级 | #747b85/#9aa0a9 等 |
| `--ui-accent/-hover` | #0a84ff/#339dff | 主操作/唯一模式 | 字面 accent |
| `--ui-danger/success/warning` | 现值/#ff9500(新增) | feedback | 杂红绿橙 |
| `--ui-*-tint` | semantic 10–12%(新增) | accent/danger/success/warning tint | 多 alpha/浅实底 |
| `--ui-border/-strong/-focus/-danger` | 现值/accent/danger | divider/control/focus/error | 493 border forms |
| `--ui-disabled-opacity` | .45(新增) | disabled component | .32–.78 |
| `--ui-space-1..9` | 2/4/6/8/12/16/20/24/32 | base spacing | 54 spacing 值 |
| `--ui-pad-panel/dialog/menu-x/control-x` | 16/16/8/12px(新增) | component-owned padding | 8–28px 旁支 |
| `--ui-radius-control/card/panel/round/pill` | 6/8/10/50%/999 | semantic radius | 60 forms；pill 受限 |
| `--ui-shadow-pop/dialog` | 现值 | popover/modal | 650 forms |
| `--ui-motion-fast/base/surface/panel` | 140/180/240/340ms | micro→panel | 47 durations |
| `--ui-ease/-emphasized` | ease / cubic-bezier(.22,.75,.3,1) | standard/emphasized | 28 easing |
| `--ui-control-h/-sm` | 28/24px | normal/compact control | 22–38px 控件 |
| `--ui-menu-item-h/row-h/toolbar-h` | 28/32/40px(新增) | menu/property/toolbar | row 高度旁支 |
| `--ui-canvas-grid-*` | 现有 | grid | minimax fallback |
| `--ui-canvas-selection/-fill/guide` | 现有 | selection/snap | `--strong`/字面蓝 |
| `--ui-canvas-port/-active` | 现有 | node port | `--card/--strong` |
| `--ui-canvas-connection/-active` | 现有 | connection | JS rgba/color |
| `--ui-canvas-handle-size/stroke/hit` | 14/1.5/14px(新增) | screen-space chrome | 18 world、1.05–1.8、JS 14 |

Icon 只用 `currentColor`：default=secondary，hover/active=primary，muted/disabled 对应 text role。保留现有 9 个 `--ui-z-*` 和 titlebar/sidebar/dock metrics。

## 15. Before → After Metrics

| Dimension | Current | Proposed after |
|---|---:|---:|
| Application font sizes | 9 forms（7 fixed+2 clamp；world 32 另计） | 7 values / 8 roles |
| Font weights | 4 | 3 |
| Text/icon colors | 379（active 246） | 7 roles + 3 feedback |
| Surface colors | 793（active 487） | 5 roles + 3 state/backdrop |
| Spacing values | 54 | 9 base + 4 component pads |
| Radius forms | 60 | 5 tokens |
| Shadow variants | 650 | 3 levels |
| Motion durations / easings | 47 / 28 | 4 / 2 |
| Button families | 10+ | 1 primitive × 4 variants × 2 sizes |
| Smart-canvas stylesheets | 35 | 终局 4 职责层 |
| `.ui-*` consumers | 0 | 全部新增 UI + 分批存量 |

## 16. Component Consolidation Strategy

1. 新 UI 强制使用 `.ui-*`，冻结新增平行实现。
2. 先归并 rename-input、plain menu、icon button；保持事件、ARIA、定位和 DOM。
3. 行为差异保留为 variant/state，例如 run/stop，不保留 feature 皮肤。
4. `#promptInput`、chat composer、canvas node、native/custom select 不做结构合并，只统一 token/外壳。
5. 每迁移一个 family，再删除该 family 已失效 bridge；不得先删桥接。

## 17. Migration Order

| Phase | Work | Verification |
|---|---|---|
| M0 | 建立 audit baseline，禁止新增视觉字面量 | count 不上升 |
| M1 | 决议真实加载链；先让文档与运行时一致，不重排 | 7 入口 computed-style baseline |
| M2 | rename-input + plain menu 成为首批 `.ui-*` 消费者 | 交互/键盘/截图 |
| M3 | 活跃层 text/icon/border/surface token 化 | light/dark diff |
| M4 | Button/Input/Select/Toggle/Tabs family | 每批一个 family |
| M5 | height/spacing/radius/padding | 密度/截断/换行 |
| M6 | hover/pressed/selected/focus/disabled/loading | 鼠标+键盘 |
| M7 | leading/family/role 接线，清 520 | 全入口文本回归 |
| M8 | motion token 化，去 geometry hover | reduced-motion |
| M9 | Canvas selection→guide→port→connection token | 不改 hit/事件 |
| M10 | handle/end/cut screen-space | 多 zoom 鼠标实测 |
| M11 | 逐条退役 frozen/glass/bridge，再简化加载链 | 全入口截图 |

不要把“重排 35 个 stylesheet”作为第一批；当前视觉依赖末层桥接。

## 18. High Risk Areas

- `desktop-window-frame.css` + `win_launcher.py` 窗框色双源。
- `theme-dark`/`studio-theme-dark` 同挂 html/body、跨 iframe postMessage。
- `minimax-visual.css`、typography、glass 的高 specificity/`!important`。
- `#promptInput` contenteditable、IME、selection、paste、shortcut、focus。
- `--world-scale`、viewport、pan/zoom、selection、drag/resize、port magnet、guide、connection hit width。
- Overlay left/top、portal、z-index、focus trap、WebView2 titlebar。
- CSS class 被 JS 当作 hit-test/state contract；改名风险高于改色。
- 字体栈会改变字宽、按钮宽度、节点换行、sidebar 截断。

## 19. Recommended First Implementation Batch

1. 增加只读视觉字面量 audit/CI，冻结新增债务。
2. 唯一 `font-weight:520` → `--ui-weight-medium`。
3. 三个 rename-input 共享 `.ui-input` 视觉，保留事件/DOM。
4. 一个 plain menu 接入 `.ui-menu`，验证 keyboard/position/z-index。
5. 设置中心作为 state-model 试点，接线 hover/selected/disabled token。

每项独立提交、截图、回滚；第一批不碰 Canvas geometry、不重排 stylesheet、不删 bridge。

## 如果只能先解决 5 个问题

1. 让级联只有一个可解释真相，分 component 退役 9,937 个 `!important` 债务。
2. 打破 `.ui-*` 0 消费者状态。
3. 统一 semantic text/icon/border/surface 消费；活跃层仍有 1,093 个颜色形式。
4. 统一 control metrics、spacing、radius，解决轮廓和密度不一致。
5. 统一 hover/pressed/selected/focus/disabled，解决跨 feature 的操作反馈割裂。

Canvas screen-space 修正紧随其后，但必须单独成批。

## Audit Method & Visual Verification

- 静态扫描：PowerShell + ripgrep，63 CSS、8 HTML、167 JS；排除 vendor/node_modules；冻结层单列。
- 软件验证：启动 `启动光盒.exe`，在 Windows WebView2 桌面窗口检查主画布、资产库、右侧对话、设置中心。
- 鼠标验证：点击设置入口，鼠标 hover“API 设置”，随后点击关闭；检查 selected/hover/primary/disabled/scrim。
- 结果：软件正常启动、流程可操作；主界面材质已收敛，但级联、组件采用、度量和状态模型仍与统一系统目标存在显著差距。
