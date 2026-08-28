#!/usr/bin/env python3
"""Generate spectrum-full-shell.html — complete static visual prototype."""

OUTPUT = "spectrum-full-shell.html"

CSS = r"""
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; overflow: hidden; }
body {
  font-family: var(--lb-font);
  font-size: var(--lb-type-body);
  font-weight: var(--lb-weight-body);
  color: var(--lb-text);
  background: var(--lb-bg-canvas);
}

:root {
  --lb-accent: #0a84ff;
  --lb-accent-hover: #339dff;
  --lb-accent-subtle: rgba(10, 132, 255, 0.12);
  --lb-bg-canvas: #ececee;
  --lb-bg-chrome: #f8f8f8;
  --lb-bg-shell: #fafafa;
  --lb-bg-elevated: #ffffff;
  --lb-bg-input: #ffffff;
  --lb-bg-stage: #f1f2f4;
  --lb-bg-composer: #ffffff;
  --lb-text: #292929;
  --lb-text-secondary: #505050;
  --lb-text-muted: #717171;
  --lb-text-disabled: #c6c6c6;
  --lb-border: #dadada;
  --lb-border-strong: #c6c6c6;
  --lb-divider: #e8e8e8;
  --lb-hover: #efefef;
  --lb-pressed: #e3e3e3;
  --lb-selected: rgba(10, 132, 255, 0.12);
  --lb-focus-ring: rgba(10, 132, 255, 0.35);
  --lb-danger: #e34850;
  --lb-danger-subtle: rgba(227, 72, 80, 0.1);
  --lb-shadow-float: 0 2px 8px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.06);
  --lb-shadow-dialog: 0 4px 16px rgba(0,0,0,.08), 0 16px 48px rgba(0,0,0,.1);
  --lb-font: "Segoe UI", "Microsoft YaHei UI", "MiSans Variable", sans-serif;
  --lb-type-display: 16px;
  --lb-type-body: 14px;
  --lb-type-compact: 12.5px;
  --lb-type-meta: 11px;
  --lb-weight-body: 380;
  --lb-weight-medium: 380;
  --lb-weight-latin: 350;
  --lb-weight-placeholder: 250;
  --lb-radius-chrome: 6px;
  --lb-radius-control: 8px;
  --lb-radius-card: 10px;
  --lb-radius-float: 12px;
  --lb-radius-dialog: 14px;
  --lb-radius-composer: 22px;
  --lb-radius-pill: 999px;
  --lb-control-sm: 24px;
  --lb-control-md: 30px;
  --lb-control-lg: 32px;
  --lb-titlebar-h: 28px;
  --lb-sidebar-w: 250px;
  --lb-panel-w: 340px;
  --lb-composer-w: 760px;
  --lb-stage-radius: 32px;
}
html.theme-dark {
  --lb-bg-canvas: #0e0e0e;
  --lb-bg-chrome: #1b1b1b;
  --lb-bg-shell: #181818;
  --lb-bg-elevated: #262626;
  --lb-bg-input: #1e1e1e;
  --lb-bg-stage: #131416;
  --lb-bg-composer: #1a1a1a;
  --lb-text: #dbdbdb;
  --lb-text-secondary: #b3b3b3;
  --lb-text-muted: #8f8f8f;
  --lb-border: #3a3a3a;
  --lb-divider: #2a2a2a;
  --lb-hover: rgba(255,255,255,.07);
  --lb-selected: rgba(10,132,255,.18);
  --lb-shadow-float: 0 2px 8px rgba(0,0,0,.28);
}

/* layout */
.app { display: grid; grid-template-rows: var(--lb-titlebar-h) 1fr; height: 100vh; }
.body-row { display: grid; grid-template-columns: var(--lb-sidebar-w) 1fr var(--lb-panel-w); min-height: 0; }

/* proto chrome */
.proto-badge {
  position: fixed; top: 4px; left: 50%; transform: translateX(-50%); z-index: 99999;
  padding: 3px 10px; border-radius: var(--lb-radius-pill); background: var(--lb-accent); color: #fff;
  font-size: var(--lb-type-meta); font-weight: var(--lb-weight-medium); pointer-events: none;
}
.proto-toolbar {
  position: fixed; bottom: 8px; left: calc(var(--lb-sidebar-w) + 8px); z-index: 99999;
  display: flex; gap: 6px;
}
.proto-label {
  position: absolute; z-index: 200; padding: 2px 6px; border-radius: 4px;
  background: rgba(10,132,255,.92); color: #fff; font-size: 10px; white-space: nowrap; pointer-events: none;
}

/* titlebar */
.titlebar {
  display: flex; align-items: center; height: var(--lb-titlebar-h);
  padding: 0 8px; background: var(--lb-bg-shell); border-bottom: 1px solid var(--lb-divider);
}
.titlebar-drag { flex: 1; height: 100%; }
.titlebar-tools { display: flex; align-items: center; gap: 6px; }
.titlebar-search {
  width: 200px; height: var(--lb-control-sm); padding: 0 10px;
  border: 1px solid var(--lb-border); border-radius: var(--lb-radius-control);
  background: var(--lb-bg-input); color: var(--lb-text); font-size: var(--lb-type-compact);
}
.titlebar-btn {
  width: 28px; height: 22px; border: none; border-radius: 4px;
  background: transparent; color: var(--lb-text-secondary); cursor: pointer; font-size: 12px;
}
.titlebar-btn:hover { background: var(--lb-hover); }
.points-capsule {
  display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 10px;
  border: 1px solid var(--lb-border); border-radius: var(--lb-radius-pill);
  background: var(--lb-bg-elevated); font-size: var(--lb-type-meta); color: var(--lb-text-secondary);
}

/* sidebar */
.sidebar {
  display: flex; flex-direction: column; background: var(--lb-bg-shell);
  border-right: 1px solid var(--lb-divider); padding: 8px; min-height: 0; position: relative;
}
.sidebar-head { display: flex; align-items: center; justify-content: space-between; padding: 4px 8px 12px; }
.sidebar-logo { font-size: var(--lb-type-compact); font-weight: 600; color: var(--lb-text-secondary); }
.nav-btn {
  display: flex; align-items: center; gap: 12px; width: 100%; height: var(--lb-control-lg);
  padding: 0 12px; border: none; border-radius: var(--lb-radius-control);
  background: transparent; color: var(--lb-text); font-size: var(--lb-type-body);
  text-align: left; cursor: pointer;
}
.nav-btn:hover { background: var(--lb-hover); }
.nav-btn .ico { width: 16px; text-align: center; opacity: .75; }
.sidebar-recent { flex: 1; min-height: 0; margin-top: 12px; overflow: hidden; }
.recent-group-label { padding: 0 12px; font-size: var(--lb-type-meta); color: var(--lb-text-muted); margin-bottom: 4px; }
.recent-item {
  display: flex; align-items: center; height: 30px; padding: 0 12px 0 24px;
  font-size: var(--lb-type-compact); color: var(--lb-text); border-radius: var(--lb-radius-control);
}
.recent-item.is-active { background: var(--lb-selected); color: var(--lb-accent); }
.sidebar-footer { display: flex; align-items: center; gap: 6px; padding-top: 8px; border-top: 1px solid var(--lb-divider); }
.user-btn {
  flex: 1; display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 8px;
  border: none; border-radius: var(--lb-radius-control); background: transparent; cursor: pointer;
}
.user-btn:hover { background: var(--lb-hover); }
.user-avatar {
  width: 28px; height: 28px; border-radius: 50%; background: var(--lb-hover);
  border: 1px solid var(--lb-border); display: grid; place-items: center; font-size: 12px;
}
.user-name { font-size: var(--lb-type-body); color: var(--lb-text); }

/* user menu */
.user-menu {
  position: absolute; left: 8px; bottom: 52px; width: 224px; z-index: 300;
  padding: 12px; border: 1px solid var(--lb-border); border-radius: var(--lb-radius-float);
  background: var(--lb-bg-elevated); box-shadow: var(--lb-shadow-float);
}
.user-menu-profile { display: grid; grid-template-columns: 40px 1fr; gap: 10px; padding-bottom: 10px; }
.user-menu-item {
  display: flex; align-items: center; gap: 8px; width: 100%; height: 32px; padding: 0 8px;
  border: none; border-radius: var(--lb-radius-chrome); background: transparent;
  font-size: var(--lb-type-body); color: var(--lb-text); text-align: left; cursor: pointer;
}
.user-menu-item:hover { background: var(--lb-hover); }
.user-menu-item small { margin-left: auto; color: var(--lb-text-muted); font-size: var(--lb-type-meta); }
.user-menu-divider { height: 1px; background: var(--lb-divider); margin: 6px 0; }
.user-menu-points {
  width: 100%; padding: 10px; margin-bottom: 8px; border: 1px solid var(--lb-border);
  border-radius: var(--lb-radius-card); background: var(--lb-bg-chrome); text-align: left; cursor: pointer;
}
.user-menu-points strong { color: var(--lb-accent); }

/* stage / canvas */
.stage-wrap { padding: 0 0 0 0; background: var(--lb-bg-canvas); min-height: 0; display: flex; }
.stage {
  flex: 1; margin: 0 0 0 0; border-radius: var(--lb-stage-radius); overflow: hidden;
  background: var(--lb-bg-stage); border: 1px solid var(--lb-divider);
  box-shadow: 0 24px 64px rgba(0,0,0,.12); position: relative; min-height: 0;
}
.canvas {
  position: absolute; inset: 0;
  background-color: var(--lb-bg-stage);
  background-image: radial-gradient(circle, rgba(0,0,0,.14) 1px, transparent 1px);
  background-size: 24px 24px;
}
html.theme-dark .canvas {
  background-image: radial-gradient(circle, rgba(255,255,255,.12) 1px, transparent 1px);
}

/* canvas nodes */
.node {
  position: absolute; border-radius: var(--lb-radius-card); background: var(--lb-bg-elevated);
  border: 1px solid var(--lb-border); box-shadow: var(--lb-shadow-float); overflow: hidden;
}
.node-media {
  width: 100%; height: calc(100% - 28px);
  background: linear-gradient(135deg, #d4e8ff, #f0e6ff);
}
html.theme-dark .node-media { background: linear-gradient(135deg, #1a3050, #2a2040); }
.node-title {
  height: 28px; padding: 0 10px; display: flex; align-items: center;
  font-size: var(--lb-type-compact); color: var(--lb-text-secondary);
  border-top: 1px solid var(--lb-divider);
}
.node-port {
  position: absolute; width: 10px; height: 10px; border-radius: 50%;
  background: var(--lb-bg-elevated); border: 2px solid var(--lb-accent);
}
.node-port.out { right: -5px; top: 50%; transform: translateY(-50%); }
.node-port.in { left: -5px; top: 50%; transform: translateY(-50%); }
.conn-layer { position: absolute; inset: 0; pointer-events: none; z-index: 5; }
.conn-line { fill: none; stroke: var(--lb-accent); stroke-width: 2; opacity: .55; }

/* image quick toolbar */
.iqt {
  position: absolute; z-index: 86; display: flex; align-items: center; gap: 4px;
  min-height: 46px; padding: 6px 8px; border-radius: 18px;
  background: var(--lb-bg-elevated); border: 1px solid var(--lb-border);
  box-shadow: var(--lb-shadow-float); transform: translateX(-50%);
}
.iqt button {
  height: 34px; padding: 0 10px; border: none; border-radius: 14px;
  background: transparent; font-size: var(--lb-type-compact); color: var(--lb-text-secondary); cursor: pointer;
}
.iqt button:hover { background: var(--lb-hover); }
.iqt .divider { width: 1px; height: 18px; background: var(--lb-divider); }
.iqt .ico { font-size: 13px; }

/* canvas top-right chrome */
.canvas-chrome {
  position: absolute; top: 12px; right: 12px; z-index: 80;
  display: flex; align-items: center; gap: 0; padding: 0 4px; height: 34px;
  border-radius: var(--lb-radius-pill); background: var(--lb-bg-elevated);
  border: 1px solid var(--lb-border); box-shadow: var(--lb-shadow-float);
}
.canvas-chrome button {
  width: 28px; height: 28px; border: none; border-radius: 8px;
  background: transparent; color: var(--lb-text-muted); font-size: var(--lb-type-meta); cursor: pointer;
}
.canvas-chrome button:hover { background: var(--lb-hover); }
.canvas-chrome .zoom-val { width: 40px; font-size: var(--lb-type-meta); color: var(--lb-text-muted); }
.zoom-menu {
  position: absolute; top: 38px; right: 60px; width: 160px; z-index: 90;
  padding: 4px; border: 1px solid var(--lb-border); border-radius: var(--lb-radius-float);
  background: var(--lb-bg-elevated); box-shadow: var(--lb-shadow-float);
}
.menu-item {
  display: flex; align-items: center; justify-content: space-between; width: 100%;
  height: 30px; padding: 0 10px; border: none; border-radius: var(--lb-radius-chrome);
  background: transparent; font-size: var(--lb-type-meta); color: var(--lb-text); text-align: left; cursor: pointer;
}
.menu-item:hover { background: var(--lb-hover); }
.menu-item kbd { color: var(--lb-text-muted); font-size: 10px; }
.menu-divider { height: 1px; background: var(--lb-divider); margin: 4px 6px; }

/* double-click create menu */
.create-menu {
  position: absolute; left: 38%; top: 42%; z-index: 85; width: 244px;
  padding: 14px 12px 12px; border: 1px solid var(--lb-border); border-radius: 16px;
  background: var(--lb-bg-elevated); box-shadow: var(--lb-shadow-dialog);
}
.create-menu h4 { font-size: var(--lb-type-compact); color: var(--lb-text-muted); margin-bottom: 8px; font-weight: var(--lb-weight-latin); }
.create-item {
  display: flex; align-items: center; gap: 10px; width: 100%; height: 36px; padding: 0 10px;
  border: none; border-radius: var(--lb-radius-control); background: transparent;
  font-size: var(--lb-type-body); color: var(--lb-text); text-align: left; cursor: pointer;
}
.create-item:hover { background: var(--lb-hover); }
.create-item .ico { width: 20px; text-align: center; }

/* context menu */
.ctx-menu {
  position: absolute; left: 52%; top: 55%; z-index: 87; width: 180px;
  padding: 4px; border: 1px solid var(--lb-border); border-radius: var(--lb-radius-float);
  background: var(--lb-bg-elevated); box-shadow: var(--lb-shadow-float);
}
.ctx-menu .menu-item.is-danger { color: var(--lb-danger); }

/* composer */
.composer {
  position: absolute; left: 50%; bottom: 16px; z-index: 85; width: min(var(--lb-composer-w), calc(100% - 48px));
  transform: translateX(-50%);
}
.composer-card {
  border: 1px solid var(--lb-border); border-radius: var(--lb-radius-composer);
  background: var(--lb-bg-composer); box-shadow: var(--lb-shadow-dialog); padding: 8px;
}
.composer-topbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 4px 6px 8px; font-size: var(--lb-type-compact);
}
.composer-topbar .ref-btn {
  display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 10px;
  border: 1px solid var(--lb-border); border-radius: var(--lb-radius-pill);
  background: var(--lb-bg-elevated); font-size: var(--lb-type-compact); color: var(--lb-text-secondary); cursor: pointer;
}
.kind-toggle { display: flex; gap: 2px; padding: 2px; border-radius: var(--lb-radius-pill); background: var(--lb-bg-chrome); }
.kind-toggle button {
  height: 26px; padding: 0 10px; border: none; border-radius: var(--lb-radius-pill);
  background: transparent; font-size: var(--lb-type-compact); color: var(--lb-text-muted); cursor: pointer;
}
.kind-toggle button.is-active { background: var(--lb-bg-elevated); color: var(--lb-accent); box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.prompt-box {
  min-height: 72px; padding: 10px 14px; border: 1px solid var(--lb-border);
  border-radius: var(--lb-radius-composer); background: var(--lb-bg-elevated);
  font-size: var(--lb-type-body); color: var(--lb-text-placeholder, var(--lb-text-muted));
}
.composer-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; }
.tool-wrap { position: relative; }
.tool-btn {
  display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px;
  border: none; border-radius: var(--lb-radius-pill); background: var(--lb-bg-chrome);
  font-size: 12px; font-weight: 600; color: var(--lb-text-secondary); cursor: pointer;
}
.tool-btn .caret { font-size: 10px; opacity: .6; }
.tool-popover {
  position: absolute; bottom: 38px; left: 0; min-width: 200px; z-index: 90;
  padding: 10px; border: 1px solid var(--lb-border); border-radius: var(--lb-radius-float);
  background: var(--lb-bg-elevated); box-shadow: var(--lb-shadow-float);
}
.tool-popover h5 { font-size: var(--lb-type-meta); color: var(--lb-text-muted); margin-bottom: 6px; }
.chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  height: 28px; padding: 0 10px; border: 1px solid var(--lb-border); border-radius: var(--lb-radius-pill);
  background: var(--lb-bg-elevated); font-size: var(--lb-type-compact); color: var(--lb-text-secondary); cursor: pointer;
}
.chip.is-active { border-color: transparent; background: var(--lb-selected); color: var(--lb-accent); }
.run-capsule {
  display: flex; align-items: center; height: 32px; border-radius: var(--lb-radius-pill);
  background: var(--lb-accent); overflow: hidden;
}
.run-cost { display: flex; align-items: center; gap: 4px; padding: 0 10px; color: rgba(255,255,255,.85); font-size: 12px; }
.run-btn {
  height: 32px; padding: 0 14px; border: none; background: transparent;
  color: #fff; font-size: var(--lb-type-body); font-weight: 600; cursor: pointer;
}

/* minimap */
.minimap {
  position: absolute; right: 12px; bottom: 200px; width: 120px; height: 80px; z-index: 70;
  border: 1px solid var(--lb-border); border-radius: var(--lb-radius-card);
  background: var(--lb-bg-elevated); opacity: .85;
}
.minimap-viewport {
  position: absolute; left: 20%; top: 15%; width: 45%; height: 50%;
  border: 1px solid var(--lb-accent); border-radius: 2px; background: var(--lb-accent-subtle);
}

/* gpt dock */
.dock {
  display: flex; flex-direction: column; background: var(--lb-bg-stage);
  border-left: 1px solid var(--lb-divider); min-height: 0;
}
.dock-chrome {
  display: flex; align-items: center; height: 36px; padding: 0 10px;
  border-bottom: 1px solid var(--lb-divider); background: var(--lb-bg-shell); position: relative;
}
.dock-title-btn {
  display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 8px;
  border: none; border-radius: var(--lb-radius-control); background: transparent;
  font-size: var(--lb-type-compact); color: var(--lb-text); cursor: pointer;
}
.dock-title-btn:hover { background: var(--lb-hover); }
.dock-title-menu {
  position: absolute; top: 34px; left: 8px; width: 220px; z-index: 100;
  padding: 6px; border: 1px solid var(--lb-border); border-radius: var(--lb-radius-float);
  background: var(--lb-bg-elevated); box-shadow: var(--lb-shadow-float);
}
.dock-title-menu .new-btn {
  width: 100%; height: 32px; margin-bottom: 4px; border: none; border-radius: var(--lb-radius-control);
  background: var(--lb-hover); font-size: var(--lb-type-body); text-align: left; padding: 0 10px; cursor: pointer;
}
.dock-history-item {
  height: 30px; padding: 0 10px; display: flex; align-items: center;
  font-size: var(--lb-type-compact); color: var(--lb-text-secondary); border-radius: var(--lb-radius-chrome);
}
.dock-history-item.is-active { background: var(--lb-selected); color: var(--lb-accent); }
.dock-close { margin-left: auto; width: 28px; height: 28px; border: none; border-radius: 6px; background: transparent; cursor: pointer; }
.dock-close:hover { background: var(--lb-hover); }

.dock-body { flex: 1; display: flex; flex-direction: column; min-height: 0; padding: 12px; }
.dock-msg {
  align-self: flex-start; max-width: 88%; padding: 10px 12px; margin-bottom: 10px;
  border-radius: var(--lb-radius-float); background: var(--lb-bg-elevated);
  border: 1px solid var(--lb-border); font-size: var(--lb-type-body); line-height: 1.5;
}
.dock-msg.is-user {
  align-self: flex-end; background: var(--lb-accent-subtle); border-color: transparent;
}
.dock-composer {
  margin-top: auto; border: 1px solid var(--lb-border); border-radius: var(--lb-radius-dialog);
  background: var(--lb-bg-elevated); padding: 10px;
}
.dock-input {
  width: 100%; min-height: 64px; border: none; resize: none; outline: none;
  background: transparent; font-family: inherit; font-size: var(--lb-type-body);
  color: var(--lb-text); margin-bottom: 8px;
}
.dock-foot { display: flex; align-items: center; justify-content: space-between; }
.dock-foot-left, .dock-foot-right { display: flex; align-items: center; gap: 6px; }
.attach-btn {
  width: 32px; height: 32px; border: 1px solid var(--lb-border); border-radius: var(--lb-radius-control);
  background: var(--lb-bg-chrome); cursor: pointer; font-size: 14px;
}
.skill-wrap { position: relative; }
.skill-menu {
  position: absolute; bottom: 38px; left: 0; width: 200px; z-index: 110;
  padding: 8px; border: 1px solid var(--lb-border); border-radius: var(--lb-radius-float);
  background: var(--lb-bg-elevated); box-shadow: var(--lb-shadow-float);
}
.skill-menu-head { display: flex; justify-content: space-between; font-size: var(--lb-type-compact); margin-bottom: 6px; }
.send-btn {
  width: 36px; height: 36px; border: none; border-radius: 50%;
  background: var(--lb-accent); color: #fff; font-size: 16px; cursor: pointer;
}

.lb-btn {
  display: inline-flex; align-items: center; gap: 6px; height: var(--lb-control-md);
  padding: 0 12px; border: 1px solid var(--lb-border-strong, var(--lb-border));
  border-radius: var(--lb-radius-control); background: var(--lb-bg-elevated);
  font-size: var(--lb-type-body); color: var(--lb-text); cursor: pointer;
}
.lb-btn.is-primary { background: var(--lb-accent); border-color: transparent; color: #fff; }
.lb-btn.is-sm { height: var(--lb-control-sm); font-size: var(--lb-type-compact); padding: 0 10px; }
"""

