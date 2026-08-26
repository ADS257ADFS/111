/**
 * Smart Canvas — bottom-left fit-view capsule.
 */
(function(global){
    'use strict';

    let bound = false;
    const ZOOM_STEP = 0.1;
    // Core 的 tryDeps() 对象上没有 minimap / renderMinimap，
    // 必须用 bindBottomChrome 传入的 ui-context ctx
    let boundCtx = null;

    function deps(){
        return boundCtx ?? global.SmartCanvasCore?.tryDeps?.() ?? null;
    }

    function isMinimapOpen(){
        return Boolean(deps()?.minimap?.classList?.contains('open'));
    }

    function toggleMinimap(){
        const ctx = deps();
        const el = ctx?.minimap;
        if(!el) return false;
        const open = !el.classList.contains('open');
        el.classList.toggle('open', open);
        el.setAttribute('aria-hidden', open ? 'false' : 'true');
        if(open) ctx.renderMinimap?.();
        const btn = document.getElementById('canvasMinimapToggle');
        btn?.classList.toggle('active', open);
        btn?.setAttribute('aria-pressed', open ? 'true' : 'false');
        return open;
    }

    function bindBtn(el, handler){
        if(!el || el.dataset.boundBottomChrome === '1') return;
        el.dataset.boundBottomChrome = '1';
        el.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            handler(event);
        });
        el.addEventListener('mousedown', event => event.stopPropagation(), true);
    }

    function zoomElements(){
        return {
            menuBtn:document.getElementById('canvasZoomMenuBtn'),
            menu:document.getElementById('canvasZoomMenu'),
            value:document.getElementById('canvasZoomValue')
        };
    }

    function updateZoomUi(scale=deps()?.viewport?.scale){
        const {menuBtn, menu, value} = zoomElements();
        const normalized = Number.isFinite(Number(scale)) ? Number(scale) : 1;
        const percent = Math.round(normalized * 100);
        if(value) value.textContent = `${percent}%`;
        if(menuBtn) menuBtn.setAttribute('aria-label', `视角比例，当前 ${percent}%`);
        menu?.querySelectorAll('[data-zoom-scale]').forEach(item => {
            const active = Math.abs(Number(item.dataset.zoomScale) - normalized) < 0.005;
            item.classList.toggle('is-active', active);
            item.setAttribute('aria-checked', active ? 'true' : 'false');
        });
    }

    function closeZoomMenu(){
        const {menuBtn, menu} = zoomElements();
        if(!menu || menu.hidden) return;
        menu.hidden = true;
        menuBtn?.setAttribute('aria-expanded', 'false');
    }

    function toggleZoomMenu(){
        const {menuBtn, menu} = zoomElements();
        if(!menu) return;
        const open = menu.hidden;
        menu.hidden = !open;
        menuBtn?.setAttribute('aria-expanded', open ? 'true' : 'false');
        if(open) menu.querySelector('.ui-menu-item')?.focus({preventScroll:true});
    }

    function setZoom(scale){
        const ctx = deps();
        if(!ctx?.shell || !ctx?.viewport) return;
        const currentScale = Number(ctx.viewport.scale) || 1;
        const nextScale = ctx.safeScale?.(scale) ?? Number(scale);
        if(!Number.isFinite(nextScale) || Math.abs(nextScale - currentScale) < 0.0001){
            updateZoomUi(currentScale);
            return;
        }
        const centerX = ctx.shell.clientWidth / 2;
        const centerY = ctx.shell.clientHeight / 2;
        const worldX = (centerX - ctx.viewport.x) / currentScale;
        const worldY = (centerY - ctx.viewport.y) / currentScale;
        ctx.animateViewportTo?.({
            x:centerX - worldX * nextScale,
            y:centerY - worldY * nextScale,
            scale:nextScale
        }, {duration:220});
    }

    function changeZoom(direction){
        const scale = Number(deps()?.viewport?.scale) || 1;
        setZoom(Math.round((scale + direction * ZOOM_STEP) * 10) / 10);
    }

    function handleZoomMenuClick(event){
        const item = event.target.closest('.canvas-zoom-menu-item');
        if(!item) return;
        event.preventDefault();
        event.stopPropagation();
        const action = item.dataset.zoomAction;
        if(action === 'out') changeZoom(-1);
        if(action === 'in') changeZoom(1);
        if(action === 'fit') deps()?.fitAllNodesViewport?.();
        if(item.dataset.zoomScale) setZoom(Number(item.dataset.zoomScale));
        closeZoomMenu();
    }

    function bindZoomControls(){
        const {menuBtn, menu} = zoomElements();
        bindBtn(document.getElementById('canvasZoomOutBtn'), () => changeZoom(-1));
        bindBtn(document.getElementById('canvasZoomInBtn'), () => changeZoom(1));
        bindBtn(menuBtn, toggleZoomMenu);
        menu?.addEventListener('click', handleZoomMenuClick);
        menu?.addEventListener('mousedown', event => event.stopPropagation(), true);
        document.addEventListener('pointerdown', event => {
            if(!event.target.closest('.canvas-zoom-menu-wrap')) closeZoomMenu();
        }, true);
        document.addEventListener('keydown', event => {
            if(event.key === 'Escape'){
                closeZoomMenu();
                return;
            }
            const editable = event.target?.closest?.('input, textarea, select, [contenteditable="true"]');
            if(editable) return;
            const commandKey = event.ctrlKey || event.metaKey;
            if(commandKey && (event.key === '-' || event.code === 'NumpadSubtract')){
                event.preventDefault();
                changeZoom(-1);
            } else if(commandKey && (event.key === '+' || event.key === '=' || event.code === 'NumpadAdd')){
                event.preventDefault();
                changeZoom(1);
            } else if(event.shiftKey && event.code === 'Digit1'){
                event.preventDefault();
                deps()?.fitAllNodesViewport?.();
            }
        });
        global.addEventListener('smart-canvas-viewport-change', event => updateZoomUi(event.detail?.scale));
        updateZoomUi();
    }

    function bindBottomChrome(ctx){
        if(!ctx) ctx = deps();
        if(!ctx || bound) return;
        bound = true;
        boundCtx = ctx;

        ctx.toggleMinimap = toggleMinimap;
        ctx.isMinimapOpen = isMinimapOpen;
        bindBtn(document.getElementById('canvasArrangeAllBtn'), () => global.SmartCanvasNodeEvents?.arrangeAllCanvasNodes?.());
        bindZoomControls();
        bindBtn(ctx.canvasFitViewBtn, () => ctx.fitAllNodesViewport?.());
        bindBtn(document.getElementById('canvasMinimapToggle'), toggleMinimap);
    }

    const api = Object.freeze({ bindBottomChrome, toggleMinimap, isMinimapOpen });

    global.SmartCanvasCore?.register?.('bottomChrome', api);
    global.SmartCanvasBottomChrome = api;
})(window);
