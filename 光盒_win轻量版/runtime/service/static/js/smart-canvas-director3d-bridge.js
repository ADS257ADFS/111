(function(global){
    'use strict';

    const MESSAGE_PREFIX = 'director3d:';
    const DIRECTOR_URL = '/static/director3d/index.html?v=2026.07.11.10';
    let overlay = null;
    let iframe = null;
    let activeNodeId = '';
    let observer = null;
    let bootTimer = 0;

    function sameOrigin(){
        return global.location?.origin || '';
    }

    function deps(){
        return global.SmartCanvasCore?.tryDeps?.() ?? null;
    }

    function uid(prefix){
        return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    }

    function createDefaultState(){
        return {
            // The iframe schema owns all director defaults. The outer canvas only
            // creates this envelope so it never needs to mirror director fields.
            schemaVersion: 4,
            metadata: {
                createdAt: Date.now(),
                updatedAt: Date.now(),
                source: 'smart-canvas-director-node'
            }
        };
    }

    function isDirectorNode(node){
        return Boolean(node && (node.portLinkKind === 'director' || node.type === 'director3d'));
    }

    function isDirector3DMessage(message){
        return Boolean(message && typeof message.type === 'string' && message.type.startsWith(MESSAGE_PREFIX));
    }

    function directorNodeTitle(node){
        return String(node?.title || '').trim() || '导演台';
    }

    function ensureDirectorState(node){
        if(!node) return createDefaultState();
        if(!node.director3dState || typeof node.director3dState !== 'object'){
            node.director3dState = createDefaultState();
            node.director3dState.metadata.nodeId = node.id || '';
            node.director3dState.metadata.title = directorNodeTitle(node);
        }
        if(!node.director3dState.metadata) node.director3dState.metadata = {};
        node.director3dState.metadata.updatedAt = Number(node.director3dState.metadata.updatedAt || Date.now());
        return node.director3dState;
    }

    function escapeHtml(value){
        return String(value ?? '').replace(/[&<>"']/g, ch => ({
            '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
        }[ch]));
    }

    function injectStyles(){
        if(!global.document?.head || document.getElementById('director3dBridgeStyles')) return;
        const style = document.createElement('style');
        style.id = 'director3dBridgeStyles';
        style.textContent = `
            .director3d-node-card {
                width: 100%;
                height: 100%;
                display: grid;
                align-content: center;
                gap: 10px;
                padding: 18px;
                border: 1px solid rgba(143, 184, 255, .35);
                border-radius: 12px;
                background: linear-gradient(180deg, rgba(32,38,49,.96), rgba(24,29,38,.96));
                color: var(--text, #eef2f8);
            }
            .director3d-node-card strong { font-size: 16px; line-height: 1.25; letter-spacing: 0; }
            .director3d-node-card span { color: var(--muted, #8f9bad); font-size: 11px; line-height: 1.45; }
            .director3d-open-btn {
                width: max-content;
                min-width: 112px;
                height: 34px;
                padding: 0 13px;
                border: 1px solid rgba(143, 184, 255, .55);
                border-radius: 8px;
                background: #293449;
                color: #eef2f8;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
            }
            .director3d-open-btn:hover { border-color: var(--ui-accent); background: #34415a; }
            .director3d-modal {
                position: fixed;
                inset: 0;
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: clamp(18px, 4vw, 38px);
                background: rgba(248,250,252,.42);
                backdrop-filter: blur(18px);
                -webkit-backdrop-filter: blur(18px);
            }
            .theme-dark .director3d-modal {
                background: rgba(2,6,23,.64);
            }
            .director3d-modal-window {
                position: relative;
                width: min(1380px, calc(100vw - 56px));
                height: min(860px, calc(100vh - 56px));
                min-width: 720px;
                min-height: 520px;
                display: grid;
                grid-template-rows: 46px 1fr;
                overflow: hidden;
                border-radius: 18px;
                background: var(--panel, #fff);
                border: 1px solid var(--line, #e8edf3);
                box-shadow: var(--ui-shadow-dialog, 0 24px 70px rgba(15,23,42,.16));
                backdrop-filter: none;
                -webkit-backdrop-filter: none;
            }
            .director3d-modal-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 0 8px 0 14px;
                border-bottom: 1px solid var(--line, #e8edf3);
                background: var(--panel, rgba(255,255,255,.9));
                color: var(--ui-text, var(--text, #111827));
                font-size: 13px;
                font-weight: 600;
                cursor: move;
                user-select: none;
            }
            .director3d-modal-close {
                width: 34px;
                height: 34px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: 1px solid var(--line, #e8edf3);
                border-radius: 12px;
                background: var(--card, #fff);
                color: var(--ui-text-secondary, var(--muted, #64748b));
                cursor: pointer;
            }
            .director3d-modal-close:hover { background: var(--strong, #111827); color: var(--ui-text-on-accent, var(--strong-text, #fff)); }
            .director3d-modal-close i,
            .director3d-modal-close svg { width: 16px; height: 16px; }
            .director3d-modal-frame {
                width: 100%;
                height: 100%;
                border: 0;
                background: var(--page, #f8fafc);
            }
            @media (max-width: 820px) {
                .director3d-modal { padding: 10px; }
                .director3d-modal-window {
                    width: calc(100vw - 20px);
                    height: calc(100vh - 20px);
                    min-width: 0;
                    min-height: 0;
                    border-radius: 14px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function directorCardHtml(node){
        const state = ensureDirectorState(node);
        const updatedAt = Number(state?.metadata?.updatedAt || 0);
        const detail = updatedAt ? `上次保存 ${new Date(updatedAt).toLocaleString()}` : '双击或点击进入继续编辑';
        return `
            <div class="director3d-node-card">
                <strong>${escapeHtml(directorNodeTitle(node))}</strong>
                <span>${escapeHtml(detail)}</span>
                <button class="director3d-open-btn" type="button" data-director3d-open="${escapeHtml(node.id)}">进入导演台</button>
            </div>
        `;
    }

    function enhanceDirectorNodeElement(el){
        const d = deps();
        const node = d?.nodes?.find(n => n.id === el?.dataset?.id);
        if(!isDirectorNode(node)) return false;
        const wasMissingState = !node.director3dState;
        ensureDirectorState(node);
        el.classList.add('director3d-canvas-node');
        const body = el.querySelector('.node-body');
        if(body && body.dataset.director3dEnhanced !== '1'){
            body.dataset.director3dEnhanced = '1';
            body.innerHTML = directorCardHtml(node);
        }
        const button = el.querySelector('[data-director3d-open]');
        if(button && button.dataset.director3dBound !== '1'){
            button.dataset.director3dBound = '1';
            button.addEventListener('mousedown', event => {
                event.preventDefault();
                event.stopPropagation();
            }, true);
            button.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                openDirectorNode(button.dataset.director3dOpen);
            }, true);
        }
        if(wasMissingState) d?.scheduleSave?.();
        return true;
    }

    function enhanceDirectorNodes(){
        const d = deps();
        if(!d?.world) return;
        d.world.querySelectorAll?.('.image-node[data-id]')?.forEach(enhanceDirectorNodeElement);
    }

    function observeCanvas(){
        const d = deps();
        const world = d?.world;
        if(!world || world.nodeType !== 1 || typeof global.Node !== 'function' || !(world instanceof global.Node) || observer) return;
        const nextObserver = new MutationObserver(() => enhanceDirectorNodes());
        nextObserver.observe(world, {childList: true, subtree: true});
        observer = nextObserver;
        enhanceDirectorNodes();
    }

    function persistDirectorStateFromIframe(){
        const d = deps();
        if(!activeNodeId || !iframe?.contentWindow) return false;
        const node = d?.nodes?.find(n => n.id === activeNodeId);
        if(!isDirectorNode(node)) return false;
        let state = null;
        try {
            state = iframe.contentWindow.Director3DApp?.store?.getState?.() || null;
        } catch(error) {
            state = null;
        }
        if(!state || typeof state !== 'object') return false;
        node.director3dState = state;
        if(!node.director3dState.metadata) node.director3dState.metadata = {};
        node.director3dState.metadata.updatedAt = Date.now();
        node.director3dState.metadata.nodeId = node.id || '';
        node.director3dState.metadata.title = directorNodeTitle(node);
        d?.scheduleSave?.();
        d?.render?.();
        return true;
    }

    function closeDirector(){
        persistDirectorStateFromIframe();
        overlay?.remove?.();
        overlay = null;
        iframe = null;
        activeNodeId = '';
    }

    function bindModalDrag(modalWindow, modalHead){
        if(!modalWindow || !modalHead) return;
        let dragging = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

        function clamp(value, min, max){
            return Math.max(min, Math.min(max, value));
        }

        function moveTo(left, top){
            const rect = modalWindow.getBoundingClientRect();
            const maxLeft = Math.max(0, window.innerWidth - rect.width);
            const maxTop = Math.max(0, window.innerHeight - rect.height);
            modalWindow.style.left = `${clamp(left, 0, maxLeft)}px`;
            modalWindow.style.top = `${clamp(top, 0, maxTop)}px`;
            modalWindow.style.right = 'auto';
            modalWindow.style.bottom = 'auto';
            modalWindow.style.margin = '0';
        }

        modalHead.addEventListener('pointerdown', event => {
            if(event.button !== 0 || event.target.closest?.('.director3d-modal-close')) return;
            event.preventDefault();
            const rect = modalWindow.getBoundingClientRect();
            dragging = true;
            startX = event.clientX;
            startY = event.clientY;
            startLeft = rect.left;
            startTop = rect.top;
            modalWindow.style.position = 'fixed';
            modalHead.setPointerCapture?.(event.pointerId);
            moveTo(startLeft, startTop);
        });
        modalHead.addEventListener('pointermove', event => {
            if(!dragging) return;
            event.preventDefault();
            moveTo(startLeft + event.clientX - startX, startTop + event.clientY - startY);
        });
        modalHead.addEventListener('pointerup', event => {
            if(!dragging) return;
            dragging = false;
            modalHead.releasePointerCapture?.(event.pointerId);
        });
        modalHead.addEventListener('pointercancel', () => {
            dragging = false;
        });
    }

    function openDirectorNode(nodeId){
        const d = deps();
        const node = d?.nodes?.find(n => n.id === nodeId);
        if(!isDirectorNode(node)) return false;
        injectStyles();
        closeDirector();
        activeNodeId = node.id;
        overlay = document.createElement('div');
        overlay.className = 'director3d-modal';
        overlay.innerHTML = `
            <div class="director3d-modal-window" role="dialog" aria-modal="true" aria-label="3D导演台">
                <div class="director3d-modal-head">
                    <span>${escapeHtml(directorNodeTitle(node))}</span>
                    <button class="director3d-modal-close" type="button" title="关闭" aria-label="关闭导演台"><i data-lucide="x"></i></button>
                </div>
                <iframe class="director3d-modal-frame" src="${DIRECTOR_URL}" title="3D导演台"></iframe>
            </div>
        `;
        overlay.querySelector('.director3d-modal-close')?.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            closeDirector();
        });
        bindModalDrag(overlay.querySelector('.director3d-modal-window'), overlay.querySelector('.director3d-modal-head'));
        iframe = overlay.querySelector('iframe');
        iframe.addEventListener('load', () => {
            iframe.contentWindow?.postMessage?.({
                type: 'director3d:init',
                nodeId: node.id,
                payload: {
                    nodeId: node.id,
                    state: ensureDirectorState(node),
                    assets: []
                }
            }, sameOrigin() || '*');
        });
        document.body.appendChild(overlay);
        d?.refreshIcons?.();
        return true;
    }

    function nodeOutputPoint(sourceNode){
        const d = deps();
        const rect = d?.nodeRect?.(sourceNode);
        if(rect) return {x: rect.x + rect.width + 220, y: rect.y + Math.max(90, rect.height / 2)};
        return {x: Number(sourceNode?.x || 0) + 420, y: Number(sourceNode?.y || 0) + 80};
    }

    function exportImageToCanvas(d, sourceNode, payload){
        if(!d || !sourceNode || !payload?.imageData) return null;
        const name = String(payload.name || 'director-shot.png').slice(0, 120);
        const output = d.createImageNodeAt?.(nodeOutputPoint(sourceNode), [{
            url: payload.imageData,
            name,
            kind: 'image',
            source: 'director3d',
            cameraState: payload.cameraState || null,
            sceneVersion: payload.sceneVersion || 0
        }], {select:true, skipUndo:true});
        if(output?.id){
            d.connectInputNode?.(sourceNode.id, output.id);
            d.render?.();
            d.scheduleSave?.();
        }
        return output || null;
    }

    function handleDirectorMessage(event){
        const origin = sameOrigin();
        if(origin && event.origin !== origin) return;
        const message = event.data;
        if(!isDirector3DMessage(message)) return;
        if(iframe?.contentWindow && event.source && event.source !== iframe.contentWindow) return;
        const d = deps();
        const nodeId = String(message.nodeId || activeNodeId || '');
        const node = d?.nodes?.find(n => n.id === nodeId);
        if(!isDirectorNode(node)) return;
        const payload = message.payload || {};
        if(message.type === 'director3d:save-state'){
            node.director3dState = payload.state || message.state || node.director3dState || createDefaultState();
            if(!node.director3dState.metadata) node.director3dState.metadata = {};
            node.director3dState.metadata.updatedAt = Date.now();
            d?.scheduleSave?.();
            d?.render?.();
        } else if(message.type === 'director3d:export-image'){
            exportImageToCanvas(d, node, payload);
        } else if(message.type === 'director3d:close'){
            closeDirector();
        }
    }

    function boot(){
        const d = deps();
        if(!d?.world){
            clearTimeout(bootTimer);
            bootTimer = setTimeout(boot, 120);
            return;
        }
        injectStyles();
        observeCanvas();
        global.addEventListener?.('message', handleDirectorMessage);
    }

    const api = Object.freeze({
        createDefaultState,
        isDirectorNode,
        isDirector3DMessage,
        enhanceDirectorNodes,
        openDirectorNode,
        closeDirector,
        persistDirectorStateFromIframe,
        exportImageToCanvas
    });

    global.SmartCanvasDirector3DBridge = api;
    global.SmartCanvasCore?.register?.('director3dBridge', api);

    if(global.document?.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
    else boot();
})(window);
