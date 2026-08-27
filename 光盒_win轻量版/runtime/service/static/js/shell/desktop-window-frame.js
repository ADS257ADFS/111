(function(){
    if(!document.documentElement.classList.contains('lightbox-desktop-native')) return;

    const api = () => window.pywebview?.api;
    const titlebarDragRegion = document.querySelector('.lightbox-native-titlebar-drag');
    const syncWindowState = state => {
        const maximized = state === 'maximized';
        document.documentElement.classList.toggle('lightbox-window-maximized', maximized);
        titlebarDragRegion?.classList.remove('pywebview-drag-region');
    };
    const syncBackdrop = () => {
        const root = document.documentElement;
        const dark = root.classList.contains('theme-dark') || root.classList.contains('studio-theme-dark');
        api()?.set_window_backdrop(dark ? 'dark' : 'light');
    };
    window.addEventListener('pywebviewready', async () => {
        syncBackdrop();
        syncWindowState(await api()?.get_window_state());
    });
    new MutationObserver(syncBackdrop).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
    });
    syncBackdrop();

    // 顶栏元素搬家（保留原事件绑定）：
    // 1) 闪电 + 积分胶囊排在窗口控制胶囊左侧；
    // 2) 资产库 / 历史记录 / 用户按钮组成一条玻璃胶囊。
    const relocateTitlebarButtons = () => {
        const controls = document.querySelector('.lightbox-native-titlebar .lightbox-native-window-controls');
        const userBtn = document.getElementById('topUserBtn');
        if (controls && userBtn && userBtn.nextElementSibling !== controls) {
            controls.parentElement.insertBefore(userBtn, controls);
        }
        const tools = document.querySelector('.lightbox-native-titlebar .lightbox-native-topbar-tools');
        if (tools) {
            let iconGroup = tools.querySelector('.lightbox-native-icon-capsule');
            if (!iconGroup) {
                iconGroup = document.createElement('div');
                iconGroup.className = 'lightbox-native-icon-capsule';
                iconGroup.setAttribute('role', 'group');
                iconGroup.setAttribute('aria-label', '资产、历史记录与用户');
            }
            ['toolbarAssetBtn', 'shellCanvasProjectMenuBtn', 'lightboxNativeUserToolBtn'].forEach(id => {
                const btn = document.getElementById(id);
                if (btn && btn.parentElement !== iconGroup) iconGroup.appendChild(btn);
            });
            const userToolBtn = document.getElementById('lightboxNativeUserToolBtn');
            if (userToolBtn && userToolBtn.dataset.accountBound !== 'true') {
                userToolBtn.dataset.accountBound = 'true';
                userToolBtn.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    window.SmartCanvasShellSettings?.open?.('account');
                });
            }
            // 日夜切换胶囊放在三图标玻璃胶囊左边
            const themeToggle = document.getElementById('titlebarThemeToggle');
            if (themeToggle && themeToggle.parentElement !== tools) tools.appendChild(themeToggle);
            if (iconGroup.parentElement !== tools) tools.appendChild(iconGroup);
        }
        // 新建按钮挪出左侧栏（左侧栏整条隐藏），与左侧 Agent 按钮并排
        const newBtn = document.getElementById('shellNewCanvasBtn');
        if (newBtn && newBtn.parentElement !== document.body) {
            document.body.appendChild(newBtn);
        }
        // 对话栏右侧操作顺序固定：＋新建 → 精简模式 → 收起。
        const compactBtn = document.querySelector('.lightbox-compact-btn');
        const newChatBtn = document.getElementById('dockShellNewBtn');
        const closeBtn = document.getElementById('gptDockCloseBtn');
        const dockActions = closeBtn?.parentElement || document.querySelector('.dock-chrome-actions');
        if (compactBtn && dockActions) {
            compactBtn.classList.add('dock-chrome-btn');
            compactBtn.removeAttribute('tabindex');
            if (closeBtn) dockActions.insertBefore(compactBtn, closeBtn);
            else if (compactBtn.parentElement !== dockActions) dockActions.appendChild(compactBtn);
        }
        if (newChatBtn && dockActions && compactBtn && newChatBtn.nextElementSibling !== compactBtn) {
            dockActions.insertBefore(newChatBtn, compactBtn);
        }
        // 下拉里不应再出现「新建对话」。
        document.querySelectorAll('.dock-chrome-menu-new, #dockShellMenuNewBtn').forEach(node => node.remove());
    };

    let compactDockWasCollapsed = false;
    let compactDockWasHidden = false;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', relocateTitlebarButtons);
    } else {
        relocateTitlebarButtons();
    }

    // 顶栏日夜切换胶囊：视觉状态由 CSS 跟随主题 class，这里只负责切主题
    document.getElementById('titlebarThemeToggle')?.addEventListener('click', () => {
        try { window.toggleTheme?.(); } catch (_e) {}
    });

    const notifyDockCompact = compact => {
        // iframe 可能尚未加载完成，多发几次（处理是幂等的）
        const frame = document.getElementById('frame-gpt-dock');
        [0, 600, 1500].forEach(delay => setTimeout(() => {
            try { frame?.contentWindow?.postMessage({type: 'lightbox-compact-mode', on: compact}, '*'); } catch(_e) {}
        }, delay));
    };
    const syncCompactState = async state => {
        const compact = state === 'compact';
        const root = document.documentElement;
        if(compact){
            // 精简模式只保留右侧对话栏：强制展开对话栏并加载其 iframe
            compactDockWasCollapsed = root.classList.contains('gpt-dock-collapsed');
            compactDockWasHidden = root.classList.contains('studio-hide-gpt-dock');
            root.classList.remove('studio-hide-gpt-dock');
            window.openGptDock?.();
        }
        root.classList.toggle('lightbox-compact-mode', compact);
        const compactBtn = document.querySelector('.lightbox-compact-btn');
        compactBtn?.classList.toggle('active', compact);
        compactBtn?.setAttribute('aria-pressed', compact ? 'true' : 'false');
        compactBtn?.setAttribute('title', compact ? '回归完整窗口' : '精简模式');
        compactBtn?.setAttribute('aria-label', compact ? '回归完整窗口' : '精简模式');
        window.refreshGptDockGeometry?.();
        notifyDockCompact(compact);
        if(!compact){
            if(compactDockWasCollapsed) window.closeGptDock?.();
            if(compactDockWasHidden) root.classList.add('studio-hide-gpt-dock');
            syncWindowState(await api()?.get_window_state());
        }
    };

    document.querySelectorAll('[data-native-window-action]').forEach(button => {
        button.addEventListener('click', async () => {
            const action = button.dataset.nativeWindowAction;
            if(action === 'minimize') api()?.minimize_window();
            if(action === 'maximize') syncWindowState(await api()?.toggle_maximize_window());
            if(action === 'compact') syncCompactState(await api()?.toggle_compact_window());
            if(action === 'close') api()?.close_window();
        });
    });

    document.querySelectorAll('[data-native-window-resize]').forEach(handle => {
        handle.addEventListener('mousedown', event => {
            if(event.button !== 0 || !api()) return;
            event.preventDefault();
            event.stopPropagation();
            api().start_native_window_interaction(handle.dataset.nativeWindowResize);
        });
    });

    document.querySelector('.gpt-dock .dock-chrome')?.addEventListener('mousedown', event => {
        if(event.button !== 0 || !api()) return;
        if(!document.documentElement.classList.contains('lightbox-compact-mode')) return;
        if(event.target.closest('button, input, a, [role="menu"]')) return;
        event.preventDefault();
        event.stopPropagation();
        api().start_native_window_interaction('move');
    });

    titlebarDragRegion?.addEventListener('mousedown', event => {
        if(event.button !== 0 || !api()) return;
        if(document.documentElement.classList.contains('lightbox-window-maximized')) return;
        // 双击的第二次按下不能启动拖动：拖动线程会和最大化切换赛跑，
        // 把窗口状态与恢复尺寸写坏（表现为回不到窗口化）。
        if(event.detail >= 2) return;
        event.preventDefault();
        event.stopPropagation();
        api().start_native_window_interaction('move');
    });

    // 双击顶栏空白处：最大化 <-> 窗口化 互相切换（与系统标题栏行为一致）
    titlebarDragRegion?.addEventListener('dblclick', async event => {
        if(event.button !== 0 || !api()) return;
        event.preventDefault();
        event.stopPropagation();
        syncWindowState(await api().toggle_maximize_window());
    });

})();
