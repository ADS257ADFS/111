/**
 * Smart Canvas — viewport pan/zoom, minimap, and zoom-preview helpers.
 * @see docs/refactor/前端模块说明.md
 */
(function(global){
    'use strict';

    let deps = null;

    function registerDeps(next){
        deps = next;
    }

    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasViewport] deps not registered');
        return c;
    }

    function nodes(){
        return S().getNodes();
    }


const ZOOM_PREVIEW_NODE_DEFAULT_SCALE = 1;
const ZOOM_PREVIEW_NODE_MAX_SCALE = 1.15;

function fitViewportToPromptNode(node){
    if(!node || !S().shell || !S().world) return;
    const nodeWorld = S().nodeRect(node);
    const margin = {top:18, bottom:18, x:20};
    const toolbarReserve = 52;
    const viewCenterX = S().shell.clientWidth / 2;
    const viewCenterY = margin.top + toolbarReserve + (S().shell.clientHeight - margin.top - margin.bottom - toolbarReserve) / 2;
    const availH = S().shell.clientHeight - margin.top - margin.bottom - toolbarReserve;
    const availW = S().shell.clientWidth - margin.x * 2;
    const scaleH = availH / Math.max(1, nodeWorld.height);
    const scaleW = availW / Math.max(1, nodeWorld.width);
    const targetScale = Math.max(0.06, Math.min(3, Math.min(scaleH, scaleW)));
    const cx = nodeWorld.x + nodeWorld.width / 2;
    const cy = nodeWorld.y + nodeWorld.height / 2;
    const targetX = viewCenterX - cx * targetScale;
    const targetY = viewCenterY - cy * targetScale;
    animateViewportTo({x:targetX, y:targetY, scale:targetScale}, {duration: 280});
}

function applyViewport(options={}){
    S().viewport.scale = S().safeScale(S().viewport.scale);
    global.dispatchEvent(new CustomEvent('smart-canvas-viewport-change', {
        detail:{scale:S().viewport.scale}
    }));
    const transientTransform = Boolean(options.transformOnly || options.light);
    S().world.classList.toggle('viewport-transform-active', transientTransform);
    if(transientTransform){
        S().world.style.transform = `translate3d(${S().viewport.x}px, ${S().viewport.y}px, 0) scale(${S().viewport.scale})`;
    } else {
        const devicePixelRatio = Math.max(1, Number(global.devicePixelRatio) || 1);
        S().viewport.x = Math.round(S().viewport.x * devicePixelRatio) / devicePixelRatio;
        S().viewport.y = Math.round(S().viewport.y * devicePixelRatio) / devicePixelRatio;
        S().world.style.transform = `translate(${S().viewport.x}px, ${S().viewport.y}px) scale(${S().viewport.scale})`;
    }
    if(options.transformOnly) return;
    S().world.style.setProperty('--world-scale', String(S().viewport.scale));
    // Keep the generation wave readable when the canvas is zoomed out without
    // letting it grow beyond the pending card. Ports use the same screen-size
    // compensation principle, but the loader is deliberately capped.
    const generationLoaderCompensation = Math.min(2.4, Math.max(1, 1 / S().viewport.scale));
    S().world.style.setProperty('--generation-loader-compensation', String(generationLoaderCompensation));
    if(options.light) return;
    S().shell.style.backgroundSize = '24px 24px';
    S().shell.style.backgroundPosition = '0 0';
    updateMinimapViewport();
    S().positionImageQuickToolbar();
    if(S().selectionMarqueeActive) S().positionSelectionGroupBox();
    if(S().composer?.classList.contains('open')){
        S().positionComposerForNode(S().selectedNode());
    }
}

function worldToScreen(wx, wy){
    return {
        x: S().viewport.x + wx * S().viewport.scale,
        y: S().viewport.y + wy * S().viewport.scale
    };
}

function cancelViewportAnimation(){
    S().viewportAnimToken++;
    if(S().viewportAnimFrame){
        cancelAnimationFrame(S().viewportAnimFrame);
        S().viewportAnimFrame = 0;
    }
}

