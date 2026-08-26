# VISUAL SYSTEM AUDIT — STATISTICAL TABLES

> 光盒 · 视觉系统审计原始统计附表 · 2026-08-20  
> 范围：`runtime/service/static/`；排除 `vendor/`、`node_modules/`。  
> 口径：CSS / HTML / JS 的视觉声明扫描；block comment 已剔除。颜色 alpha/格式不同分别计 lexical form。  
> `active` 排除 11 个冻结/legacy 文件：`dark-desaturated/*`、`studio-theme-dark.css`、`canvas.css`。

## A. Scan Scope

| File type | Files | Bytes |
|---|---:|---:|
| CSS | 63 | 2,532,928 |
| HTML | 8 | 194,636 |
| JS | 167 | 3,514,247 |
| Total | 238 | 6,241,811 |

| Entry | Stylesheets loaded |
|---|---:|
| `smart-canvas.html` | 35 |
| `index.html` | 20 |
| `canvas.html` | 10 |
| `apps/gpt-dock/gpt-chat.html` | 10 |
| `apps/studio-coding/agent-chat.html` | 9 |
| `api-settings.html` | 8 |
| `apps/runninghub-settings/index.html` | 6 |

| Architecture metric | Count |
|---|---:|
| Effective `!important`（comment stripped） | 9,937 |
| Raw `!important`（含注释） | 9,941 |
| `.ui-*` consumers in HTML/JS | 0 |
| Frozen/legacy CSS/HTML/JS files | 11 |

## B. Executive Before → Proposed After

| Dimension | Current | Proposed after |
|---|---:|---:|
| Application font-size forms | 9（7 fixed + 2 clamp；world-space 32 另计） | 7 values / 8 roles |
| Font weights | 4 | 3 |
| Text/icon color forms | 379（active 246） | 7 roles + 3 feedback |
| Surface color forms | 793（active 487） | 5 roles + 3 state/backdrop |
| Spacing px values | 54 | 9 base + 4 component pads |
| Radius declaration forms | 60 | 5 tokens |
| Shadow declaration forms | 650 | 3 levels |
| Motion durations | 47 | 4 tokens |
| Easing forms | 28 | 2 tokens |
| Button visual families | 10+ | 1 primitive × 4 variants × 2 sizes |
| Smart-canvas stylesheets | 35 | 4 responsibility layers |

## C. Typography Statistics

### C1. Direct fixed font sizes

| Font size | Occurrences | Main current usage |
|---|---:|---|
| 10px | 259 | badge / micro / node text / toolbar helper |
| 11px | 330 | meta / hint / label / project time |
| 12px | 197 | body / button / input / menu |
| 13px | 80 | menu / section / input / panel row |
| 14px | 49 | panel title / dialog / composer |
| 16px | 21 | page / wizard title |
| 20px | 6 | display / title / number |
| **Fixed total** | **942** | — |

### C2. Other font-size forms

| Form | Occurrences |
|---|---:|
| `var(--gh-type-control)` | 29 |
| `var(--gh-type-meta)` | 17 |
| `var(--ui-type-control)` | 16 |
| `var(--gh-type-meta, 11px)` | 11 |
| `var(--gh-type-section)` | 11 |
| `var(--ui-type-section)` | 11 |
| `var(--ctrl-font)` | 9 |
| `var(--ui-type-display)` | 9 |
| `var(--gh-type-body)` | 8 |
| `var(--ctrl-pop-font)` | 7 |
| `var(--gh-type-control, 12px)` | 6 |
| `var(--gh-type-micro)` | 6 |
| `var(--gh-type-body, 13px)` | 3 |
| `var(--ui-type-meta)` | 3 |
| `var(--ui-type-panel)` | 3 |
| `inherit` | 2 |
| Other single/paired forms | 18 |
| **All font-size declarations** | **1,109** |

Other single forms include `.92em`, `1em`, two API `clamp()` values, `--prompt-font-size:32px` fallback and low-frequency type tokens.

### C3. Font weights

