/**
 * Smart Canvas — canvas project lifecycle.
 * The former in-canvas history panel was removed in M71; project creation and
 * active-canvas identity remain here because persistence depends on them.
 */
(function(global){
    'use strict';

    function d(){
        return global.SmartCanvasCore?.tryDeps?.() ?? null;
    }

    function shellCanvasTitle(value){
        const title = String(value || '').trim();
        if(!title || title === '智能画布' || title === 'Smart Canvas') return '未命名画布';
        return title;
    }

    function notifyShellCanvasProject(){
        if(!global.parent || global.parent === global) return;
        const deps = d();
        const title = shellCanvasTitle(
            deps?.canvas?.title || global.document?.getElementById?.('smartTitle')?.textContent
        );
        try {
            global.parent.postMessage({
                source:'smart-canvas',
                type:'canvas-project-state',
                canvas_id:String(deps?.canvasId || ''),
                title,
                history_open:false
            }, global.location.origin);
        } catch(e) {}
    }

    function smartCanvasUrl(id){
        return `/static/smart-canvas.html?id=${encodeURIComponent(id)}&v=2026.08.07.28`;
    }

    function setActiveCanvasId(id, {replace=true}={}){
        const deps = d();
        deps.canvasId = id || '';
        if(!deps.canvasId) return;
        const nextUrl = smartCanvasUrl(deps.canvasId);
        try {
            if(replace) history.replaceState(null, '', nextUrl);
            else history.pushState(null, '', nextUrl);
        } catch(e) {}
    }

    function smartCanvasRecords(records=[]){
        return (records || []).filter(item => ['smart', 'ecommerce'].includes(item.kind || 'smart'));
    }

    function isEcommerceCanvas(item={}){
        return item.kind === 'ecommerce' || item.icon === 'shopping-bag';
    }

    async function fetchSmartCanvasRecords(){
        const data = await fetch('/api/canvases').then(response => response.json());
        return smartCanvasRecords(data.canvases || []);
    }

    async function ensureSmartCanvasId(){
        const deps = d();
        if(deps.canvasId) return true;
        try {
            const records = await fetchSmartCanvasRecords();
            const firstSmartCanvas = records.find(item => !isEcommerceCanvas(item));
            if(firstSmartCanvas?.id){
                setActiveCanvasId(firstSmartCanvas.id);
                return true;
            }
            const created = await fetch('/api/canvases', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({title:'智能画布', icon:'sparkles', kind:'smart'})
            }).then(response => response.json());
            if(created.canvas?.id){
                setActiveCanvasId(created.canvas.id);
                return true;
            }
        } catch(e) {}
        return false;
    }

    async function createNewSmartCanvas(){
        const deps = d();
        const Persistence = global.SmartCanvasPersistence;
        await Persistence.saveCanvas();
        const created = await fetch('/api/canvases', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({title:'智能画布', icon:'sparkles', kind:'smart'})
        }).then(async response => {
            if(!response.ok) throw new Error(await response.text());
            return response.json();
        });
        if(!created.canvas?.id) throw new Error('创建画布失败');
        setActiveCanvasId(created.canvas.id, {replace:false});
        deps.canvas = created.canvas;
        deps.nodes = [];
        deps.selectedId = '';
        deps.selectedIds = [];
        deps.selectedImage = {nodeId:'', index:-1};
        deps.viewport = {x:0, y:0, scale:1};
        deps.canvasHydrated = true;
        global.SmartCanvasCanvasHint?.resetForNewCanvas?.();
        document.title = deps.canvas.title || deps.tr('canvas.smartCanvas');
        const titleEl = document.getElementById('smartTitle');
        if(titleEl) titleEl.textContent = deps.canvas.title || deps.tr('canvas.smartCanvas');
        deps.applyViewport();
        deps.render();
        notifyShellCanvasProject();
        Persistence.scheduleSave();
    }

    const api = Object.freeze({
        smartCanvasUrl,
        setActiveCanvasId,
        fetchSmartCanvasRecords,
        ensureSmartCanvasId,
        createNewSmartCanvas,
        notifyShellCanvasProject
    });

    global.SmartCanvasCore.register('history', api);
    global.SmartCanvasHistory = api;
})(window);
