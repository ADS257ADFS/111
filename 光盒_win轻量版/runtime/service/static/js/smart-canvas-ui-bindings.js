/**
 * Smart Canvas — UI bindings facade (chrome + canvas split).
 */
(function(global){
    'use strict';
    function bind(ctx){
        if(!ctx) return;
        global.SmartCanvasUiCanvas?.bindCanvas?.(ctx);
        global.SmartCanvasUiChrome?.bindChrome?.(ctx);
    }
    function bindTopActions(ctx){
        global.SmartCanvasUiChrome?.bindTopActions?.(ctx);
    }
    function bindCanvas(ctx){
        global.SmartCanvasUiCanvas?.bindCanvas?.(ctx);
    }
    function bindChrome(ctx){
        global.SmartCanvasUiChrome?.bindChrome?.(ctx);
    }
    const api = Object.freeze({ bind, bindTopActions, bindCanvas, bindChrome });
    global.SmartCanvasCore.register('uiBindings', api);
    global.SmartCanvasUiBindings = api;
})(window);
