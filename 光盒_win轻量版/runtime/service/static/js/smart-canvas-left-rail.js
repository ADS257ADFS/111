/**
 * Smart Canvas — shell bridge for toolbar asset/new-canvas + standalone fab.
 */
(function(global){
    'use strict';

    let shellMessageBound = false;
    const ASSET_PANEL_WIDTH_KEY = 'smart_canvas_asset_panel_width';
    const ASSET_PANEL_FIXED_WIDTH = 396;

    function clampAssetPanelWidth() {
        return ASSET_PANEL_FIXED_WIDTH;
    }

    function readSavedAssetPanelWidth() {
        return ASSET_PANEL_FIXED_WIDTH;
    }

    function applyAssetPanelWidth(width, remember = true) {
        const next = clampAssetPanelWidth(width);
        try {
            if (remember) global.localStorage?.setItem?.(ASSET_PANEL_WIDTH_KEY, String(next));
        } catch(e) {}
        global.document?.documentElement?.style.setProperty('--asset-panel-width', `${next}px`);
        const panel = global.document?.getElementById?.('assetPanel');
        if (panel) {
            panel.style.width = `${next}px`;
            panel.style.maxWidth = `${next}px`;
        }
        notifyShellAssetPanelWidth(next);
        return next;
    }

    function notifyShellAssetPanelWidth(width){
        if(!isShellEmbedded()) return;
        try {
            global.parent.postMessage({ type: 'shell-asset-panel-width', width }, '*');
        } catch(e) {}
    }

    function syncAssetPanelModeWidth(tab){
        const promptMode = tab === 'prompt';
        const panel = global.document?.getElementById?.('assetPanel');
        panel?.classList?.toggle('is-prompt-mode', promptMode);
        const width = ASSET_PANEL_FIXED_WIDTH;
        notifyShellAssetPanelWidth(width);
        return width;
    }

    function ensureAssetPanelResizeHandle() {
        const panel = global.document?.getElementById?.('assetPanel');
        if (!panel) return;
        let handle = panel.querySelector('.asset-panel-resize-handle');
        if (!handle) {
            handle = global.document.createElement('div');
            handle.className = 'asset-panel-resize-handle';
            handle.setAttribute('aria-hidden', 'true');
            panel.appendChild(handle);
        }
        if (handle.dataset.bound === '1') return;
        handle.dataset.bound = '1';

        let resizing = false;
        let startX = 0;
        let startWidth = 0;
        let resizeFrame = 0;
        let pendingWidth = null;

        const paintWidth = () => {
            resizeFrame = 0;
            if (pendingWidth == null) return;
            applyAssetPanelWidth(pendingWidth, false);
        };

        const stopResize = () => {
            if (!resizing) return;
            resizing = false;
            if (resizeFrame) {
                global.cancelAnimationFrame(resizeFrame);
                resizeFrame = 0;
            }
            if (pendingWidth != null) {
                applyAssetPanelWidth(pendingWidth, true);
                pendingWidth = null;
            }
            global.document?.body?.classList?.remove('asset-panel-resizing');
        };

        const onPointerMove = event => {
            if (!resizing) return;
            pendingWidth = startWidth + (event.clientX - startX);
            if (!resizeFrame) resizeFrame = global.requestAnimationFrame(paintWidth);
        };

        const onPointerUp = () => {
            stopResize();
            global.removeEventListener('pointermove', onPointerMove);
            global.removeEventListener('pointerup', onPointerUp);
            global.removeEventListener('pointercancel', onPointerUp);
        };

        handle.addEventListener('pointerdown', event => {
            if (event.button != null && event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            resizing = true;
            startX = event.clientX;
            startWidth = readSavedAssetPanelWidth();
            pendingWidth = startWidth;
            global.document?.body?.classList?.add('asset-panel-resizing');
            global.addEventListener('pointermove', onPointerMove);
            global.addEventListener('pointerup', onPointerUp);
            global.addEventListener('pointercancel', onPointerUp);
        });
    }

    function initAssetPanelWidth() {
        const width = readSavedAssetPanelWidth();
        applyAssetPanelWidth(width, true);
        ensureAssetPanelResizeHandle();
    }

    function closeAssetLibrarySilent(ctx){
        if(!ctx?.assetPanel) return;
        ctx.assetLibraryOpen = false;
        ctx.hideAssetHoverPreview?.();
        ctx.assetPanel.classList.remove('open');
        ctx.assetPanel.inert = true;
        ctx.assetPanel.setAttribute('aria-hidden', 'true');
        const assetToggle = ctx.assetToggle || global.document?.getElementById?.('assetToggle');
        if(assetToggle){
            assetToggle.classList.remove('active');
            assetToggle.setAttribute('aria-pressed', 'false');
        }
    }

    initAssetPanelWidth();

    function deps(){
        return global.SmartCanvasCore?.tryDeps?.() ?? null;
    }

    function isShellEmbedded(){
        return Boolean(global.parent && global.parent !== global);
    }

    function markShellEmbedded(){
        if(isShellEmbedded()){
            global.document?.documentElement?.classList.add('is-shell-embedded');
        }
    }

    function notifyShellAssetState(open){
        if(!isShellEmbedded()) return;
        try {
            const parentWin = global.parent;
            if(!open){
                parentWin._assetLibraryGhostClickUntil = Date.now() + 450;
            }
            if(typeof parentWin.syncShellAssetLibraryChrome === 'function') {
                parentWin.syncShellAssetLibraryChrome(!!open);
                return;
            }
            if(!open && typeof parentWin.closeShellAssetLibrary === 'function') {
                parentWin.closeShellAssetLibrary({ fromCanvas: true });
                return;
            }
            if(open && typeof parentWin.openShellAssetLibrary === 'function') {
                parentWin.openShellAssetLibrary({ fromCanvas: true });
                return;
            }
            global.parent.postMessage({ type: 'canvas-asset-library-state', open: !!open }, '*');
        } catch(e) {}
    }

    function notifyShellCloseOverlays(){
        if(!isShellEmbedded()) return;
        try {
            const parentWin = global.parent;
            if(typeof parentWin.closeShellCanvasHistory === 'function'){
                parentWin.closeShellCanvasHistory();
            }
        } catch(e) {}
    }

    function handleShellMessage(event){
        if(!isShellEmbedded() || event.source !== global.parent) return;
        const data = event.data || {};
        const ctx = deps();
        if(!ctx) return;
        if(data.type === 'shell-asset-overlay'){
            global.document?.documentElement?.classList.toggle('is-shell-asset-peek', Boolean(data.active));
            return;
        }
        if(data.type === 'toggle-asset-library'){
            ctx.toggleAssetLibrary?.();
            return;
        }
        if(data.type === 'set-asset-library-open'){
            const want = Boolean(data.open);
            const panelOpen = Boolean(ctx.assetPanel?.classList?.contains('open'));
            if(ctx.assetLibraryOpen === want && panelOpen === want) return;
            if(!want && data.silent){
                closeAssetLibrarySilent(ctx);
                return;
            }
            ctx.toggleAssetLibrary?.(want);
            return;
        }
        if(data.type === 'shell-left-rail-recessed'){
            global.document?.documentElement?.classList.toggle('shell-left-rail-recessed', Boolean(data.recessed));
            return;
        }
        if(data.type === 'shell-reveal-empty-chrome'){
            global.SmartCanvasCanvasHint?.revealEmptyChrome?.();
            return;
        }
        if(data.type === 'shell-new-canvas'){
            ctx.createNewSmartCanvas?.().catch?.(() => ctx.toast?.('创建画布失败'));
        }
    }

    function bindShellMessages(){
        if(shellMessageBound) return;
        shellMessageBound = true;
        global.addEventListener('message', handleShellMessage);
    }

    function bindRailButton(el, handler){
        if(!el || el.dataset.boundLeftRail === '1') return;
        el.dataset.boundLeftRail = '1';
        el.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            handler(event);
        });
        el.addEventListener('mousedown', event => event.stopPropagation(), true);
    }

    function bindLeftRail(ctx){
        markShellEmbedded();
        bindShellMessages();
        initAssetPanelWidth();
        if(!ctx) ctx = deps();
        if(!ctx) return;

        if(!isShellEmbedded()){
            bindRailButton(ctx.newCanvasBtn, async () => {
                try {
                    await ctx.createNewSmartCanvas?.();
                } catch(e) {
                    ctx.toast?.('创建画布失败');
                }
            });
        }
    }

    const api = Object.freeze({
        bindLeftRail,
        notifyShellAssetState,
        notifyShellCloseOverlays,
        syncAssetPanelModeWidth,
        isShellEmbedded
    });

    global.SmartCanvasCore?.register?.('leftRail', api);
    global.SmartCanvasLeftRail = api;
    markShellEmbedded();
    bindShellMessages();
})(window);