| Weight/form | Occurrences | Status |
|---|---:|---|
| 600 | 419 | allowed semibold |
| 500 | 239 | allowed medium |
| 400 | 117 | allowed regular |
| 520 | 1 | outlier to remove |
| `var(--gh-weight-medium)` | 48 | compatibility source |
| `var(--gh-weight-regular)` | 31 | compatibility source |
| `var(--ui-weight-medium)` | 28 | target token |
| `var(--gh-weight-semibold)` | 25 | compatibility source |
| `var(--ui-weight-regular)` | 20 | target token |
| `var(--gh-weight-regular, 400)` | 15 | compatibility fallback |
| `var(--gh-weight-medium, 500)` | 8 | compatibility fallback |
| `var(--ui-weight-semibold)` | 7 | target token |
| `inherit` | 5 | contextual |
| `var(--gh-weight-semibold, 600)` | 5 | compatibility fallback |

`font-face: 500 900` is a font range descriptor and is excluded from UI weight count.

### C4. Line-height

| Value | Occurrences | Value | Occurrences |
|---|---:|---|---:|
| 1 | 80 | 1.2 | 39 |
| 1.35 | 39 | 1.25 | 23 |
| 1.45 | 21 | 1.3 | 18 |
| 1.5 | 18 | 1.4 | 16 |
| 1.55 | 14 | `--ui-leading-tight` | 13 |
| 1.6 | 12 | 20px | 10 |
| 1.65 | 8 | 1.1 | 7 |
| 18px | 6 | 0 | 4 |
| 1.15 | 4 | 1.72 | 4 |
| Other forms | 32 | **Distinct** | **35** |

### C5. Letter-spacing

| Value | Occurrences | Value | Occurrences |
|---|---:|---|---:|
| 0 | 65 | .08em | 18 |
| .04em | 14 | .02em | 13 |
| .06em | 12 | .12em | 10 |
| .05em | 8 | .01em | 6 |
| -.01em | 5 | `--ui-tracking-title` | 4 |
| .14em | 3 | Other forms | 26 |
| **Distinct** | **30** | **Declarations** | **185** |

### C6. Font-family

| Metric | Count |
|---|---:|
| Declarations | 71 |
| Distinct forms | 24 |
| Hard-coded Inter-leading stack | 21 |
| `inherit` | 10 |
| `var(--ui-font)` | 6 |
| Mono stack variants | 17 |
| Brand/display one-offs | 2 (`Orbitron`, `Space Grotesk`) |

## D. Color Statistics

### D1. Totals

| Scope | Occurrences | Distinct forms |
|---|---:|---:|
| All color literals | 13,987 | 1,782 |
| Active layer | 4,642 | 1,093 |
| Frozen/legacy layer | 9,345 | 1,032 |
| Text/icon all | 3,755 | 379 |
| Text/icon active | 1,344 | 246 |
| Surface all | 4,019 | 793 |
| Surface active | 1,454 | 487 |
| Border/outline all | 2,386 | 493 |

### D2. Most frequent active-layer literals

| Color form | Occurrences | Likely role |
|---|---:|---|
| `#ffffff` | 592 | card/text-on-accent/mixed |
| `rgba(var(--ui-accent-rgb), …)` | 236 | accent tint family |
| `#9aa0a9` | 130 | muted |
| `#f1f2f4` | 115 | light surface/dark text |
| `#747b85` | 101 | secondary |
| `#17181b` | 84 | primary text |
| `#2b2c30` | 83 | dark border/surface |
| `#50565e` | 72 | secondary text |
| `rgba(255,255,255,.08)` | 59 | dark border |
| `#f5f6f8` | 48 | light chrome/surface |
| `#232327` | 43 | dark card |
| `#555b63` | 33 | secondary text |
| `#9299a2` | 32 | token muted |
| `rgba(255,255,255,.10)` | 32 | dark overlay/border |
| `rgba(255,255,255,.14)` | 32 | strong dark border |
| `#1b1c20` | 31 | dark chrome |
| `#3a3b40` | 31 | dark border/control |
| `#131416` | 30 | dark canvas/surface |
| `#343a40` | 26 | secondary/disabled |
| `#1e1f23` | 25 | dark input/surface |

### D3. Text/icon active-layer top values

| Value | Occurrences | Value | Occurrences |
|---|---:|---|---:|
| `#ffffff` | 334 | `#9aa0a9` | 122 |
| `#747b85` | 98 | `#f1f2f4` | 87 |
| `#17181b` | 79 | `#50565e` | 70 |
| `#555b63` | 32 | `#9299a2` | 27 |
| `#343a40` | 24 | `rgba(236,240,246,.74)` | 17 |
| `#888888` | 16 | `#505761` | 14 |
| `#697077` | 13 | `#047857` | 11 |
| `#9aa0a8` | 10 | `#ededed` | 9 |

### D4. Surface active-layer top values