function easeOutCubic(t){
    return 1 - Math.pow(1 - t, 3);
}

function animateViewportTo(target, options={}){
    cancelViewportAnimation();
    const duration = Math.max(160, Math.min(900, Number(options.duration) || 520));
    const from = {x:S().viewport.x, y:S().viewport.y, scale:S().viewport.scale};
    const to = {
        x:Number(target.x) || 0,
        y:Number(target.y) || 0,
        scale:S().safeScale(Number(target.scale) || S().viewport.scale)
    };
    const token = ++S().viewportAnimToken;
    const start = performance.now();
    const step = now => {
        if(token !== S().viewportAnimToken) return;
        const t = Math.min(1, (now - start) / duration);
        const k = easeOutCubic(t);
        const nextScale = from.scale + (to.scale - from.scale) * k;
        const liveTargetX = typeof options.resolveX === 'function'
            ? Number(options.resolveX({scale:nextScale, progress:t}))
            : NaN;
        const targetX = Number.isFinite(liveTargetX) ? liveTargetX : to.x;
        S().viewport.x = from.x + (targetX - from.x) * k;
        S().viewport.y = from.y + (to.y - from.y) * k;
        S().viewport.scale = nextScale;
        applyViewport({light: true});
        if(t < 1){
            S().viewportAnimFrame = requestAnimationFrame(step);
            return;
        }
        S().viewportAnimFrame = 0;
        const finalTargetX = typeof options.resolveX === 'function'
            ? Number(options.resolveX({scale:to.scale, progress:1}))
            : NaN;
        S().viewport.x = Number.isFinite(finalTargetX) ? finalTargetX : to.x;
        S().viewport.y = to.y;
        S().viewport.scale = to.scale;
        applyViewport();
        options.onDone?.();
        S().scheduleSave();
    };
    S().viewportAnimFrame = requestAnimationFrame(step);
}

function screenToWorld(event){
    const rect = S().shell.getBoundingClientRect();
    return {
        x:(event.clientX - rect.left - S().viewport.x) / S().viewport.scale,
        y:(event.clientY - rect.top - S().viewport.y) / S().viewport.scale
    };
}

function viewportCenter(){
    return {
        x:(S().shell.clientWidth / 2 - S().viewport.x) / S().viewport.scale,
        y:(S().shell.clientHeight / 2 - S().viewport.y) / S().viewport.scale
    };
}

function minimapIsOpen(){
    return Boolean(S().minimap?.classList?.contains('open'));
}

function minimapViewRect(){
    return {
        x:-S().viewport.x / S().viewport.scale,
        y:-S().viewport.y / S().viewport.scale,
        width:S().shell.clientWidth / S().viewport.scale,
        height:S().shell.clientHeight / S().viewport.scale
    };
}

function projectMinimapRect(rect, state){
    return {
        left:state.offsetX + (rect.x - state.minX) * state.scale,
        top:state.offsetY + (rect.y - state.minY) * state.scale,
        width:Math.max(4, rect.width * state.scale),
        height:Math.max(4, rect.height * state.scale)
    };
}

function updateMinimapViewport(){
    if(!minimapIsOpen()) return;
    const state = S().smartMinimapState;
    const viewportEl = S().minimapViewport;
    if(!state || !viewportEl?.isConnected){
        renderMinimap();
        return;
    }
    const view = minimapViewRect();
    const outsideBounds = view.x < state.minX || view.y < state.minY
        || view.x + view.width > state.maxX || view.y + view.height > state.maxY;
    if(outsideBounds){
        renderMinimap();
        return;
    }
    const projected = projectMinimapRect(view, state);
    viewportEl.style.left = `${projected.left}px`;
    viewportEl.style.top = `${projected.top}px`;
    viewportEl.style.width = `${projected.width}px`;
    viewportEl.style.height = `${projected.height}px`;
}

