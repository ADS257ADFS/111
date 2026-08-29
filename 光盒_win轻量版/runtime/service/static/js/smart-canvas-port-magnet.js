/**
 * Smart Canvas - magnetic snap for node connection ports (out port only).
 * Disabled while canvas-performance-mode is on (always in this build) — the
 * per-mousemove layout reads were a primary WebView2 lag source.
 */
(function(global){
    'use strict';

    const OUT_RADIUS = 25;

    function deps(){ return global.SmartCanvasCore?.tryDeps?.() ?? null; }

    function magnetEnabled(){
        return !document.documentElement.classList.contains('canvas-performance-mode');
    }

    function scheduleFrame(){ /* no-op in performance mode */ }

    function bind(){
        const d = deps();
        if(!d?.shell || !d?.world) return false;
        if(d.shell.dataset.portMagnetBound === '1') return true;
        // Keep the flag so callers don't retry-bind a heavy loop.
        d.shell.dataset.portMagnetBound = magnetEnabled() ? '0' : '1';
        if(!magnetEnabled()) return true;
        d.shell.dataset.portMagnetBound = '1';
        return true;
    }

    function boot(){
        if(!bind()) setTimeout(boot, 120);
    }

    if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    const api = Object.freeze({ bind, scheduleFrame, OUT_RADIUS });
    global.SmartCanvasCore?.register?.('portMagnet', api);
    global.SmartCanvasPortMagnet = api;
})(window);