HTML_BODY = r"""
<div class="proto-badge">完整壳层视觉样板 · 所有面板同时展示（无功能）</div>
<div class="proto-toolbar">
  <button class="lb-btn is-sm" onclick="document.documentElement.classList.toggle('theme-dark')">切换亮/暗</button>
  <a class="lb-btn is-sm" href="字体说明.html">字体说明 →</a>
  <a class="lb-btn is-sm" href="index.html">← 返回入口</a>
</div>

<div class="app">
  <header class="titlebar">
    <div class="titlebar-drag"></div>
    <div class="titlebar-tools">
      <input class="titlebar-search" placeholder="搜索画布内节点与功能" readonly>
      <button class="titlebar-btn" title="用户">👤</button>
      <button class="titlebar-btn" title="历史">🕐</button>
      <button class="titlebar-btn" title="主题">☀</button>
      <span class="points-capsule">⚡ 2365</span>
      <button class="titlebar-btn">—</button>
      <button class="titlebar-btn">□</button>
      <button class="titlebar-btn">×</button>
    </div>
  </header>

  <div class="body-row">
    <!-- 左侧栏 -->
    <aside class="sidebar">
      <div class="sidebar-head">
        <span class="sidebar-logo">Welcome to 光盒</span>
        <button class="titlebar-btn">☰</button>
      </div>
      <button class="nav-btn"><span class="ico">＋</span><span>新建画布</span></button>
      <button class="nav-btn"><span class="ico">📁</span><span>资产中心</span></button>
      <button class="nav-btn"><span class="ico">✦</span><span>Skill</span></button>
      <button class="nav-btn"><span class="ico">▦</span><span>全部创作</span></button>
      <div class="sidebar-recent">
        <div class="recent-group-label">最近创作</div>
        <div class="recent-item is-active">未命名画布</div>
        <div class="recent-item">品牌海报方案</div>
        <div class="recent-item">产品宣传视频</div>
      </div>
      <div class="sidebar-footer">
        <button class="user-btn"><span class="user-avatar">👤</span><span class="user-name">用户</span></button>
        <button class="titlebar-btn" title="帮助">?</button>
      </div>

      <!-- 用户面板（左下角点击后弹出） -->
      <div class="user-menu">
        <span class="proto-label" style="top:-20px;left:0">⑥ 用户面板</span>
        <div class="user-menu-profile">
          <div class="user-avatar" style="width:40px;height:40px">👤</div>
          <div><div style="font-size:11px;color:var(--lb-text-muted)">用户名</div><strong>用户</strong></div>
        </div>
        <button class="user-menu-points"><span>充值</span> <strong style="float:right">2365</strong><div style="font-size:11px;color:var(--lb-text-muted);margin-top:4px">当前积分</div></button>
        <button class="user-menu-item"><span class="ico">🏠</span>个人主页</button>
        <button class="user-menu-item"><span class="ico">🌓</span>主题<small>浅色</small></button>
        <button class="user-menu-item"><span class="ico">🧠</span>记忆管理</button>
        <button class="user-menu-item"><span class="ico">⚙</span>设置</button>
        <div class="user-menu-divider"></div>
        <button class="user-menu-item" style="color:var(--lb-danger)"><span class="ico">↪</span>退出账号</button>
      </div>
    </aside>

    <!-- 中央画布 -->
    <div class="stage-wrap">
      <div class="stage">
        <div class="canvas">
          <span class="proto-label" style="top:8px;left:8px">② 画布网格点</span>

          <!-- 连线 -->
          <svg class="conn-layer" viewBox="0 0 1200 800" preserveAspectRatio="none">
            <path class="conn-line" d="M 320 220 C 420 220, 480 280, 560 300" />
            <path class="conn-line" d="M 720 300 C 800 300, 860 360, 920 380" style="opacity:.35" />
          </svg>
          <span class="proto-label" style="left:500px;top:250px">⑨ 节点连线</span>

          <!-- 节点 1 -->
          <div class="node" style="left:180px;top:120px;width:200px;height:160px">
            <div class="node-port out"></div>
            <div class="node-media"></div>
            <div class="node-title">参考图片</div>
          </div>

          <!-- 节点 2 + 媒体工具栏 -->
          <div class="node" style="left:520px;top:220px;width:220px;height:180px">
            <div class="node-port in"></div>
            <div class="node-port out"></div>
            <div class="node-media"></div>
            <div class="node-title">生成结果</div>
          </div>
          <div class="iqt" style="left:630px;top:200px">
            <span class="proto-label" style="top:-18px;left:0">⑧ 媒体上方工具栏</span>
            <button><span class="ico">✂</span>裁切</button>
            <button><span class="ico">↻</span>多角度</button>
            <button><span class="ico">▢</span>框选</button>
            <span class="divider"></span>
            <button>HD</button>
            <button>PSD</button>
            <button><span class="ico">↓</span></button>
            <button data-add-to-chat style="background:#fff;border-radius:999px">＋</button>
          </div>

          <!-- 节点 3 -->
          <div class="node" style="left:880px;top:300px;width:180px;height:150px">
            <div class="node-port in"></div>
            <div class="node-media"></div>
            <div class="node-title">视频帧</div>
          </div>

          <!-- 双击画布菜单 -->
          <div class="create-menu">
            <span class="proto-label" style="top:-18px;left:0">③ 双击画布菜单</span>
            <h4>创建节点</h4>
            <button class="create-item"><span class="ico">T</span>文本</button>
            <button class="create-item"><span class="ico">🖼</span>图片</button>
            <button class="create-item"><span class="ico">🎬</span>视频</button>
            <button class="create-item"><span class="ico">🎵</span>音频</button>
            <h4 style="margin-top:10px">辅助工具</h4>
            <button class="create-item" style="opacity:.45"><span class="ico">🎥</span>导演台</button>
            <h4 style="margin-top:10px">添加资源</h4>
            <button class="create-item"><span class="ico">↑</span>上传</button>
          </div>

          <!-- 右键菜单 -->
          <div class="ctx-menu">
            <span class="proto-label" style="top:-18px;left:0">④ 右键画布菜单</span>
            <button class="menu-item"><span>新建画布</span></button>
            <button class="menu-item"><span>整理全局</span></button>
            <button class="menu-item"><span>视角重置</span></button>
            <div class="menu-divider"></div>
            <button class="menu-item"><span>黏贴</span><kbd>Ctrl V</kbd></button>
            <button class="menu-item"><span>撤销</span><kbd>Ctrl Z</kbd></button>
            <div class="menu-divider"></div>
            <button class="menu-item is-danger"><span>删除</span><kbd>Del</kbd></button>
          </div>

          <!-- 右上导航胶囊 -->
          <div class="canvas-chrome">
            <span class="proto-label" style="top:-18px;right:0">⑤ 画布右上工具</span>
            <button title="整理">▦</button>
            <button>−</button>
            <span class="zoom-val">100%</span>
            <button>＋</button>
            <button>↓</button>
            <button>🗺</button>
            <button>⊙</button>
          </div>
          <div class="zoom-menu">
            <span class="proto-label" style="top:-18px;left:0">⑤b 缩放菜单</span>
            <button class="menu-item"><span>缩小</span><kbd>Ctrl -</kbd></button>
            <button class="menu-item"><span>放大</span><kbd>Ctrl +</kbd></button>
            <div class="menu-divider"></div>
            <button class="menu-item"><span>适应视图</span><kbd>Shift 1</kbd></button>
            <div class="menu-divider"></div>
            <button class="menu-item"><span>50%</span></button>
            <button class="menu-item"><span>100%</span></button>
            <button class="menu-item"><span>200%</span></button>
          </div>

          <!-- 小地图 -->
          <div class="minimap"><div class="minimap-viewport"></div></div>

          <!-- 底部生成栏 -->
          <div class="composer">
            <div class="composer-card">
              <div class="composer-topbar">
                <div>
                  <button class="ref-btn">⊕ 参考</button>
                </div>
                <div class="kind-toggle">
                  <button>音频</button><button>文本</button>
                  <button class="is-active">图片</button><button>视频</button>
                </div>
              </div>
              <div class="prompt-box" style="color:var(--lb-text-muted);font-weight:var(--lb-weight-placeholder)">
                描述你想生成或编辑的图片…
              </div>
              <div class="composer-footer">
                <div style="display:flex;gap:6px;flex:1">
                  <div class="tool-wrap">
                    <button class="tool-btn">⚙ API设置 <span class="caret">▲</span></button>
                    <div class="tool-popover">
                      <span class="proto-label" style="top:-18px;left:0">⑦a API 上拉菜单</span>
                      <h5>模型参数</h5>
                      <div class="chip-row">
                        <span class="chip is-active">Seedream 5.0</span>
                        <span class="chip">即梦 4.0</span>
                      </div>
                    </div>
                  </div>
                  <div class="tool-wrap">
                    <button class="tool-btn">🖼 图片 <span class="caret">▲</span></button>
                    <div class="tool-popover" style="left:-20px">
                      <span class="proto-label" style="top:-18px;left:0">⑦b 类型上拉菜单</span>
                      <div class="chip-row">
                        <span class="chip">音频</span><span class="chip">文本</span>
                        <span class="chip is-active">图片</span><span class="chip">视频</span>
                      </div>
                    </div>
                  </div>
                  <div class="tool-wrap">
                    <button class="tool-btn">尺寸 · 1张 <span class="caret">▲</span></button>
                    <div class="tool-popover" style="left:-40px;width:240px">
                      <span class="proto-label" style="top:-18px;left:0">⑦c 尺寸上拉菜单</span>
                      <h5>尺寸选择</h5>
                      <div class="chip-row" style="margin-bottom:8px">
                        <span class="chip is-active">1:1</span><span class="chip">3:4</span><span class="chip">16:9</span>
                      </div>
                      <h5>质量选择</h5>
                      <div class="chip-row" style="margin-bottom:8px">
                        <span class="chip is-active">标准</span><span class="chip">高清</span>
                      </div>
                      <h5>张数选择</h5>
                      <div class="chip-row">
                        <span class="chip is-active">1张</span><span class="chip">2张</span><span class="chip">4张</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="run-capsule">
                  <span class="proto-label" style="top:-18px;right:0">⑦ 底部生成栏</span>
                  <div class="run-cost">⚡ 5</div>
                  <button class="run-btn">↑ 运行</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧对话栏 -->
    <aside class="dock">
      <div class="dock-chrome">
        <button class="dock-title-btn">未命名对话 ▾</button>
        <button class="dock-close">⊟</button>
        <div class="dock-title-menu">
          <span class="proto-label" style="top:-18px;left:0">⑩ 对话标题下拉</span>
          <button class="new-btn">＋ 新建对话</button>
          <div class="dock-history-item is-active">未命名对话</div>
          <div class="dock-history-item">海报文案讨论</div>
          <div class="dock-history-item">视频分镜方案</div>
        </div>
      </div>
      <div class="dock-body">
        <div class="dock-msg">你好，我可以帮你整理创意、写提示词、分析参考图。</div>
        <div class="dock-msg is-user">帮我把这张图的色调调暖一点</div>
        <div class="dock-composer">
          <textarea class="dock-input" placeholder="描述创意或需求，/使用技能，@引用参考" readonly></textarea>
          <div class="dock-foot">
            <div class="dock-foot-left">
              <button class="attach-btn" title="上传">📎</button>
              <div class="skill-wrap">
                <button class="attach-btn" title="技能包">✦</button>
                <div class="skill-menu">
                  <span class="proto-label" style="top:-18px;left:0">⑪ 技能包菜单</span>
                  <div class="skill-menu-head"><span>技能包</span><span>×</span></div>
                  <div class="dock-history-item is-active">图片风格分析</div>
                  <div class="dock-history-item">视频脚本生成</div>
                  <div class="dock-history-item">提示词优化</div>
                </div>
              </div>
            </div>
            <div class="dock-foot-right">
              <span class="proto-label" style="top:-18px;right:0">⑫ 发送按钮</span>
              <button class="send-btn">↑</button>
            </div>
          </div>
        </div>
        <span class="proto-label" style="position:fixed;bottom:8px;right:calc(var(--lb-panel-w) + 8px)">① 完整软件壳层</span>
      </div>
    </aside>
  </div>
</div>
"""

TEMPLATE = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>光盒 · 完整壳层视觉样板</title>
  <style>{CSS}</style>
</head>
<body>
{HTML_BODY}
</body>
</html>
"""

if __name__ == "__main__":
    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write(TEMPLATE)
    print(f"Wrote {OUTPUT}")
