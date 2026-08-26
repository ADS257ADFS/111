/**
 * Smart Canvas — module registry & dependency injection.
 *
 * Module boundaries (do not cross without going through deps / module API):
 *   providers  — API platform load/filter only
 *   persistence — canvas save / load / server merge only
 *   history    — multi-canvas list panel only
 *   composer   — generation panel UI (params still in smart-canvas.js; shell in smart-canvas-composer.js)
 *   uiChrome   — left sidebar / asset panels / composer outer events / keyboard (smart-canvas-ui-chrome.js)
 *   uiCanvas   — shell pan/zoom/dblclick, create menu, minimap (smart-canvas-ui-canvas.js)
 *   uiBindings — facade delegating to uiChrome + uiCanvas
 *
 * Development constraints: docs/开发约束.md  |  Architecture: docs/smart-canvas-architecture.md
 *
 * Main file (smart-canvas.js) owns: composer params, cascade, assets, ctx bridge, thin wrappers.
 *   generation   — API/Comfy/RH run, poll, cancel (smart-canvas-generation.js)
 *   upload       — file upload + drag-drop import (smart-canvas-upload.js)
 *   nodesRender  — render(), connections, node body HTML (smart-canvas-nodes-render.js)
 *   nodeEvents   — bindNodeEvents, port drag, prompt/loop node controls (smart-canvas-node-events.js)
 *   uiContext    — buildSmartCanvasUiContext (smart-canvas-ui-context.js)
 */
(function(global){
    'use strict';

    const modules = Object.create(null);
    let deps = null;

    const BOUNDARIES = Object.freeze({
        providers: 'Load/filter API platforms. Do not touch composer DOM, history panel, or canvas save.',
        persistence: 'Save/load/merge canvas JSON. Do not touch composer params or history panel HTML.',
        history: 'Canvas list/history panel. Do not touch composer or save merge internals.',
        composer: 'Composer panel shell (position, thumbs, updateComposer). Params in smart-canvas-composer-params.js.',
        coCreate: 'Co-create mode UI + multi-prompt parallel run. Shares composer settings; does not fork size/quality/count.',
        uiChrome: 'Sidebar, asset library, composer outer events, keyboard. Do not touch canvas shell drag/dblclick or create menu.',
        uiCanvas: 'Shell pan/zoom/dblclick, create menu, minimap, world mouse. Do not touch sidebar or composer param pills.',
        uiBindings: 'Thin facade: bindChrome + bindCanvas only. Do not add new logic here.',
        generation: 'Run/poll/cancel generation tasks. Do not touch render or upload.',
        upload: 'Upload files and drag-drop import. Do not touch generation or render.',
        nodesRender: 'Canvas node DOM render + connection layer. Do not bind shell events here.',
        nodeEvents: 'Per-node click/drag/port handlers. Do not touch sidebar or composer params.',
        uiContext: 'buildSmartCanvasUiContext only. Binds state/actions for uiChrome/uiCanvas.',
    });

    function register(name, api){
        if(!name || !api || typeof api !== 'object') throw new Error('[SmartCanvasCore] invalid module registration');
        modules[name] = Object.freeze({...api, __module: name});
        return modules[name];
    }

    function get(name){
        return modules[name] || null;
    }

    function require(name){
        const mod = get(name);
        if(!mod) throw new Error(`[SmartCanvasCore] module not registered: ${name}`);
        return mod;
    }

    function registerDeps(next){
        deps = next;
    }

    function getDeps(){
        if(!deps) throw new Error('[SmartCanvasCore] deps not registered — call SmartCanvasCore.registerDeps() from smart-canvas.js after globals init');
        return deps;
    }

    /** Safe deps access for modules that may init before registerDeps (returns null). */
    function tryDeps(){
        return deps;
    }

    global.SmartCanvasCore = Object.freeze({
        BOUNDARIES,
        register,
        get,
        require,
        registerDeps,
        get deps(){ return getDeps(); },
        tryDeps
    });
})(window);
