/**
 * Smart Canvas — canvas page navigation helpers.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasCanvasNav] deps not registered');
        return c;
    }

function backToCanvasList(){
    S().savePromptDraftForCurrent();
    window.location.href = '/static/canvas.html?v=2026.05.22.1';
}

function closeCreateMenu(){
    S().createMenu?.classList.remove('open');
    S().shell?.classList.remove('create-menu-open');
    window.SmartCanvasPortLinkMenu?.cancelPending?.();
    S().updateCanvasEmptyHint();
}

function createNodeFromMenu(type){
    const p = S().createMenuPoint || S().viewportCenter();
    closeCreateMenu();
    if(type === 'prompt') return S().createPromptNode(p.x - 250, p.y - 154);
    if(type === 'loop') return S().createLoopNode(p.x - 135, p.y - 95);
    return S().createImageNodeAt(p);
}

    const api = Object.freeze({
        registerDeps,
        backToCanvasList,
        closeCreateMenu,
        createNodeFromMenu,
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('canvasNav', api);
    global.SmartCanvasCanvasNav = api;
})(window);
