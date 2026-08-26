/**
 * Smart Canvas — collapse floating panels; shell client coords.
 */
(function(global){
    'use strict';
    let deps = null;
    function registerDeps(next){ deps = next; }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasOverlayChrome] deps not registered');
        return c;
    }

function collapseCanvasOverlays(){
    if(window.SmartCanvasAssetOpenGuard?.active?.() || (window.__assetPanelOpenGuardUntil && Date.now() < window.__assetPanelOpenGuardUntil)) return;
    window.SmartCanvasAssetPromptUi?.closeDetail?.();
    if(S().assetLibraryOpen || S().assetPanel?.classList.contains('open')) S().toggleAssetLibrary(false);
    S().closePromptPresetPanel();
    S().closePromptTemplatePanel();
    S().canvasMainBtn?.classList.add('active');
    window.SmartCanvasLeftRail?.notifyShellCloseOverlays?.();
}
/* === MODULE: persistence → smart-canvas-persistence.js === */


function shellPoint(event){
    const rect = S().shell.getBoundingClientRect();
    return {x:event.clientX - rect.left, y:event.clientY - rect.top};
}
/* === nodes-render module wrappers (D2) === */


    const api = Object.freeze({
        registerDeps,
        collapseCanvasOverlays,
        shellPoint
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('overlayChrome', api);
    global.SmartCanvasOverlayChrome = api;
})(window);