| Value | Occurrences | Value | Occurrences |
|---|---:|---|---:|
| `#ffffff` | 205 | accent tint family | 62 |
| `#232327` | 37 | `#f5f6f8` | 31 |
| `#2e2f33` | 21 | `#f9fafb` | 21 |
| `#1b1c20` | 20 | `#1e1f23` | 18 |
| `#f7f9fa` | 17 | `#131416` | 14 |
| `#f2f3f5` | 14 | `#f7f8fa` | 13 |
| `#26272b` | 12 | `#fee2e2` | 12 |
| `#1b1b1b` | 10 | `#eff1f4` | 10 |
| `#f1f2f4` | 10 | `#f3f4f6` | 10 |

## E. Surface / Material Statistics

| Metric | Declarations | Distinct/forms |
|---|---:|---:|
| `box-shadow` | 2,135 | 650 |
| `box-shadow:none` | 726 | — |
| `var(--ui-shadow-pop)` | 88 | — |
| `var(--ui-shadow-dialog)` | 12 | — |
| `backdrop-filter` | 288 | 13 |
| `backdrop-filter:none` | 253 | — |
| Non-none backdrop-filter | 35 | 12 |
| Gradients | 390 | — |

## F. Spacing Statistics

2,802 declarations / 2,912 px occurrences / 54 distinct px values.

| px | Count | px | Count | px | Count |
|---:|---:|---:|---:|---:|---:|
| 8 | 457 | 10 | 343 | 6 | 281 |
| 12 | 252 | 4 | 228 | 2 | 218 |
| 7 | 186 | 5 | 134 | 14 | 121 |
| 3 | 116 | 9 | 96 | 16 | 91 |
| 18 | 74 | 1 | 48 | 20 | 42 |
| 11 | 35 | 24 | 32 | 13 | 27 |
| 28 | 19 | 15 | 14 | 22 | 12 |
| 42 | 11 | 26 | 8 | 36 | 6 |
| 17 | 5 | 32 | 5 | 10.5 | 4 |
| 34 | 4 | 30 | 3 | 40 | 3 |
| 48 | 3 | 52 | 3 | 72 | 3 |
| 44 | 2 | 46 | 2 | 56 | 2 |
| 64 | 2 | 76 | 2 | 78 | 2 |
| 80 | 2 | 0 | 1 | 19 | 1 |
| 38 | 1 | 43 | 1 | 54 | 1 |
| 58 | 1 | 60 | 1 | 68 | 1 |
| 100 | 1 | 108 | 1 | 120 | 1 |
| 218 | 1 | 232 | 1 | 328 | 1 |

Large one-offs are layout offsets/panel geometry; they must be classified before migration, not mechanically mapped to the spacing scale.

## G. Radius Statistics

1,315 declarations / 60 lexical forms.

| Radius form | Count | Radius form | Count |
|---|---:|---|---:|
| 999px | 291 | 12px | 110 |
| 10px | 105 | 8px | 101 |
| 14px | 95 | 16px | 74 |
| 9px | 58 | 0 | 48 |
| 50% | 48 | 6px | 48 |
| 13px | 40 | 18px | 40 |
| 11px | 34 | 22px | 30 |
| 7px | 20 | `inherit` | 17 |
| 4px | 16 | 5px | 12 |
| `--mm-radius-control` | 12 | `--ui-radius-card` | 10 |
| 20px | 9 | 3px | 8 |
| `--ui-radius-control` | 8 | 2px | 7 |
| 15px | 6 | 26px | 4 |
| 28px | 4 | `--ui-radius-panel` | 4 |

Remaining forms are asymmetric corner shorthands, compatibility variables, 1/17/23/24/9999px and container-query values.

## H. Component Metrics

Exact `height/min-height/max-height` declarations: 1,148 / 117 distinct values.

| px | Count | px | Count | px | Count |
|---:|---:|---:|---:|---:|---:|
| 30 | 70 | 28 | 61 | 34 | 58 |
| 22 | 58 | 14 | 54 | 38 | 48 |
| 16 | 46 | 36 | 45 | 18 | 43 |
| 40 | 42 | 32 | 42 | 26 | 37 |
| 15 | 34 | 24 | 34 | 12 | 27 |
| 13 | 23 | 72 | 18 | 44 | 17 |
| 20 | 16 | 42 | 14 | 48 | 13 |
| 54 | 13 | 58 | 13 | 46 | 9 |