function renderMinimap(){
    if(!minimapIsOpen() || !S().minimapContent) return;
    const width = S().minimapContent.clientWidth || 170;
    const height = S().minimapContent.clientHeight || 108;
    const view = minimapViewRect();
    const rects = nodes().map(S().nodeRect);
    rects.push(view);
    const minX = Math.min(...rects.map(r => r.x), -200);
    const minY = Math.min(...rects.map(r => r.y), -200);
    const maxX = Math.max(...rects.map(r => r.x + r.width), view.x + view.width + 200);
    const maxY = Math.max(...rects.map(r => r.y + r.height), view.y + view.height + 200);
    const scale = Math.min(width / Math.max(1, maxX - minX), height / Math.max(1, maxY - minY));
    const offsetX = (width - (maxX - minX) * scale) / 2;
    const offsetY = (height - (maxY - minY) * scale) / 2;
    const state = {minX, minY, maxX, maxY, scale, offsetX, offsetY, width, height};
    S().smartMinimapState = state;
    const nodeHtml = rects.slice(0, -1).map(r => {
        const p = projectMinimapRect(r, state);
        return `<div class="minimap-node" style="left:${p.left}px;top:${p.top}px;width:${p.width}px;height:${p.height}px"></div>`;
    }).join('');
    const projectedView = projectMinimapRect(view, state);
    S().minimapContent.innerHTML = `${nodeHtml}<div id="minimapViewport" class="smart-minimap-viewport" style="left:${projectedView.left}px;top:${projectedView.top}px;width:${projectedView.width}px;height:${projectedView.height}px"></div>`;
    S().minimapViewport = document.getElementById('minimapViewport');
}

function minimapEventToWorld(event){
    if(!S().smartMinimapState) renderMinimap();
    const state = S().smartMinimapState;
    if(!state) return viewportCenter();
    const rect = S().minimapContent.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    return {
        x:state.minX + (mx - state.offsetX) / Math.max(0.0001, state.scale),
        y:state.minY + (my - state.offsetY) / Math.max(0.0001, state.scale)
    };
}

function centerViewportOnWorldPoint(point){
    S().viewport.x = S().shell.clientWidth / 2 - point.x * S().viewport.scale;
    S().viewport.y = S().shell.clientHeight / 2 - point.y * S().viewport.scale;
    applyViewport();
    S().scheduleSave();
}

function getElementWorldRect(el){
    if(!el || !S().shell) return null;
    const shellRect = S().shell.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const s = Math.max(0.0001, S().viewport.scale);
    return {
        x:(r.left - shellRect.left - S().viewport.x) / s,
        y:(r.top - shellRect.top - S().viewport.y) / s,
        width:Math.max(1, r.width / s),
        height:Math.max(1, r.height / s)
    };
}

function composerHorizontalCenter(){
    const fallback = S().shell.clientWidth / 2;
    if(!S().composer) return fallback;
    const composerFrame = S().composer.querySelector?.('.composer-card') || S().composer;
    const shellRect = S().shell.getBoundingClientRect();
    const composerRect = composerFrame.getBoundingClientRect();
    if(!Number.isFinite(composerRect.left) || composerRect.width <= 0) return fallback;
    return composerRect.left - shellRect.left + composerRect.width / 2;
}

function composerAlignedViewportX(worldCenterX, scale){
    return composerHorizontalCenter() - worldCenterX * scale;
}

function settleImageAtComposerCenter(worldCenterX, scale, duration=520, options={}){
    const token = S().viewportAnimToken;
    const start = performance.now();
    const step = now => {
        if(token !== S().viewportAnimToken) return;
        if(options.requireOpen !== false && !S().composer?.classList.contains('open')) return;
        const desiredX = composerAlignedViewportX(worldCenterX, scale);
        if(Math.abs(S().viewport.x - desiredX) > 0.1){
            S().viewport.x = desiredX;
            applyViewport({light:true});
        }
        if(now - start < duration){
            requestAnimationFrame(step);
            return;
        }
        applyViewport();
        S().scheduleSave();
    };
    requestAnimationFrame(step);
}

