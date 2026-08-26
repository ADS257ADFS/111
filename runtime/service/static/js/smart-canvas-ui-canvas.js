/**
 * Smart Canvas — canvas shell interaction (pan/zoom/dblclick, create menu, minimap).
 * @see SmartCanvasCore.BOUNDARIES.uiCanvas
 */
(function(global){
    'use strict';
    const UNIFIED_PROMPT_MIN_WIDTH = 400;
    let canvasBound = false;
    let viewportApplyFrame = 0;
    let viewportSettleTimer = 0;
    let dynamicLineSyncFrame = 0;
    const entryBounceTimers = new WeakMap();
    let canvasWheelInputHandler = null;
    let queuedCanvasWheelInput = null;
    let lastNativeWheelAt = 0;
    const CANVAS_WHEEL_EXCLUDED = '.composer,.smart-back,.canvas-new-fab,.image-edit-modal,.image-lightbox,.asset-panel,.smart-log-toggle,.smart-shortcut-toggle,.log-modal,.shortcut-modal,input,textarea,select,[contenteditable="true"]';

    function wheelEventTarget(event){
        if(event?.target instanceof Element) return event.target;
        return event?.target?.parentElement instanceof Element ? event.target.parentElement : null;
    }

    function wheelInputFromEvent(event){
        return {
            clientX:Number.isFinite(event?.clientX) ? event.clientX : 0,
            clientY:Number.isFinite(event?.clientY) ? event.clientY : 0,
            deltaX:Number.isFinite(event?.deltaX) ? event.deltaX : 0,
            deltaY:Number.isFinite(event?.deltaY) ? event.deltaY : 0,
            deltaMode:Number.isFinite(event?.deltaMode) ? event.deltaMode : 0,
            wheelDeltaY:Number.isFinite(event?.wheelDeltaY) ? event.wheelDeltaY : 0,
            wheelDelta:Number.isFinite(event?.wheelDelta) ? event.wheelDelta : 0,
            detail:Number.isFinite(event?.detail) ? event.detail : 0
        };
    }

    function queueCanvasWheelInput(input){
        if(!queuedCanvasWheelInput){
            queuedCanvasWheelInput = {...input};
            return;
        }
        queuedCanvasWheelInput = {
            ...input,
            deltaX:Math.max(-480, Math.min(480, Number(queuedCanvasWheelInput.deltaX || 0) + Number(input.deltaX || 0))),
            deltaY:Math.max(-480, Math.min(480, Number(queuedCanvasWheelInput.deltaY || 0) + Number(input.deltaY || 0)))
        };
    }

    function acceptWheelInput(input){
        if(!input) return false;
        if(typeof canvasWheelInputHandler === 'function'){
            canvasWheelInputHandler(input);
            return true;
        }
        queueCanvasWheelInput(input);
        return true;
    }

    function captureCanvasWheel(event, legacy=false){
        const target = wheelEventTarget(event);
        if(target?.closest?.(CANVAS_WHEEL_EXCLUDED)) return;
        const now = Date.now();
        if(legacy && now - lastNativeWheelAt < 28) return;
        if(!legacy) lastNativeWheelAt = now;
        acceptWheelInput(wheelInputFromEvent(event));
        if(event.cancelable) event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
    }

    const earlyWheelOptions = {passive:false, capture:true};
    window.addEventListener('wheel', event => captureCanvasWheel(event, false), earlyWheelOptions);
    window.addEventListener('mousewheel', event => captureCanvasWheel(event, true), earlyWheelOptions);
    window.addEventListener('DOMMouseScroll', event => captureCanvasWheel(event, true), earlyWheelOptions);
    window.addEventListener('message', event => {
        if(event.origin !== window.location.origin || event.source !== window.parent) return;
        const payload = event.data;
        if(!payload || payload.type !== 'lightbox-canvas-wheel') return;
        acceptWheelInput({
            clientX:Number(payload.clientX) || 0,
            clientY:Number(payload.clientY) || 0,
            deltaX:Number(payload.deltaX) || 0,
            deltaY:Number(payload.deltaY) || 0,
            deltaMode:Number(payload.deltaMode) || 0,
            wheelDeltaY:0,
            wheelDelta:0,
            detail:0
        });
    });

const SVG_NS = 'http://www.w3.org/2000/svg';
const DYNAMIC_LINE_SELECTOR = [
    'path.conn-pending',
    'path.conn-cascade-active',
    'path.port-drag-temp',
    'path.port-link-pending-line',
    'path.selection-multi-port-line'
].join(',');

function isDarkCanvas(){
    return document.documentElement.matches('.theme-dark,.studio-theme-dark');
}

function ensureDynamicLineOverlay(ctx){
    let overlay = ctx.shell?.querySelector(':scope > svg.canvas-dynamic-line-overlay');
    if(overlay) return overlay;
    overlay = document.createElementNS(SVG_NS, 'svg');
    overlay.classList.add('canvas-dynamic-line-overlay');
    overlay.setAttribute('aria-hidden', 'true');
    ctx.shell?.appendChild(overlay);
    return overlay;
}

function worldPathToScreen(pathData, viewport){
    let coordinateIndex = 0;
    const scale = Number(viewport?.scale) || 1;
    const offsetX = Number(viewport?.x) || 0;
    const offsetY = Number(viewport?.y) || 0;
    return String(pathData || '').replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, raw => {
        const value = Number(raw);
        const transformed = coordinateIndex++ % 2 === 0
            ? value * scale + offsetX
            : value * scale + offsetY;
        return Number.isFinite(transformed) ? String(Number(transformed.toFixed(3))) : raw;
    });
}

function syncDynamicLineOverlay(ctx){
    const overlay = ensureDynamicLineOverlay(ctx);
    if(!overlay) return;
    if(!isDarkCanvas()){
        overlay.replaceChildren();
        overlay.classList.remove('visible');
        return;
    }
    const fragment = document.createDocumentFragment();
    ctx.world?.querySelectorAll(DYNAMIC_LINE_SELECTOR).forEach(source => {
        const pathData = source.getAttribute('d');
        if(!pathData || source.closest('.canvas-dynamic-line-overlay')) return;
        const mirror = document.createElementNS(SVG_NS, 'path');
        mirror.classList.add('canvas-dynamic-line', 'smart-guide-line');
        mirror.setAttribute('d', worldPathToScreen(pathData, ctx.viewport));
        mirror.setAttribute('fill', 'none');
        mirror.setAttribute('vector-effect', 'non-scaling-stroke');
        fragment.appendChild(mirror);
    });
    overlay.replaceChildren(fragment);
    overlay.classList.toggle('visible', overlay.childElementCount > 0);
}

function scheduleDynamicLineSync(ctx){
    if(dynamicLineSyncFrame) return;
    dynamicLineSyncFrame = requestAnimationFrame(() => {
        dynamicLineSyncFrame = 0;
        syncDynamicLineOverlay(ctx);
    });
}

function scheduleViewportApply(ctx){
    if(viewportApplyFrame) return;
    viewportApplyFrame = requestAnimationFrame(() => {
        viewportApplyFrame = 0;
        ctx.applyViewport({transformOnly:true});
        // 平移/缩放过程中让选中图片上方的快捷工具栏实时跟随，
        // 不然要等松手后的完整 applyViewport 才会归位
        ctx.positionImageQuickToolbar?.();
        syncDynamicLineOverlay(ctx);
    });
}

function flushViewportApply(ctx){
    if(viewportSettleTimer){
        clearTimeout(viewportSettleTimer);
        viewportSettleTimer = 0;
    }
    if(viewportApplyFrame){
        cancelAnimationFrame(viewportApplyFrame);
        viewportApplyFrame = 0;
    }
    ctx.applyViewport();
    syncDynamicLineOverlay(ctx);
}

function scheduleViewportSettle(ctx){
    clearTimeout(viewportSettleTimer);
    viewportSettleTimer = setTimeout(() => {
        viewportSettleTimer = 0;
        flushViewportApply(ctx);
        ctx.scheduleSave();
    }, 90);
}
function resetEntryBounce(element){
    (entryBounceTimers.get(element) || []).forEach(timer => window.clearTimeout(timer));
    entryBounceTimers.delete(element);
    element?.style?.setProperty('transition', 'none', 'important');
    element?.style?.setProperty('translate', '0 0', 'important');
}
function playEntryBounce(element){
    if(!element) return;
    resetEntryBounce(element);
    void element.offsetWidth;
    element.style.setProperty('transition', 'translate .24s cubic-bezier(.18,.78,.26,1)', 'important');
    element.style.setProperty('translate', '0 -7px', 'important');
    const timers = [
        window.setTimeout(() => element.style.setProperty('translate', '0 2px', 'important'), 260),
        window.setTimeout(() => element.style.setProperty('translate', '0 -2px', 'important'), 470),
        window.setTimeout(() => element.style.setProperty('translate', '0 0', 'important'), 650),
        window.setTimeout(() => {
            element.style.removeProperty('transition');
            element.style.removeProperty('translate');
            entryBounceTimers.delete(element);
        }, 920)
    ];
    entryBounceTimers.set(element, timers);
}

function lockedAspectResize(startW, startH, dx, dy, minW=48, minH=48){
    const width = Math.max(1, Number(startW) || 1);
    const height = Math.max(1, Number(startH) || 1);
    const widthScale = (width + Number(dx || 0)) / width;
    const heightScale = (height + Number(dy || 0)) / height;
    const scaleFromDrag = Math.abs(widthScale - 1) >= Math.abs(heightScale - 1) ? widthScale : heightScale;
    const scale = Math.max(Number(minW || 0) / width, Number(minH || 0) / height, scaleFromDrag);
    return {
        width:Math.max(minW, Math.round(width * scale)),
        height:Math.max(minH, Math.round(height * scale))
    };
}

function isUnifiedPromptResize(node){
    return Boolean(node?.type === 'smart-prompt' && node.llmEnabled && node.llmComposerUnified === true);
}

function applyNodeResizeFromPointer(ctx, state, clientX, clientY){
    const node = ctx.nodes.find(n => n.id === state.id);
    if(!node) return;
    const dx = (clientX - state.startX) / ctx.viewport.scale;
    const dy = (clientY - state.startY) / ctx.viewport.scale;
    const minW = isUnifiedPromptResize(node) ? UNIFIED_PROMPT_MIN_WIDTH : node.type === 'smart-prompt' ? 411 : node.type === 'smart-loop' ? 252 : 48;
    const minH = node.type === 'smart-prompt' ? 269 : node.type === 'smart-loop' ? 132 : 48;
    if(node.type === 'smart-image'){
        const lockedSize = lockedAspectResize(state.startW, state.startH, dx, dy, minW, minH);
        node.w = lockedSize.width;
        node.h = lockedSize.height;
    } else {
        node.w = Math.max(minW, Math.round(state.startW + dx));
        node.h = Math.max(minH, Math.round(state.startH + dy));
    }
    if(node.type === 'smart-prompt'){
        if(isUnifiedPromptResize(node)){
            node.promptMaximized = false;
            node.promptMainHeight = Math.max(ctx.PROMPT_NODE_TEXT_MIN_H, Math.round(state.startPromptMainH + dy));
            node.h = ctx.promptNodeContentHeight(node);
        } else {
            node.promptMaximized = true;
        }
        if(node.llmEnabled && node.llmComposerUnified !== true){
            const extraH = node.h - state.startH;
            const mainDelta = Math.round(extraH * 0.5);
            const instrDelta = extraH - mainDelta;
            node.promptMainHeight = Math.max(ctx.PROMPT_NODE_TEXT_MIN_H, Math.min(ctx.PROMPT_NODE_TEXT_MAX_H, Math.round(state.startPromptMainH + mainDelta)));
            node.llmInstructionHeight = Math.max(ctx.PROMPT_LLM_INSTRUCTION_MIN_H, Math.min(ctx.PROMPT_LLM_INSTRUCTION_MAX_H, Math.round(state.startPromptInstrH + instrDelta)));
            node.h = Math.max(node.h, ctx.promptNodeContentHeight(node));
        }
    }
    node.scale = 1;
    if((node.type === 'smart-image' || !node.type) && (node.images || []).length){
        const previewEl = state.previewElement
            || ctx.world.querySelector(`.image-node[data-id="${CSS.escape(node.id)}"]`);
        if(previewEl){
            state.previewElement = previewEl;
            previewEl.classList.add('node-resize-preview');
            previewEl.style.transformOrigin = '0 0';
            previewEl.style.transform = `scale(${node.w / state.startW}, ${node.h / state.startH})`;
            ctx.scheduleInteractionLayerRefresh?.();
            return;
        }
    }
    ctx.updateNodeElementDuringResize(node, {lightweight:isUnifiedPromptResize(node)});
}

    function engageSmartGroupAtEvent(ctx, event){
        if(event.button !== 0) return false;
        const point = ctx.screenToWorld?.(event);
        if(!point) return false;
        const group = ctx.smartGroupAtWorldPoint?.(point.x, point.y);
        if(!group?.id) return false;
        return ctx.engageSmartGroup?.(group.id, event) !== false;
    }

    function bindCreateMenuActions(ctx){
        const hintBtn = ctx.emptyHintDoubleBtn;
        if(!hintBtn || hintBtn.dataset.boundCreateHint === '1') return;
        hintBtn.dataset.boundCreateHint = '1';
        hintBtn.addEventListener('mouseenter', () => playEntryBounce(hintBtn));
        hintBtn.addEventListener('mouseleave', () => resetEntryBounce(hintBtn));
        hintBtn.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            global.SmartCanvasPortLinkMenu?.openBlankCreateMenu?.(event, {skipBlocked: true});
        });
    }

    function bindCanvas(ctx){
        if(!ctx) return;
        const shell = ctx.shell;
        if(canvasBound && typeof shell?.onmousedown === 'function') return;
        canvasBound = true;
        try {
            if(!ctx.shell || !ctx.world){
                canvasBound = false;
                return;
            }
            bindCreateMenuActions(ctx);

const dynamicLineObserver = new MutationObserver(() => scheduleDynamicLineSync(ctx));
dynamicLineObserver.observe(ctx.world, {
    subtree:true,
    childList:true,
    attributes:true,
    attributeFilter:['d', 'class']
});
scheduleDynamicLineSync(ctx);

ctx.world?.addEventListener('mousedown', e => {
    if(e.button !== 0) return;
    if(e.target.closest('.image-node,.selection-box-capsule,.selection-capsule-bar')) return;
    if(engageSmartGroupAtEvent(ctx, e)){
        e.preventDefault();
        e.stopPropagation();
    }
}, true);
ctx.shell?.addEventListener('mousedown', e => {
    if(!ctx.zoomPreviewState) return;
    if(e.button !== 0) return;
    if(e.target.closest('.composer,.smart-back,.canvas-new-fab,.canvas-empty-hint,.asset-panel,.smart-log-toggle,.smart-shortcut-toggle,.log-modal,.shortcut-modal,.image-edit-modal,.image-lightbox,.image-quick-toolbar,.create-menu,.smart-minimap,.canvas-bottom-chrome')) return;
    e.preventDefault();
    e.stopPropagation();
}, true);
ctx.shell.addEventListener('click', e => {
    if(!ctx.zoomPreviewState) return;
    if(e.button !== 0) return;
    if(e.target.closest('.composer,.smart-back,.canvas-new-fab,.canvas-empty-hint,.asset-panel,.smart-log-toggle,.smart-shortcut-toggle,.log-modal,.shortcut-modal,.image-edit-modal,.image-lightbox,.image-quick-toolbar,.create-menu,.smart-minimap,.canvas-bottom-chrome')) return;
    e.preventDefault();
    e.stopPropagation();
    ctx.exitZoomPreview(ctx.screenToWorld(e));
}, true);
ctx.shell.onmousedown = e => {
    const chromeTarget = e.target.closest('.composer,.smart-back,.canvas-new-fab,.canvas-empty-hint,.asset-panel,.smart-log-toggle,.smart-shortcut-toggle,.log-modal,.shortcut-modal,.image-edit-modal,.image-lightbox,.image-quick-toolbar,.create-menu,.smart-minimap,.canvas-bottom-chrome');
    if(ctx.zoomPreviewState && e.button === 0 && !chromeTarget) return;
    if(chromeTarget) return;
    if(e.button === 1){
        e.preventDefault();
        e.stopPropagation();
        ctx.closeCreateMenu();
        ctx.didPan = false;
        ctx.panState = {button:e.button, startX:e.clientX, startY:e.clientY, ox:ctx.viewport.x, oy:ctx.viewport.y};
        ctx.cancelViewportAnimation();
        ctx.shell.classList.add('panning');
        return;
    }
    if(e.button !== 0 || e.target.closest('.image-node,.selection-box,.selection-box-capsule,.selection-capsule-bar')) return;
    ctx.closeCreateMenu();
    e.preventDefault();
    if(engageSmartGroupAtEvent(ctx, e)) return;
    ctx.didPan = false;
    ctx.selectionState = {startScreen:{x:e.clientX, y:e.clientY}, startWorld:ctx.screenToWorld(e)};
};
ctx.shell.ondblclick = e => {
    if(ctx.didPan || e.target.closest('.image-node,.composer,.smart-back,.canvas-new-fab,.canvas-empty-hint,.smart-log-toggle,.smart-shortcut-toggle,.log-modal,.shortcut-modal,.image-edit-modal,.image-lightbox,.image-quick-toolbar,.port-link-pick-menu')) return;
    if(ctx.imageEditModal?.classList.contains('open')) return;
    e.preventDefault();
    global.SmartCanvasCanvasHint?.revealEmptyChrome?.();
    global.SmartCanvasPortLinkMenu?.openBlankCreateMenu?.(e);
};
ctx.shell.onclick = e => {
    if(global.SmartCanvasPortLinkMenu?.handleShellClick?.(e)) return;
    if(ctx.selectionJustFinished) return;
    if(ctx.didPan || e.target.closest('.image-node,.selection-box,.selection-box-capsule,.selection-capsule-bar,.composer,.smart-back,.canvas-new-fab,.canvas-empty-hint,.smart-log-toggle,.smart-shortcut-toggle,.log-modal,.shortcut-modal,.image-edit-modal,.image-lightbox,.image-quick-toolbar,.create-menu,.port-link-pick-menu')) return;
    if(ctx.imageEditModal?.classList.contains('open')) return;
    ctx.closeCreateMenu();
    ctx.clearSelection();
    // clearSelection closes the composer directly. Only selection chrome needs
    // syncing here; rebuilding every node would delay blank-canvas double-clicks.
    ctx.syncSelectionUi?.();
};
ctx.minimap?.addEventListener('mousedown', e => {
    if(e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    ctx.smartMinimapDrag = true;
    ctx.centerViewportOnWorldPoint(ctx.minimapEventToWorld(e));
});
window.onmousemove = e => {
    ctx.lastMouseWorld = ctx.screenToWorld(e);
    if(ctx.smartMinimapDrag){
        e.preventDefault();
        ctx.centerViewportOnWorldPoint(ctx.minimapEventToWorld(e));
        return;
    }
    if(ctx.portDragState){
        e.preventDefault();
        const p = ctx.screenToWorld(e);
        ctx.portDragState.currentWorld = p;
        ctx.portDragState.moved = true;
        const hitEl = document.elementFromPoint(e.clientX, e.clientY);
        const portEl = hitEl?.closest?.('.node-port');
        const nodeEl = portEl?.closest?.('.image-node') || hitEl?.closest?.('.image-node');
        let targetId = '', targetPort = '';
        if(nodeEl && nodeEl.dataset.id && nodeEl.dataset.id !== ctx.portDragState.fromId){
            targetId = nodeEl.dataset.id;
            if(portEl){
                targetPort = portEl.dataset.port;
            } else {
                const rect = nodeEl.getBoundingClientRect();
                targetPort = (e.clientX - rect.left) < rect.width / 2 ? 'in' : 'out';
            }
            const compatible = (ctx.portDragState.fromPort === 'out' && targetPort === 'in') || (ctx.portDragState.fromPort === 'in' && targetPort === 'out');
            if(!compatible){ targetId = ''; targetPort = ''; }
        }
        ctx.portDragState.hoverTargetId = targetId;
        ctx.portDragState.hoverPort = targetPort;
        ctx.updatePortDragVisual();
        return;
    }
    if(ctx.promptSplitResizeState){
        e.preventDefault();
        const node = ctx.nodes.find(n => n.id === ctx.promptSplitResizeState.nodeId);
        if(!node) return;
        const dy = (e.clientY - ctx.promptSplitResizeState.startY) / ctx.viewport.scale;
        ctx.updatePromptSplitDuringResize(node, dy);
        return;
    }
    if(ctx.promptResizeState){
        e.preventDefault();
        const dy = e.clientY - ctx.promptResizeState.startY;
        ctx.settings.promptH = Math.max(60, Math.min(380, ctx.promptResizeState.startH + dy));
        ctx.promptInput.style.setProperty('--prompt-h', `${ctx.settings.promptH}px`);
        ctx.persistActiveSmartSettings();
        return;
    }
    if(ctx.selectionState){
        e.preventDefault();
        ctx.updateSelectionBox(e);
        return;
    }
    if(ctx.previewCompareDrag){
        e.preventDefault();
        ctx.setPreviewComparePos(e.clientX);
        return;
    }
    if(ctx.panoramaState.drag){
        e.preventDefault();
        const dx = e.clientX - ctx.panoramaState.drag.clientX;
        const dy = e.clientY - ctx.panoramaState.drag.clientY;
        ctx.panoramaState.yaw = ctx.panoramaState.drag.yaw - dx * 0.18;
        ctx.panoramaState.pitch = Math.max(-85, Math.min(85, ctx.panoramaState.drag.pitch + dy * 0.18));
        document.getElementById('previewStage')?.classList.add('panning');
        return;
    }
    if(ctx.previewPanDrag){
        const stage = document.getElementById('previewStage');
        ctx.previewPan = {
            x:ctx.previewPanDrag.startX + (e.clientX - ctx.previewPanDrag.clientX),
            y:ctx.previewPanDrag.startY + (e.clientY - ctx.previewPanDrag.clientY)
        };
        stage?.classList.add('panning');
        ctx.applyPreviewTransform();
        return;
    }
    if(ctx.imageEditPanDrag){
        const stage = document.getElementById('imageEditStage');
        if(stage){
            stage.scrollLeft = ctx.imageEditPanDrag.scrollLeft - (e.clientX - ctx.imageEditPanDrag.clientX);
            stage.scrollTop = ctx.imageEditPanDrag.scrollTop - (e.clientY - ctx.imageEditPanDrag.clientY);
        }
        return;
    }
    if(ctx.applyCropDragMove?.(e)) return;
    if(ctx.resizeState){
        const state = ctx.resizeState;
        const node = ctx.nodes.find(n => n.id === state.id);
        if(!node) return;
        state.pendingClientX = e.clientX;
        state.pendingClientY = e.clientY;
        if(!state.frameRequest) state.frameRequest = requestAnimationFrame(() => {
            if(ctx.resizeState !== state) return;
            state.frameRequest = 0;
            applyNodeResizeFromPointer(ctx, state, state.pendingClientX, state.pendingClientY);
        });
        return;
    }
    if(ctx.thumbDragState){
        const dx = e.clientX - ctx.thumbDragState.startX;
        const dy = e.clientY - ctx.thumbDragState.startY;
        const source = ctx.nodes.find(n => n.id === ctx.thumbDragState.nodeId);
        if(!ctx.thumbDragState.detached && Math.abs(dx) + Math.abs(dy) > 6){
            if(source && ((source.images || []).length > 1 || global.SmartCanvasCoCreate?.hasGroupedOutput?.(source))){
                const img = source.images[ctx.thumbDragState.imgIndex];
                if(img){
                    ctx.commitPendingUndo();
                    ctx.undoSuppressed = true;
                    ctx.applyNodeMetaToImage(img, source);
                    const coCreate = global.SmartCanvasCoCreate;
                    const isCoCreate = coCreate?.hasGroupedOutput?.(source);
                    const cleanImg = isCoCreate ? (coCreate.stripDetachImage?.(img) || img) : img;
                    source.images.splice(ctx.thumbDragState.imgIndex, 1);
                    if(isCoCreate){
                        const detachResult = coCreate.afterImageDetached?.(source) || {empty: false};
                        if(detachResult.empty){
                            ctx.nodes = ctx.nodes.filter(n => n.id !== source.id);
                            if(ctx.canvas?.connections){
                                ctx.canvas.connections = ctx.canvas.connections.filter(c => c.from !== source.id && c.to !== source.id);
                            }
                        }
                    } else if(source.images.length <= 1){
                        source.title = 'Image';
                        delete source.w; delete source.h;
                        ctx.inheritNodeMetaFromImage(source);
                    }
                    const point = ctx.screenToWorld(e);
                    ctx.selectedId = '';
                    ctx.selectedImage = {nodeId:'', index:-1};
                    const newNode = ctx.createImageNodeAt(point, [cleanImg], {select:false, skipUndo:true});
                    ctx.undoSuppressed = false;
                    ctx.dragState = {id:newNode.id, startX:e.clientX, startY:e.clientY, ox:newNode.x, oy:newNode.y, thumbDetached:true};
                    ctx.thumbDragState.detached = true;
                    ctx.render();
                }
            }
        }
        if(ctx.thumbDragState.detached) ctx.thumbDragState = null;
        else return;
    }
    if(ctx.panState){
        const dx = e.clientX - ctx.panState.startX;
        const dy = e.clientY - ctx.panState.startY;
        if(Math.abs(dx) + Math.abs(dy) > 3) ctx.didPan = true;
        ctx.viewport.x = ctx.panState.ox + dx;
        ctx.viewport.y = ctx.panState.oy + dy;
        scheduleViewportApply(ctx);
        return;
    }
    if(ctx.dragPending && !ctx.dragState){
        const dx = e.clientX - ctx.dragPending.startX;
        const dy = e.clientY - ctx.dragPending.startY;
        if(Math.abs(dx) + Math.abs(dy) > 5){
            ctx.dragState = ctx.dragPending;
            ctx.dragPending = null;
            if(ctx.dragState?.preserveClick) window.SmartCanvasEmptyNodeChrome?.markDragGesture?.();
            document.body.classList.add('smart-node-drag');
        } else {
            return;
        }
    }
    if(!ctx.dragState) return;
    const node = ctx.nodes.find(n => n.id === ctx.dragState.id);
    if(!node) return;
    const moveDx = (e.clientX - ctx.dragState.startX) / ctx.viewport.scale;
    const moveDy = (e.clientY - ctx.dragState.startY) / ctx.viewport.scale;
    (ctx.dragState.group || [{id:ctx.dragState.id, ox:ctx.dragState.ox, oy:ctx.dragState.oy}]).forEach(item => {
        const n = ctx.nodes.find(x => x.id === item.id);
        if(!n) return;
        n.x = item.ox + moveDx;
        n.y = item.oy + moveDy;
    });
    global.SmartCanvasSmartGuides?.applyDrag?.(ctx, ctx.dragState);
    if(ctx.assetLibraryOpen){
        const hit = document.elementFromPoint(e.clientX, e.clientY);
        if(hit && ctx.assetPanel?.contains(hit)){
            ctx.setAssetDragOver(true);
            ctx.clearDropHighlight();
            ctx.setAssetDragOver(true);
            global.SmartCanvasSmartGuides?.clear?.();
            return;
        }
        ctx.setAssetDragOver(false);
    }
    let target = null;
    if(ctx.dragState.ctrlGroup){
        const draggedRect = ctx.nodeRect(node);
        target = ctx.rectOverlapNode(node.id, draggedRect.x, draggedRect.y, draggedRect.width, draggedRect.height, ctx.dragState.groupIds);
    }
    ctx.setDropHighlight(target?.id || '');
    ctx.moveNodeElementsDuringDrag();
    ctx.updateLoopInsertPreview();
    if(target) ctx.setDropHighlight(target.id);
};
window.onmouseup = e => {
    document.body.classList.remove('smart-node-drag');
    document.body.classList.remove('smart-node-resize');
    global.SmartCanvasSmartGuides?.clear?.();
    if(ctx.portDragState){
        const drag = ctx.portDragState;
        ctx.portDragState = null;
        ctx.shell.classList.remove('port-dragging');
        ctx.clearPortDragVisual();
        ctx.handlePortDrop(drag, e);
        return;
    }
    if(ctx.promptResizeState){ ctx.promptResizeState = null; ctx.scheduleSave(); }
    if(ctx.selectionState) ctx.finishSelection(e);
    if(ctx.previewCompareDrag) ctx.previewCompareDrag = false;
    if(ctx.panoramaState.drag){
        ctx.panoramaState.drag = null;
        document.getElementById('previewStage')?.classList.remove('panning');
    }
    if(ctx.previewPanDrag){
        ctx.previewPanDrag = null;
        document.getElementById('previewStage')?.classList.remove('panning');
    }
    if(ctx.imageEditPanDrag) ctx.imageEditPanDrag = null;
    if(ctx.endCropDrag?.()) return;
    if(ctx.promptSplitResizeState){
        document.body.classList.remove('prompt-split-resize');
        document.body.classList.remove('smart-node-resize');
        ctx.commitPendingUndo();
        ctx.promptSplitResizeState = null;
        ctx.scheduleSave();
    }
    if(ctx.resizeState){
        const state = ctx.resizeState;
        if(state.frameRequest){
            cancelAnimationFrame(state.frameRequest);
            state.frameRequest = 0;
            applyNodeResizeFromPointer(ctx, state, state.pendingClientX ?? e.clientX, state.pendingClientY ?? e.clientY);
        }
        const node = ctx.nodes.find(n => n.id === state.id);
        const rect = node ? ctx.nodeRect(node) : null;
        const changed = rect && (Math.abs(rect.width - state.startW) > 1 || Math.abs(rect.height - state.startH) > 1);
        if(changed){
            ctx.commitPendingUndo();
        } else { ctx.discardPendingUndo(); }
        const nodeEl = node ? ctx.world.querySelector(`.image-node[data-id="${CSS.escape(node.id)}"]`) : null;
        state.previewElement?.classList.remove('node-resize-preview');
        state.previewElement?.style.removeProperty('transform-origin');
        state.previewElement?.style.removeProperty('transform');
        nodeEl?.classList.remove('prompt-unified-resizing');
        nodeEl?.querySelector('.prompt-node-resize-preview')?.remove();
        ctx.resizeState = null;
        if(changed){
            ctx.updateNodeElementDuringResize(node);
        }
        ctx.scheduleSave();
    }
    if(ctx.thumbDragState){
        if(!ctx.thumbDragState.detached) ctx.discardPendingUndo();
        ctx.thumbDragState = null;
    }
    if(ctx.panState) {
        ctx.panState = null;
        ctx.shell.classList.remove('panning');
        flushViewportApply(ctx);
        ctx.scheduleSave();
        setTimeout(() => { ctx.didPan = false; }, 0);
    }
    if(ctx.smartMinimapDrag){
        ctx.smartMinimapDrag = false;
    }
    if(ctx.dragPending){
        ctx.dragPending = null;
        ctx.discardPendingUndo();
    }
    if(ctx.dragState){
        const draggedNode = ctx.nodes.find(n => n.id === ctx.dragState.id);
        let stateChanged = false;
        const hit = document.elementFromPoint(e.clientX, e.clientY);
        const droppedOnAssetPanel = ctx.assetLibraryOpen && hit && ctx.assetPanel?.contains(hit);
        if(droppedOnAssetPanel && draggedNode){
            const imagesToSave = [];
            const seen = new Set();
            const pushImage = (img, nameHint) => {
                const url = img?.url;
                if(!url || seen.has(url)) return;
                seen.add(url);
                imagesToSave.push({url, name: img.name || nameHint || 'image'});
            };
            (ctx.dragState.group || [{id: ctx.dragState.id}]).forEach(item => {
                const node = ctx.nodes.find(n => n.id === item.id);
                if(!node) return;
                if(ctx.isSmartGroupNode?.(node)){
                    const refs = ctx.smartGroupImageRefs?.(node) || [];
                    if(refs.length){
                        refs.forEach(ref => pushImage(ref.item || ref.source, node.title));
                        return;
                    }
                }
                (node.images || []).forEach(img => pushImage(img, node.title));
            });
            if(imagesToSave.length){
                const categoryId = ctx.activeAssetCategoryId || global.SmartCanvasAssetLibraryUi?.getOpenGalleryCategoryId?.() || '';
                (async () => {
                    for(let i = 0; i < imagesToSave.length; i++){
                        const img = imagesToSave[i];
                        await ctx.addUrlToAssetLibrary(img.url, img.name, categoryId, {
                            skipUiRefresh: i < imagesToSave.length - 1,
                            skipToast: i < imagesToSave.length - 1
                        });
                    }
                })();
                (ctx.dragState.group || [{id: ctx.dragState.id, ox: ctx.dragState.ox, oy: ctx.dragState.oy}]).forEach(item => {
                    const n = ctx.nodes.find(x => x.id === item.id);
                    if(n){ n.x = item.ox; n.y = item.oy; }
                });
                ctx.setAssetDragOver(false);
                ctx.discardPendingUndo();
                ctx.clearDropHighlight();
                ctx.dragState = null;
                document.body.classList.remove('smart-node-drag');
                ctx.render();
                ctx.scheduleSave();
                return;
            }
        }
        const insertHit = draggedNode?.type === 'smart-loop' && ctx.dragState.ctrlGroup && (ctx.dragState.group || []).length <= 1
            ? ctx.insertionConnectionForNode(draggedNode)
            : null;
        const draggedNodes = (ctx.dragState.group || []).map(item => ctx.nodes.find(n => n.id === item.id)).filter(Boolean);
        const smartGroupTarget = draggedNode ? ctx.smartGroupTargetForDraggedNode?.(draggedNode) : null;
        const dragMoved = (ctx.dragState.group || []).some(item => {
            const n = ctx.nodes.find(x => x.id === item.id);
            return n && (Math.abs((Number(n.x) || 0) - item.ox) > 1 || Math.abs((Number(n.y) || 0) - item.oy) > 1);
        });
        if(
            insertHit &&
            ctx.insertLoopNodeIntoConnection(draggedNode, insertHit)
        ){
            stateChanged = true;
            ctx.render();
        } else if(
            smartGroupTarget &&
            global.SmartCanvasIsolatedFeatures?.tryDragIntoGroup?.(
                draggedNodes.length ? draggedNodes : [draggedNode],
                smartGroupTarget
            )
        ){
            stateChanged = true;
            ctx.render();
        } else if(draggedNode && (draggedNode.images || []).length && (ctx.dragState.ctrlGroup || (ctx.dragState.group || []).length <= 1)){
            const r = ctx.nodeRect(draggedNode);
            const target = ctx.rectOverlapNode(draggedNode.id, r.x, r.y, r.width, r.height, ctx.dragState.groupIds);
            if(target && (target.images || []).length && (ctx.dragState.ctrlGroup || (target.images || []).length > 1)){
                stateChanged = true;
                ctx.mergeImageNodesIntoGroup(draggedNode.id, target.id);
                ctx.render();
            } else if(target && ctx.isSmartGroupNode?.(target)){
                if(dragMoved) stateChanged = true;
            } else if(dragMoved){
                stateChanged = true;
            }
        } else if(dragMoved || (draggedNode && (Math.abs((draggedNode.x || 0) - ctx.dragState.ox) > 1 || Math.abs((draggedNode.y || 0) - ctx.dragState.oy) > 1))){
            stateChanged = true;
        }
        if(!smartGroupTarget && global.SmartCanvasIsolatedFeatures?.pruneDraggedMembersOut?.(ctx.dragState)){
            stateChanged = true;
        }
        if(ctx.dragState.thumbDetached) stateChanged = true;
        if(stateChanged) ctx.commitPendingUndo();
        else ctx.discardPendingUndo();
        if(stateChanged || ctx.dragState.thumbDetached) ctx.suppressNodeClickUntil = Date.now() + 180;
        ctx.clearDropHighlight();
        ctx.loopInsertPreview = null;
        ctx.dragState = null;
        if(stateChanged) ctx.render();
        ctx.scheduleSave();
        ctx.refreshConnectionLayer();
    }
};
const applyCanvasWheelInput = input => {
    ctx.cancelViewportAnimation();
    const rect = ctx.shell.getBoundingClientRect();
    const sx = (Number.isFinite(input.clientX) ? input.clientX : rect.width / 2) - rect.left;
    const sy = (Number.isFinite(input.clientY) ? input.clientY : rect.height / 2) - rect.top;
    const before = {x:(sx - ctx.viewport.x) / ctx.viewport.scale, y:(sy - ctx.viewport.y) / ctx.viewport.scale};
    const deltaY = Number.isFinite(input.deltaY) && input.deltaY !== 0
        ? input.deltaY
        : (Number.isFinite(input.wheelDeltaY) && input.wheelDeltaY !== 0
            ? -input.wheelDeltaY
            : (Number.isFinite(input.wheelDelta) && input.wheelDelta !== 0
                ? -input.wheelDelta
                : (Number.isFinite(input.detail) ? input.detail : 0)));
    const deltaX = Number.isFinite(input.deltaX) ? input.deltaX : 0;
    const deltaUnit = input.deltaMode === 1 ? 16 : (input.deltaMode === 2 ? rect.height : 1);
    const wheelDelta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
    let normalizedDelta = Math.max(-120, Math.min(120, wheelDelta * deltaUnit));
    if(!normalizedDelta) return;
    if(Math.abs(normalizedDelta) < 12) normalizedDelta = Math.sign(normalizedDelta) * 12;
    const factor = Math.exp(-normalizedDelta * 0.0025);
    ctx.viewport.scale = ctx.safeScale(ctx.viewport.scale * factor);
    ctx.viewport.x = sx - before.x * ctx.viewport.scale;
    ctx.viewport.y = sy - before.y * ctx.viewport.scale;
    scheduleViewportApply(ctx);
    scheduleViewportSettle(ctx);
};
canvasWheelInputHandler = applyCanvasWheelInput;
if(queuedCanvasWheelInput){
    const pendingWheelInput = queuedCanvasWheelInput;
    queuedCanvasWheelInput = null;
    requestAnimationFrame(() => applyCanvasWheelInput(pendingWheelInput));
}

const canvasWheelOptions = {passive:false, capture:true};

let safariGestureState = null;
const handleSafariGestureStart = e => {
    const target = e.target instanceof Element ? e.target : null;
    if(target?.closest('.composer,.smart-back,.canvas-new-fab,.image-edit-modal,.image-lightbox,.asset-panel,.smart-log-toggle,.smart-shortcut-toggle,.log-modal,.shortcut-modal')) return;
    if(e.cancelable) e.preventDefault();
    e.stopPropagation();
    const rect = ctx.shell.getBoundingClientRect();
    const sx = Number.isFinite(e.clientX) ? e.clientX - rect.left : rect.width / 2;
    const sy = Number.isFinite(e.clientY) ? e.clientY - rect.top : rect.height / 2;
    safariGestureState = {
        startScale:ctx.viewport.scale,
        sx,
        sy,
        worldX:(sx - ctx.viewport.x) / ctx.viewport.scale,
        worldY:(sy - ctx.viewport.y) / ctx.viewport.scale
    };
    ctx.cancelViewportAnimation();
};
const handleSafariGestureChange = e => {
    if(!safariGestureState) return;
    if(e.cancelable) e.preventDefault();
    e.stopPropagation();
    const gestureScale = Number.isFinite(e.scale) && e.scale > 0 ? e.scale : 1;
    ctx.viewport.scale = ctx.safeScale(safariGestureState.startScale * gestureScale);
    ctx.viewport.x = safariGestureState.sx - safariGestureState.worldX * ctx.viewport.scale;
    ctx.viewport.y = safariGestureState.sy - safariGestureState.worldY * ctx.viewport.scale;
    scheduleViewportApply(ctx);
};
const handleSafariGestureEnd = e => {
    if(!safariGestureState) return;
    if(e.cancelable) e.preventDefault();
    e.stopPropagation();
    safariGestureState = null;
    flushViewportApply(ctx);
    ctx.scheduleSave();
};
[ctx.shell, window].forEach(surface => {
    surface.addEventListener('gesturestart', handleSafariGestureStart, canvasWheelOptions);
    surface.addEventListener('gesturechange', handleSafariGestureChange, canvasWheelOptions);
    surface.addEventListener('gestureend', handleSafariGestureEnd, canvasWheelOptions);
});

const middlePanStart = e => {
    if(e.button !== 1 || e.target?.closest?.('.composer,.image-edit-modal,.image-lightbox,.asset-panel,.log-modal,.shortcut-modal')) return;
    e.preventDefault();
    e.stopPropagation();
    ctx.closeCreateMenu();
    ctx.didPan = false;
    ctx.panState = {button:1, startX:e.clientX, startY:e.clientY, ox:ctx.viewport.x, oy:ctx.viewport.y};
    ctx.cancelViewportAnimation();
    ctx.shell.classList.add('panning');
};
ctx.shell.addEventListener('mousedown', middlePanStart, true);
window.addEventListener('auxclick', e => {
    if(e.button === 1 && ctx.shell.contains(e.target)) e.preventDefault();
}, true);
ctx.shell.ondragover = e => ctx.setSmartDropCopyEffect(e, true);
ctx.shell.ondrop = async e => {
    e.preventDefault();
    if(e.target.closest('.image-node')) return;
    const p = ctx.screenToWorld(e);
    const assetRaw = e.dataTransfer.getData('application/x-smart-asset');
    if(assetRaw){
        try {
            const asset = JSON.parse(assetRaw);
            if(asset?.url) {
                ctx.pushUndo();
                ctx.createImageNodeAt(p, [{url:asset.url, name:asset.name || 'asset', kind:asset.kind || ctx.assetMediaKind(asset)}], {skipUndo:true});
                await ctx.saveCanvas();
            }
            return;
        } catch {}
    }
    const payload = await ctx.resolveSmartImageDropPayload(e.dataTransfer);
    if(payload.type === 'none') return;
    await ctx.handleSmartImageDropPayload(payload, '', {point:p, forceNew:true});
    await ctx.saveCanvas();
};
ctx.canvasEmptyHint?.addEventListener('dblclick', event => {
    event.preventDefault();
    event.stopPropagation();
    global.SmartCanvasCanvasHint?.revealEmptyChrome?.();
    global.SmartCanvasPortLinkMenu?.openBlankCreateMenu?.(event, {skipBlocked: true});
});
        } catch(err) {
            console.error('[SmartCanvasUiCanvas]', err);
            canvasBound = false;
        }
    }

    const api = Object.freeze({ bindCanvas, lockedAspectResize, acceptWheelInput });
    global.SmartCanvasCore.register('uiCanvas', api);
    global.SmartCanvasUiCanvas = api;
})(window);