These include icon/thumbnail/layout heights; the 22–48px cluster is the component-metric consolidation target.

## I. Border Statistics

| Width | Occurrences | Intended classification |
|---|---:|---|
| 1px | 1,362 | Application structural border |
| 2px | 98 | focus / icon / canvas |
| 3px | 15 | legacy/canvas |
| 1.5px | 8 | canvas stroke |
| 4px | 4 | legacy/focus |
| 5px | 2 | legacy |
| 1.2/1.3/1.4/1.8px | 1 each | canvas SVG/stroke |

## J. Motion Statistics

629 declarations / 845 time occurrences / 47 durations.

| ms | Count | ms | Count | ms | Count |
|---:|---:|---:|---:|---:|---:|
| 160 | 155 | 180 | 150 | 140 | 141 |
| 150 | 88 | 200 | 49 | 220 | 43 |
| 120 | 23 | 300 | 22 | 320 | 20 |
| 500 | 18 | 420 | 17 | 240 | 12 |
| 360 | 11 | 280 | 9 | 380 | 8 |
| 460 | 7 | 800 | 7 | 0 | 6 |
| 900 | 5 | 1500 | 5 | 400 | 4 |
| 450 | 4 | 1 | 3 | 260 | 3 |
| 480 | 3 | 1150 | 3 | 80 | 2 |
| 350 | 2 | 600 | 2 | 720 | 2 |
| 850 | 2 | 1000 | 2 | 1350 | 2 |
| 2000 | 2 | 60 | 1 | 90 | 1 |
| 170 | 1 | 250 | 1 | 440 | 1 |
| 580 | 1 | 750 | 1 | 760 | 1 |
| 1100 | 1 | 1400 | 1 | 1650 | 1 |
| 1800 | 1 | 2400 | 1 | — | — |

| Easing metric | Count |
|---|---:|
| Total occurrences | 798 |
| Distinct forms | 28 |
| `ease` | 680 |
| `linear` | 26 |
| Proposed emphasized curve equivalents | 38 |
| Other cubic-bezier forms | 54 |
| `@keyframes` | 58 |

## K. Interaction State Statistics

| Selector/declaration | Count |
|---|---:|
| `:hover` | 2,643 |
| `:active` | 119 |
| `:focus-visible` | 781 |
| Disabled selectors | 565 |
| Selected/active class or ARIA matches | 1,860 |
| `outline:none` | 139 |

| Disabled opacity | Occurrences |
|---|---:|
| .45 | 12 |
| 1 | 7 |
| .42 | 6 |
| 0 | 6 |
| .55 | 5 |
| .35 | 4 |
| .38 | 3 |
| .32 / .48 | 2 each |
| .3/.4/.6/.65/.72/.78 | 1 each |

## L. Component Family Counts

| Component | Current families | Proposed |
|---|---:|---:|
| Button | 10+ | 4 semantic variants |
| IconButton | 6 | 3 semantic variants |
| Input | 7 | 1 primitive + states |
| Select/Dropdown | 5 | 2 behavior types, 1 visual shell |
| Checkbox/Switch | 6 | 2 primitives |
| Tabs | 4 | 1 primitive + pattern rules |
| SegmentedControl | 4 | 1 primitive |
| Menu/Popover | 7 | plain/rich |
| Dialog | 5 | light/heavy patterns |
| Panel | 5 | docked/floating |
| Slider | 2–3 | 1 primitive |
| Badge | 4 | semantic variants |
| Toast | 1 | retain |
| Tooltip | 1 (`title`) | retain |

## M. Canvas Token Adoption

| Token group | Defined | Actual product consumer |
|---|---|---|
| Grid dot/size | Yes | Yes, `minimax-visual.css` |
| Selection/fill | Yes | No; legacy/local values remain |
| Guide | Yes | No; JS/CSS literal remains |
| Port/active | Yes | No; `--card/--strong` remain |
| Connection/active | Yes | No; JS literal remains |

Screen-space correct today: selection box, port size/hit, connection/guide stroke. World-space inconsistency: 18px resize handle, connection end r=2.6, cut control r=7, selected outline.

## Notes on Interpretation

- These are source-declaration statistics, not computed-style counts. Later layers may override earlier declarations; this is why source debt is much larger than the number of visible inconsistencies.
- Values must be migrated by semantic role and component, never by global numeric replacement.
- Canvas world geometry, layout widths and one-off positioning values require manual classification before any spacing/metric migration.

