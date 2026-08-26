/**
 * Smart Canvas — persistence module (save / load / server merge).
 * @see SmartCanvasCore.BOUNDARIES.persistence
 */
(function(global){
    'use strict';

    function d(){
        return global.SmartCanvasCore?.tryDeps?.() ?? null;
    }

    function canvasForStorage(){
        const deps = d();
        const clean = JSON.parse(JSON.stringify(deps.canvas || {}));
        clean.settings = deps.settingsForStorage(deps.canvasDefaultSmartSettings || deps.initialSmartSettings);
        (clean.nodes || []).forEach(node => {
            if(Array.isArray(node.images)) node.images = node.images.map(image => {
                const stored = deps.mediaItemForStorage(image);
                if(stored && typeof stored === 'object') delete stored._inlineVideoActive;
                return stored;
            });
            if(node.runSettings) node.runSettings = deps.settingsForStorage(node.runSettings);
        });
        return clean;
    }

    function resetInlineVideoPlayback(nodes=[]){
        nodes.forEach(node => (node.images || []).forEach(image => {
            if(image && typeof image === 'object') delete image._inlineVideoActive;
        }));
    }

    function scheduleSave(){
        const deps = d();
        if(!deps) return;
        clearTimeout(deps.saveTimer);
        deps.saveTimer = setTimeout(() => global.SmartCanvasPersistence.saveCanvas(), 450);
    }

    async function saveCanvas(options={}){
        const deps = d();
        if(!deps || !deps.canvasId || !deps.canvas) return;
        clearTimeout(deps.saveTimer);
        deps.saveTimer = null;
        deps.canvasSyncInFlight = true;
        try {
        deps.savePromptDraftForCurrent();
        deps.nodes.forEach(node => {
            node.images = (node.images || []).map(img => deps.mediaItemForStorage(deps.stripImageGenerationMeta(img)));
            if(node.runSettings) node.runSettings = deps.settingsForStorage(node.runSettings);
        });
        deps.canvas.nodes = deps.nodes;
        deps.canvas.settings = deps.settingsForStorage(deps.canvasDefaultSmartSettings || deps.initialSmartSettings);
        deps.canvas.viewport = {...deps.viewport};
        const storageCanvas = canvasForStorage();
        const localNodeCount = (storageCanvas.nodes || []).length;
        if(!deps.canvasHydrated && !localNodeCount){
            try {
                const probe = await fetch(`/api/canvases/${encodeURIComponent(deps.canvasId)}`);
                if(probe.ok){
                    const probeData = await probe.json();
                    const serverNodes = probeData?.canvas?.nodes || [];
                    if(serverNodes.length){
                        applyMergedServerCanvas(probeData.canvas);
                        deps.canvasHydrated = true;
                        deps.toast('画布已从服务器恢复，避免空数据覆盖');
                        return;
                    }
                }
            } catch(e) {}
        }
        try {
            const res = await fetch(`/api/canvases/${encodeURIComponent(deps.canvasId)}`, {
                method:'PUT',
                headers:{'Content-Type':'application/json'},
                keepalive:Boolean(options.keepalive),
                body:JSON.stringify({
                    title:storageCanvas.title || deps.tr('smart.title'),
                    icon:storageCanvas.icon || 'sparkles',
                    nodes:storageCanvas.nodes || [],
                    connections:storageCanvas.connections || [],
                    viewport:storageCanvas.viewport || {x:0,y:0,scale:1},
                    logs:storageCanvas.logs || [],
                    settings:storageCanvas.settings,
                    base_updated_at:storageCanvas.updated_at || deps.canvas.updated_at || 0,
                    client_id:deps.smartClientId || ''
                })
            });
            if(res.ok){
                const data = await res.json();
                if(data.canvas) deps.canvas = {...deps.canvas, ...data.canvas};
                deps.canvasHydrated = true;
            } else if(res.status === 409) {
                const data = await res.json().catch(() => ({}));
                const serverCanvas = data.detail?.canvas;
                if(serverCanvas){
                    applyMergedServerCanvas(serverCanvas);
                    deps.canvasHydrated = true;
                    deps.toast('画布已在其他窗口更新，已自动合并');
                } else if(data.detail?.updated_at){
                    deps.canvas.updated_at = data.detail.updated_at;
                }
            }
        } catch(e) {}
        } finally {
            deps.canvasSyncInFlight = false;
        }
    }

    function flushPendingSave(){
        const deps = d();
        if(!deps?.saveTimer) return;
        clearTimeout(deps.saveTimer);
        deps.saveTimer = null;
        void saveCanvas({keepalive:true});
    }

    async function loadCanvas(){
        const deps = d();
        if(!deps) return;
        const History = global.SmartCanvasHistory;
        if(!deps.canvasId && History && !(await History.ensureSmartCanvasId())) return;
        deps.canvasHydrated = false;
        try {
            const res = await fetch(`/api/canvases/${encodeURIComponent(deps.canvasId)}`);
            if(!res.ok){
                deps.toast('画布加载失败，请刷新页面或从画布历史重新打开');
                return;
            }
            const data = await res.json();
            deps.canvas = data.canvas;
            document.title = deps.canvas.title || deps.tr('canvas.smartCanvas');
            const titleEl = document.getElementById('smartTitle');
            if(titleEl) titleEl.textContent = deps.canvas.title || deps.tr('canvas.smartCanvas');
            deps.nodes = (Array.isArray(deps.canvas.nodes) ? deps.canvas.nodes : []).map(deps.normalizeLegacySmartNode).filter(Boolean);
            resetInlineVideoPlayback(deps.nodes);
            deps.nodes.forEach(n => {
                const pendingTasks = deps.smartPendingTasks(n);
                if(pendingTasks.length){
                    n.pending = Math.max(pendingTasks.length, Number(n.pending || 0) || pendingTasks.length);
                    n.running = false;
                } else if(n.pending){
                    n.pending = 0;
                }
            });
            deps.canvas.connections = Array.isArray(deps.canvas.connections) ? deps.canvas.connections : [];
            deps.viewport = {...deps.viewport, ...(deps.canvas.viewport || {})};
            deps.viewport.scale = deps.safeScale(deps.viewport.scale);
            if(deps.canvas.settings) deps.settings = {...deps.settings, ...deps.canvas.settings};
            deps.canvasDefaultSmartSettings = deps.cloneSmartSettings(deps.settings);
            deps.loadRecentSmartSettings();
            if(deps.settings.comfy_workflow && !deps.settings.comfyWorkflow) deps.settings.comfyWorkflow = deps.settings.comfy_workflow;
            if(deps.settings.comfy_params && !deps.settings.comfyParams) deps.settings.comfyParams = deps.settings.comfy_params;
            deps.updateProviderModels();
            deps.canvasHydrated = true;
            deps.applyViewport();
            deps.render();
            deps.resumeSmartPendingTasks();
        } catch(e) {
            deps.toast(deps.tr('smart.toastCanvasFail'));
        }
    }

    function applyMergedServerCanvas(serverCanvas){
        const deps = d();
        if(!deps) return false;
        if(!serverCanvas || !deps.canvas) return false;
        const remoteNodes = (Array.isArray(serverCanvas.nodes) ? serverCanvas.nodes : []).map(deps.normalizeLegacySmartNode).filter(Boolean);
        resetInlineVideoPlayback(remoteNodes);
        const mergedNodes = global.SmartCanvasNodeMerge?.mergeSmartNodeLists?.(deps.nodes, remoteNodes) ?? deps.mergeSmartNodeLists?.(deps.nodes, remoteNodes) ?? deps.nodes;
        const nodeIds = new Set(mergedNodes.map(n => n.id));
        deps.nodes = mergedNodes;
        deps.canvas.connections = global.SmartCanvasNodeMerge?.mergeSmartConnections?.(deps.canvas.connections, serverCanvas.connections, nodeIds) ?? deps.canvas.connections;
        const cleanedState = global.SmartCanvasNodeMerge?.clearCompletedNodeBusyStates?.() ?? deps.clearCompletedNodeBusyStates?.();
        const recoveredLoopOutputs = deps.recoverStuckLoopOutputsFromLogs();
        deps.canvas.updated_at = Number(serverCanvas.updated_at || deps.canvas.updated_at || 0);
        if(deps.canvas.title !== serverCanvas.title && serverCanvas.title){
            deps.canvas.title = serverCanvas.title;
            const titleEl = document.getElementById('smartTitle');
            if(titleEl) titleEl.textContent = deps.canvas.title;
        }
        deps.render();
        if(typeof deps.scheduleConnectionLayerRefresh === 'function') deps.scheduleConnectionLayerRefresh();
        if(cleanedState || recoveredLoopOutputs) scheduleSave();
        deps.resumeSmartPendingTasks();
        deps.resumeJimengPendingNodes();
        return true;
    }

    let canvasSyncTimer = null;
    let canvasMetaPollTimer = null;

    function handleCanvasUpdatedMessage(data={}){
        const deps = d();
        if(!deps) return;
        if(!data || data.type !== 'canvas_updated') return;
        if(!deps.canvasId || data.canvas_id !== deps.canvasId) return;
        if(data.client_id && data.client_id === deps.smartClientId) return;
        if(deps.canvasSyncInFlight) return;
        const remoteUpdatedAt = Number(data.updated_at || 0);
        if(remoteUpdatedAt && remoteUpdatedAt <= Number(deps.canvas?.updated_at || 0)) return;
        scheduleCanvasMergeReload(200);
    }

    function scheduleCanvasMergeReload(delay=200){
        clearTimeout(canvasSyncTimer);
        canvasSyncTimer = setTimeout(() => { mergeReloadCanvasNow(); }, delay);
    }

    async function mergeReloadCanvasNow(){
        const deps = d();
        if(!deps || !deps.canvasId) return;
        if(deps.dragState || deps.selectionState){
            scheduleCanvasMergeReload(600);
            return;
        }
        try {
            const res = await fetch(`/api/canvases/${encodeURIComponent(deps.canvasId)}`);
            if(!res.ok) return;
            const data = await res.json();
            if(data && data.canvas) applyMergedServerCanvas(data.canvas);
        } catch(e) {}
    }

    function startCanvasMetaPoll(){
        const deps = d();
        if(!deps || canvasMetaPollTimer) return;
        canvasMetaPollTimer = setInterval(async () => {
            const d2 = d();
            if(!d2 || !d2.canvasId || !d2.canvas) return;
            if(d2.canvasSyncInFlight || d2.dragState || d2.selectionState) return;
            try {
                const res = await fetch(`/api/canvases/${encodeURIComponent(d2.canvasId)}/meta`);
                if(!res.ok) return;
                const meta = await res.json();
                if(Number(meta.updated_at || 0) > Number(d2.canvas.updated_at || 0)) mergeReloadCanvasNow();
            } catch(e) {}
        }, 8000);
    }

    const api = Object.freeze({
        canvasForStorage,
        scheduleSave,
        saveCanvas,
        flushPendingSave,
        loadCanvas,
        applyMergedServerCanvas,
        handleCanvasUpdatedMessage,
        scheduleCanvasMergeReload,
        mergeReloadCanvasNow,
        startCanvasMetaPoll,
    });

    global.SmartCanvasCore.register('persistence', api);
    global.SmartCanvasPersistence = api;
    global.addEventListener('pagehide', flushPendingSave);
})(window);