function fitViewportToImageWithComposer(node, imageEl){
    if(!node || !S().shell || !S().world) return;
    const nodeEl = S().world.querySelector(`.image-node[data-id="${CSS.escape(node.id)}"]`);
    if(!nodeEl) return;
    const targetEl = imageEl?.closest?.('.thumb-item,.image-wrap') || imageEl || S().selectedImageElement() || nodeEl;
    const imageWorld = getElementWorldRect(targetEl) || S().nodeRect(node);
    const nodeWorld = S().nodeRect(node);
    const gap = 14;
    const margin = {top:18, bottom:18, x:20};
    const toolbarReserve = 52;
    const showComposer = S().isSmartImageNode(node);
    const composerBottomGap = 24;
    const composerH = showComposer && S().composer?.classList.contains('open') ? (S().composer.offsetHeight || 220) + composerBottomGap : 0;
    const worldSpanH = Math.max(imageWorld.height, nodeWorld.y + nodeWorld.height - imageWorld.y);
    const worldSpanW = Math.max(imageWorld.width, nodeWorld.width);
    const availH = S().shell.clientHeight - margin.top - margin.bottom - gap - composerH - toolbarReserve;
    const availW = S().shell.clientWidth - margin.x * 2;
    const scaleH = availH / Math.max(1, worldSpanH);
    const scaleW = availW / Math.max(1, worldSpanW);
    const targetScale = Math.max(0.06, Math.min(3, Math.min(scaleH, scaleW)));
    const cx = imageWorld.x + imageWorld.width / 2;
    const targetX = composerAlignedViewportX(cx, targetScale);
    const targetY = margin.top + toolbarReserve - imageWorld.y * targetScale;
    animateViewportTo({x:targetX, y:targetY, scale:targetScale}, {
        duration: 280,
        // The composer can shift while the right chat dock opens/resizes.
        // Track its live horizontal center throughout the zoom so the image
        // finishes aligned to the bottom panel rather than the canvas.
        resolveX: ({scale}) => composerAlignedViewportX(cx, scale),
        onDone(){
            S().positionComposerForNode(node);
            S().positionImageQuickToolbar();
            // The bottom composer can keep moving briefly after the zoom
            // (for example while the right dock changes width). Keep the
            // selected image locked to the composer's live center until that
            // layout motion has settled.
            settleImageAtComposerCenter(cx, targetScale);
        }
    });
}

function fitViewportToImageForInlineBrush(node, imageEl, options={}){
    if(!node || !S().shell || !S().world) return;
    const nodeEl = S().world.querySelector(`.image-node[data-id="${CSS.escape(node.id)}"]`);
    if(!nodeEl) return;
    const targetEl = imageEl?.closest?.('.thumb-item,.image-wrap') || imageEl || S().selectedImageElement() || nodeEl;
    const imageWorld = getElementWorldRect(targetEl) || S().nodeRect(node);
    const margin = {top:18, bottom:18, x:20};
    const toolbarReserve = 52;
    const gap = 14;
    const availH = S().shell.clientHeight - margin.top - margin.bottom - gap - toolbarReserve;
    const availW = S().shell.clientWidth - margin.x * 2;
    const fitScale = Math.min(availH / Math.max(1, imageWorld.height), availW / Math.max(1, imageWorld.width));
    const targetScale = Math.max(0.06, Math.min(3, fitScale * 0.86));
    const cx = imageWorld.x + imageWorld.width / 2;
    const viewportX = scale => options.alignToComposer
        ? composerAlignedViewportX(cx, scale)
        : S().shell.clientWidth / 2 - cx * scale;
    animateViewportTo({
        x:viewportX(targetScale),
        y:margin.top + toolbarReserve - imageWorld.y * targetScale,
        scale:targetScale
    }, {
        duration:280,
        resolveX:options.alignToComposer ? ({scale}) => viewportX(scale) : undefined,
        onDone(){
            S().positionImageQuickToolbar();
            if(options.alignToComposer){
                settleImageAtComposerCenter(cx, targetScale, 520, {requireOpen:false});
            }
        }
    });
}

