# 光盒 × Material Design 3 套用方案

> 参考：[Material Design 3](https://m3.material.io/)  
> 目标：借鉴 M3 的**体系化方法**，不是把光盒变成 Android 应用。  
> 原则：**亮/暗主题只有颜色不同，其他规则完全相同。**

---

## 一、先说清楚：M3 是什么

Material Design 3（简称 M3，也叫 Material You）是 Google 的一套设计规范。

它最核心的思想只有一句话：

> **所有视觉样式都写成「有名字的规则」，不按页面各自乱写。**

M3 把视觉分成 4 大块：

| M3 模块 | 中文意思 | 光盒现状 |
|---------|----------|----------|
| Color（颜色角色） | 每种用途有固定颜色名 | 已有 `--ui-*`，但大量页面没遵守 |
| Typography（文字阶梯） | 5 级文字，每级有大中小 | 有字号，但 7 种像素值散落各处 |
| Shape（圆角阶梯） | 7 级圆角 | 有 3 级，但实际用了 81 种 |
| Elevation（层级） | 用「表面色调」区分高低，不靠阴影 | 已是平面风格，非常适合对接 |

---

## 二、适合光盒套用的部分（推荐采用）

### ✅ 1. 颜色角色体系（最推荐）

M3 不用「这个蓝、那个灰」，而是用「角色名」。

**光盒应采用的 M3 颜色角色（映射到现有 `--ui-*`）：**

| M3 角色名 | 中文用途 | 光盒变量 | 亮色示例 | 深色示例 |
|-----------|----------|----------|----------|----------|
| `surface` | 页面主背景 | `--ui-surface-canvas` | `#fcfcfc` | `#101010` |
| `surface-container` | 侧栏/面板底 | `--ui-surface-chrome` | `#f7f7f8` | `#1b1b1b` |
| `surface-container-low` | 顶部栏/导航 | `--ui-surface-shell` | `#fafafb` | `#181818` |
| `surface-container-high` | 卡片/弹窗 | `--ui-surface-card` | `#ffffff` | `#212121` |
| `surface-container-highest` | 菜单/浮层 | `--ui-surface-elevated` | `#ffffff` | `#232323` |
| `on-surface` | 主文字 | `--ui-text` | `#41444a` | `#d1d3d6` |
| `on-surface-variant` | 次文字 | `--ui-text-secondary` | `#697077` | `#9c9c9c` |
| `outline` | 普通边框 | `--ui-border` | 黑 10% | 白 8% |
| `outline-variant` | 分割线 | `--ui-shell-divider` | 黑 7% | 白 8% |
| `primary` | 主色（强调） | `--ui-accent` | `#0a84ff` | `#0a84ff` |
| `on-primary` | 主色上的白字 | `--ui-text-on-accent` | `#ffffff` | `#ffffff` |
| `primary-container` | 选中底色 | `--ui-selected` | 蓝 10% | 蓝 16% |
| `error` | 错误/危险 | `--ui-danger` | `#ff453a` | `#ff5c5c` |
| `error-container` | 危险 Hover 底 | `--ui-danger-hover` | 红 10% | 红 14% |
| `scrim` | 弹窗遮罩 | `--ui-backdrop` | 黑 40% | 黑 55% |

**状态层（State Layer，M3 核心机制）：**

M3 规定：鼠标放上去、按下、选中，不是换一个新颜色，而是在当前表面上**叠一层半透明色**。

| M3 状态 | 中文 | 光盒变量 | 亮色 | 深色 |
|---------|------|----------|------|------|
| Hover | 鼠标放上去 | `--ui-hover` | `#f3f3f4` | 白 7% |
| Pressed | 鼠标按下 | `--ui-pressed` | 黑 11% | 白 15% |
| Focus | 键盘焦点 | `--ui-focus-ring` | 蓝 30% | 蓝 38% |
| Dragged | 拖拽中 | `--ui-active` | 黑 8% | 白 11% |

> **这正是你要求的「亮暗只有颜色不同」——M3 的状态层机制天然支持这一点。**

---

### ✅ 2. 文字阶梯（推荐，但需缩小）

M3 原版为手机设计，字号偏大。光盒是桌面工具，**只取 M3 的中号和小号**。

| M3 角色 | M3 原名 | 光盒采用 | 大小 | 用在哪里 |
|---------|---------|----------|------|----------|
| 大标题 | Title Large | `--ui-type-page` | **16px** | 设置页标题、弹窗标题 |
| 正文 | Body Medium | `--ui-type-body` | **14px** | 对话、菜单、输入、按钮 |
| 紧凑标签 | Label Medium | `--ui-type-compact-label` | **12.5px** | 项目名、底栏、工具栏 |
| 辅助信息 | Label Small | `--ui-type-meta` | **11px** | 时间、状态、快捷键 |
| 占位说明 | Body Medium（细字重） | `--ui-weight-placeholder` | **14px / 250** | 输入框灰色提示 |

**不采用的 M3 字号：**
- Display（57px/45px/36px）— 太大，光盒没有手机开屏页
- Headline（32px/28px/24px）— 太大，桌面工具不需要

**字体保持 MiSans，不换成 M3 默认的 Roboto。**

---

### ✅ 3. 圆角阶梯（推荐，精简版）

M3 有 7 级圆角，光盒只取 3 级（与现有标准一致）：

| M3 名称 | M3 值 | 光盒变量 | 光盒值 | 用在哪里 |
|---------|-------|----------|--------|----------|
| Extra Small（超小） | 4px | — | **6px** | 按钮、输入框、菜单项 |
| Small（小） | 8px | `--ui-radius-card` | **8px** | 卡片、菜单容器 |
| Medium（中） | 12px | `--ui-radius-panel` | **10px** | 弹窗、大面板 |
| Full（全圆） | 9999px | `--ui-radius-round` | **50%** | 头像、滑条圆点 |

**不采用：** M3 的 16px、20px、28px、48px 大圆角（光盒是专业工具，不是消费类 App）。

---

### ✅ 4. 层级（Elevation，强烈推荐）

M3 最重要的变化：**不靠阴影区分高低，靠「表面颜色深浅」**。

这和你软件现在的平面风格完全一致。

| M3 层级 | 中文 | 光盒做法 |
|---------|------|----------|
| Level 0 | 贴地（无层级） | 普通面板、按钮 — 无阴影 |
| Level 1 | 略高 | 卡片 — 背景色稍亮/稍深 |
| Level 2 | 更高 | 下拉菜单 — `--ui-surface-elevated` |
| Level 3 | 高 | 弹窗 — `--ui-surface-card` + 遮罩 |
| Level 4-5 | 最高 | 只有极少数浮层用 `--ui-shadow-float` |

**亮暗差异：** 只有表面颜色的深浅值不同，层级规则相同。

---

### ✅ 5. 按钮类型（推荐）

M3 定义 5 种按钮，与光盒现有规划完全吻合：

| M3 按钮类型 | 中文 | 光盒类名 | 外观 |
|-------------|------|----------|------|
| Filled（填充） | 主要按钮 | `.ui-btn.is-primary` | 蓝底白字 |
| Outlined（描边） | 次要按钮 | `.ui-btn.is-outline` | 透明底 + 边框 |
| Text（文字） | 文字按钮 | `.ui-btn` | 透明底无边框 |
| Tonal（色调） | 色调按钮 | 新增 `.ui-btn.is-tonal` | 浅蓝底 + 蓝字（用于选中态工具） |
| Icon（图标） | 图标按钮 | `.ui-icon-btn` | 正方形图标 |

**尺寸（M3 有 5 档，光盒取 3 档）：**

| M3 尺寸 | 光盒 | 高度 |
|---------|------|------|
| Small | 小 | 24px |
| Medium | 中（默认） | 28px |
| Large | 大 | 32px |

---

### ✅ 6. 间距网格（推荐）

M3 使用 **8px 基准网格**（所有间距是 4 的倍数）。

光盒现有 `--ui-space-*` 已符合，直接对齐：

| M3 间距 | 光盒变量 | 值 |
|---------|----------|-----|
| 4dp | `--ui-space-2` | 4px |
| 8dp | `--ui-space-4` | 8px |
| 12dp | `--ui-space-5` | 12px |
| 16dp | `--ui-space-6` | 16px |
| 24dp | `--ui-space-8` | 24px |
| 32dp | `--ui-space-9` | 32px |

---

### ✅ 7. 组件规范（推荐对接的）

| M3 组件 | 光盒对应 | 是否对接 |
|---------|----------|----------|
| Menu（菜单） | `.ui-menu` | ✅ 直接采用 |
| Dialog（对话框） | `.ui-dialog` | ✅ 直接采用 |
| Text Field（输入框） | `.ui-input` | ✅ 直接采用 |
| Switch（开关） | `.ui-switch` | ✅ 直接采用 |
| Checkbox（复选框） | `.ui-check` | ✅ 直接采用 |
| Slider（滑条） | `.ui-slider` | ✅ 直接采用 |
| Tabs（标签页） | `.ui-tabs` | ✅ 直接采用 |
| Snackbar（底部提示） | `#toast` | ✅ 对齐 M3 样式 |
| Tooltip（工具提示） | `title` 属性 | ✅ 保持现状 |
| Navigation Drawer（侧栏） | `.mm-sidebar` | ⚠️ 保留结构，统一颜色/间距 |
| Top App Bar（顶栏） | `.lightbox-native-titlebar` | ⚠️ 保留结构，统一颜色 |
| Card（卡片） | 各面板 | ⚠️ 统一为 M3 Filled Card 风格 |
| Chips（标签芯片） | 模式切换按钮 | ⚠️ 可参考 M3 Filter Chip |
| Search Bar（搜索栏） | 顶部搜索框 | ⚠️ 可参考 M3 Search Bar |
| Progress（进度） | 加载转圈 | ⚠️ 统一为 M3 Circular Progress |

---

## 三、不适合光盒套用的部分（明确不采用）

| M3 特性 | 为什么不适用 |
|---------|-------------|
| Dynamic Color（动态取色） | 光盒是品牌软件，主色固定蓝色 `#0a84ff`，不能随壁纸变色 |
| Bottom Navigation（底部导航栏） | 光盒是桌面软件，用左侧栏 + 顶栏，不是手机底部 Tab |
| FAB（悬浮圆形按钮） | 光盒用底部输入栏和工具栏，不需要右下角大圆钮 |
| Navigation Bar（手机底栏） | 同上，桌面不需要 |
| Display 超大标题（57px） | 桌面工具界面紧凑，不需要手机开屏级大字 |
| 全圆角按钮（Full Shape） | 光盒是专业创作工具，用小圆角（6-10px）更利落 |
| Spring 弹性动画 | 画布操作需要即时反馈，不适合弹性回弹 |
| Roboto 字体 | 光盒面向中文用户，继续用 MiSans |
| M3 Expressive 夸张风格 | 光盒定位专业创作，不走消费类 App 的活泼路线 |
| 旧版画布 `canvas.html` | 已废弃，不对接 M3，最终删除 |

---

## 四、光盒定制版 M3 方案（最终推荐）

### 方案名称：**「M3-Lite 桌面创作版」**

> 取 M3 的体系化规则，去掉手机专用部分，保留光盒品牌色和平面风格。

### 4.1 颜色：M3 角色 + 光盒品牌色

```
种子色（Seed Color）：#0a84ff（光盒蓝，亮暗相同）

亮色主题：
  页面底 → 近白
  面板   → 浅灰
  卡片   → 纯白
  文字   → 炭灰三级
  主色   → #0a84ff
  状态层 → 灰色叠加

深色主题：
  页面底 → 近黑
  面板   → 深灰
  卡片   → 深灰（稍亮）
  文字   → 浅灰三级
  主色   → #0a84ff（与亮色相同）
  状态层 → 白色叠加
```

### 4.2 文字：M3 五级缩减为四级

```
16px → 大标题（Title Large 缩减）
14px → 正文/控件（Body Medium）
12.5px → 紧凑标签（Label Medium 微调）
11px → 辅助信息（Label Small）
```

### 4.3 圆角：M3 七级缩减为三级

```
6px  → 控件（按钮/输入/菜单项）
8px  → 卡片/菜单容器
10px → 弹窗/大面板
```

### 4.4 按钮：M3 五种

```
主要（Filled）    → 蓝底白字
次要（Outlined）  → 边框
文字（Text）      → 无边框
色调（Tonal）     → 浅蓝底蓝字（新增）
图标（Icon）      → 纯图标
```

### 4.5 层级：M3 色调层级，无阴影

```
Level 0：普通面板（无阴影）
Level 1：卡片（背景稍不同）
Level 2：菜单/下拉（elevated 表面色）
Level 3：弹窗（遮罩 + 卡片表面色）
仅浮层：底部输入白面、右键菜单等保留轻微阴影
```

### 4.6 间距：M3 八格网格

```
4 / 8 / 12 / 16 / 24 / 32 px（只用这 6 档）
```

### 4.7 动效：M3 标准时长（不用弹性）

| M3 动效 | 时长 | 光盒变量 | 用于 |
|---------|------|----------|------|
| 快速 | 140ms | `--ui-motion-fast` | 鼠标放上去 |
| 标准 | 180ms | `--ui-motion-base` | 菜单开合 |
| 表面 | 240ms | `--ui-motion-surface` | 弹层显隐 |
| 面板 | 340ms | `--ui-motion-panel` | 侧栏滑入 |

---

## 五、M3 角色 → 光盒变量 完整对照表

以后改颜色只改左列的 M3 角色，右列自动跟着变：

| M3 角色 | 光盒 `--ui-*` 变量 |
|---------|-------------------|
| `surface` | `--ui-surface-canvas` |
| `surface-container` | `--ui-surface-chrome` |
| `surface-container-low` | `--ui-surface-shell` |
| `surface-container-high` | `--ui-surface-card` |
| `surface-container-highest` | `--ui-surface-elevated` |
| `surface-variant`（输入框底） | `--ui-surface-input` |
| `on-surface` | `--ui-text` |
| `on-surface-variant` | `--ui-text-secondary` |
| `outline` | `--ui-border` |
| `outline-variant` | `--ui-shell-divider` |
| `primary` | `--ui-accent` |
| `on-primary` | `--ui-text-on-accent` |
| `primary-container` | `--ui-selected` |
| `on-primary-container` | `--ui-accent`（选中时文字色） |
| `error` | `--ui-danger` |
| `error-container` | `--ui-danger-hover` |
| `scrim` | `--ui-backdrop` |
| `inverse-surface`（提示条底） | `--ui-surface-elevated` |
| state-hover | `--ui-hover` |
| state-pressed | `--ui-pressed` |
| state-focus | `--ui-focus-ring` |

---

## 六、执行顺序（你确认后才开始改代码）

| 阶段 | 做什么 | 预计影响 |
|------|--------|----------|
| 1 | 在 `design-tokens.css` 里按 M3 角色重组颜色变量 | 只改规则文件 |
| 2 | 删除 `dark-desaturated/` 和 `minimax-visual.css` 里的重复覆盖 | 减少混乱 |
| 3 | 推广 5 种 M3 按钮到全软件 | 111 种按钮 → 5 种 |
| 4 | 统一输入框/菜单/弹窗为 M3 组件 | 各页面逐换 |
| 5 | 画布区域保持现有交互，只统一颜色/圆角/间距 | 不动功能 |
| 6 | 全面查漏 | 搜索残留旧样式 |

---

## 七、你需要确认的三件事

1. **主色保持 `#0a84ff` 蓝色？**（不采用 M3 动态取色）
2. **圆角保持 6/8/10px 小圆角？**（不采用 M3 大圆角风格）
3. **继续平面无阴影风格？**（采用 M3 色调层级，不加大阴影）

你回复「确认」或提出修改意见后，我把这份方案写入正式标准文档，再开始改代码。

---

*方案版本：2026-08-28 · 基于 M3 规范与光盒第一阶段盘点*