function revealNodesAfterInlineEdit(sourceNode, outputNode, preferredViewport){
    if(!sourceNode || !outputNode || !S().shell || !S().world) return false;
    const rects = [S().nodeRect(sourceNode), S().nodeRect(outputNode)].filter(Boolean);
    if(rects.length !== 2) return false;
    const minX = Math.min(...rects.map(rect => rect.x));
    const minY = Math.min(...rects.map(rect => rect.y));
    const maxX = Math.max(...rects.map(rect => rect.x + rect.width));
    const maxY = Math.max(...rects.map(rect => rect.y + rect.height));
    const spanW = Math.max(1, maxX - minX);
    const spanH = Math.max(1, maxY - minY);
    const margin = {top:72, bottom:28, x:44};
    const composerReserve = S().composer?.classList.contains('open')
        ? (S().composer.offsetHeight || 220) + 24
        : 0;
    const availW = Math.max(120, S().shell.clientWidth - margin.x * 2);
    const availH = Math.max(120, S().shell.clientHeight - margin.top - margin.bottom - composerReserve);
    const fitScale = Math.min(availW / spanW, availH / spanH);
    const preferredScale = Number(preferredViewport?.scale) || S().viewport.scale;
    const targetScale = Math.max(0.06, Math.min(3, preferredScale, fitScale));
    const centerX = minX + spanW / 2;
    const centerY = minY + spanH / 2;
    const viewCenterY = margin.top + availH / 2;
    animateViewportTo({
        x:S().shell.clientWidth / 2 - centerX * targetScale,
        y:viewCenterY - centerY * targetScale,
        scale:targetScale
    }, {
        duration:280,
        onDone(){
            S().positionImageQuickToolbar();
            if(S().composer?.classList.contains('open')) S().positionComposerForNode(outputNode);
        }
    });
    return true;
}

function fitAllNodesViewport(){
    if(!nodes().length){
        S().viewport.scale = 0.45;
        S().viewport.x = S().shell.clientWidth / 2;
        S().viewport.y = S().shell.clientHeight / 2;
        applyViewport();
        S().scheduleSave();
        return;
    }
    const rects = nodes().map(S().nodeRect);
    const minX = Math.min(...rects.map(r => r.x));
    const minY = Math.min(...rects.map(r => r.y));
    const maxX = Math.max(...rects.map(r => r.x + r.width));
    const maxY = Math.max(...rects.map(r => r.y + r.height));
    const pad = 160;
    const width = Math.max(1, maxX - minX + pad * 2);
    const height = Math.max(1, maxY - minY + pad * 2);
    const nextScale = Math.max(0.06, Math.min(0.82, (S().shell.clientWidth - 80) / width, (S().shell.clientHeight - 80) / height));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    S().viewport.scale = nextScale;
    S().viewport.x = S().shell.clientWidth / 2 - cx * S().viewport.scale;
    S().viewport.y = S().shell.clientHeight / 2 - cy * S().viewport.scale;
    applyViewport();
    S().scheduleSave();
}

function enterZoomPreview(){
    if(S().zoomPreviewState) return;
    S().zoomPreviewState = {...S().viewport};
    S().shell.classList.add('zoom-preview');
    S().closeCreateMenu();
    fitAllNodesViewport();
}

function exitZoomPreview(point=null){
    if(!S().zoomPreviewState) return false;
    const prev = S().zoomPreviewState;
    S().zoomPreviewState = null;
    S().shell.classList.remove('zoom-preview');
    S().viewport.scale = prev.scale;
    if(point){
        S().viewport.x = S().shell.clientWidth / 2 - point.x * S().viewport.scale;
        S().viewport.y = S().shell.clientHeight / 2 - point.y * S().viewport.scale;
    } else {
        S().viewport.x = prev.x;
        S().viewport.y = prev.y;
    }
    applyViewport();
    S().scheduleSave();
    return true;
}

function toggleZoomPreview(){
    if(S().zoomPreviewState) exitZoomPreview();
    else enterZoomPreview();
}

    function exitZoomPreviewToNode(nodeId){
 if(!S().zoomPreviewState) return false;
 const node = nodes().find(n => n.id === nodeId);
 if(!node) return exitZoomPreview();
 const prev = S().zoomPreviewState;
 const rect = S().nodeRect(node);
 const cx = rect.x + rect.width / 2;
 const cy = rect.y + rect.height / 2;
 const fitW = Math.max(1, S().shell.clientWidth - 160);
 const fitH = Math.max(1, S().shell.clientHeight - 160);
 const fitScale = Math.min(
 ZOOM_PREVIEW_NODE_MAX_SCALE,
 fitW / Math.max(1, rect.width),
 fitH / Math.max(1, rect.height)
 );
 const readableScale = Math.min(ZOOM_PREVIEW_NODE_MAX_SCALE, Math.max(ZOOM_PREVIEW_NODE_DEFAULT_SCALE, fitScale));
 S().zoomPreviewState = null;
 S().shell.classList.remove('zoom-preview');
 S().viewport.scale = Math.max(S().safeScale(prev.scale), readableScale);
 S().viewport.x = S().shell.clientWidth / 2 - cx * S().viewport.scale;
 S().viewport.y = S().shell.clientHeight / 2 - cy * S().viewport.scale;
 applyViewport();
 S().scheduleSave();
 return true;
}
/* 对话栏（左侧 dock）开合时，画布内容与底部输入框一样整体避让。
   shell 会把 --shell-chat-dock-width 写到本文档 html 的 style 上，
   composer 靠这个 CSS 变量平移；世界层 transform 由 JS 管理，这里
   监听同一变量，把视口横向平移 delta/2（与 composer 重新居中量一致）。 */
let dockInsetLast = null;
let dockPanTargetX = null;

function readShellDockInset(){
    const raw = global.getComputedStyle(global.document.documentElement)
        .getPropertyValue('--shell-chat-dock-width');
    return parseFloat(raw) || 0;
}

function handleShellDockInsetChange(){
    const inset = readShellDockInset();
    if(dockInsetLast === null){
        dockInsetLast = inset;
        return;
    }
    if(Math.abs(inset - dockInsetLast) < 0.5) return;
    const delta = (inset - dockInsetLast) / 2;
    dockInsetLast = inset;
    if(!deps || !deps.shell || !deps.world) return;
    if(deps.zoomPreviewState) return;
    const animating = Boolean(deps.viewportAnimFrame);
    const baseX = (animating && dockPanTargetX !== null) ? dockPanTargetX : deps.viewport.x;
    const targetX = baseX + delta;
    const motion = global.getComputedStyle(global.document.documentElement)
        .getPropertyValue('--shell-chat-dock-motion') || '';
    if(/^\s*0(m?s)?\b/.test(motion.trim())){
        // 拖拽调宽对话栏时 motion 为 0ms，直接跟手，不做补间
        cancelViewportAnimation();
        dockPanTargetX = null;
        deps.viewport.x = targetX;
        applyViewport();
        return;
    }
    dockPanTargetX = targetX;
    animateViewportTo(
        {x:targetX, y:deps.viewport.y, scale:deps.viewport.scale},
        {duration:260, onDone:() => { dockPanTargetX = null; }}
    );
}

(function bindShellDockInsetWatcher(){
    const root = global.document?.documentElement;
    if(!root || typeof MutationObserver !== 'function') return;
    dockInsetLast = readShellDockInset();
    new MutationObserver(handleShellDockInsetChange)
        .observe(root, {attributes:true, attributeFilter:['style']});
})();

    const api = Object.freeze({
        exitZoomPreviewToNode,
        registerDeps,
        fitViewportToPromptNode,
        applyViewport,
        worldToScreen,
        cancelViewportAnimation,
        easeOutCubic,
        animateViewportTo,
        screenToWorld,
        viewportCenter,
        renderMinimap,
        minimapEventToWorld,
        centerViewportOnWorldPoint,
        getElementWorldRect,
        composerHorizontalCenter,
        composerAlignedViewportX,
        settleImageAtComposerCenter,
        fitViewportToImageWithComposer,
        fitViewportToImageForInlineBrush,
        revealNodesAfterInlineEdit,
        fitAllNodesViewport,
        enterZoomPreview,
        exitZoomPreview,
        toggleZoomPreview
    });

    if(global.SmartCanvasCore){
        global.SmartCanvasCore.register('viewport', api);
    }
    global.SmartCanvasViewport = api;
})(window);
