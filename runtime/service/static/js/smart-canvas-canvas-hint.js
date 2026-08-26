/**
 * Smart Canvas — empty canvas hint visibility.
 */
(function(global){
    'use strict';
    let deps = null;
    let previousEmpty = false;
    let edgePeekBound = false;
    let lastPeekSignature = '';
    let edgePeekClearTimer = 0;
    let emptyTextWasEmpty = false;
    let chromeRevealed = false;
    let startupHintShown = false;
    let startupHintDismissed = false;
    let populatedActivationBound = false;
    function registerDeps(next){
        deps = next;
        bindPopulatedCanvasActivation();
    }
    function S(){
        const c = deps;
        if(!c) throw new Error('[SmartCanvasCanvasHint] deps not registered');
        return c;
    }

function syncEmptyChrome(){
    const empty = S().getNodes().length === 0;
    global.SmartCanvasEmptyDotGrid?.setEmpty?.(empty);
    const recessed = !chromeRevealed;
    document.documentElement.classList.toggle('canvas-empty-chrome-recessed', recessed);
    applyEdgePeek(false, false, false);
    previousEmpty = empty;
    try {
        window.parent?.postMessage?.({
            type:'canvas-empty-chrome-state',
            empty,
            recessed
        }, location.origin);
    } catch(e) {}
    return recessed;
}

function applyEdgePeek(left=false, right=false, bottom=false){
    if(edgePeekClearTimer) global.clearTimeout?.(edgePeekClearTimer);
    edgePeekClearTimer = 0;
    const next = {left:Boolean(left), right:Boolean(right), bottom:Boolean(bottom)};
    const signature = `${Number(next.left)}${Number(next.right)}${Number(next.bottom)}`;
    document.documentElement.classList.toggle('canvas-empty-bottom-peek', next.bottom);
    if(signature === lastPeekSignature) return;
    lastPeekSignature = signature;
    try {
        window.parent?.postMessage?.({type:'canvas-empty-chrome-peek', ...next}, location.origin);
    } catch(e) {}
}

function publishEdgePeek(left=false, right=false, bottom=false){
    const recessed = document.documentElement.classList.contains('canvas-empty-chrome-recessed');
    if(!recessed) return applyEdgePeek();
    if(left || right || bottom) return applyEdgePeek(left, right, bottom);
    if(edgePeekClearTimer) global.clearTimeout?.(edgePeekClearTimer);
    if(!global.setTimeout) return applyEdgePeek();
    edgePeekClearTimer = global.setTimeout(() => applyEdgePeek(), 220);
}

function updateEmptyChromeEdgePeek(event){
    if(!document.documentElement.classList.contains('canvas-empty-chrome-recessed')) return publishEdgePeek();
    const x = Number(event?.clientX);
    const y = Number(event?.clientY);
    const width = Math.max(1, window.innerWidth || 1);
    const height = Math.max(1, window.innerHeight || 1);
    const bottom = x <= 132 && y >= height - 124;
    const left = !bottom && x <= 96 && y >= height * .24 && y <= height * .76;
    const right = !bottom && !left && x >= width - 164 && y <= 112;
    publishEdgePeek(left, right, bottom);
}

function bindEmptyChromeEdgePeek(){
    const target = deps?.shell;
    if(edgePeekBound || !target?.addEventListener) return;
    edgePeekBound = true;
    target.addEventListener('pointermove', updateEmptyChromeEdgePeek, {passive:true});
    target.addEventListener('pointerleave', () => publishEdgePeek(), {passive:true});
}

function bindPopulatedCanvasActivation(){
    const target = deps?.shell;
    if(populatedActivationBound || !target?.addEventListener) return;
    populatedActivationBound = true;
    target.addEventListener('click', event => {
        if(event.button !== 0 || S().getNodes().length === 0) return;
        if(!document.documentElement.classList.contains('canvas-empty-chrome-recessed')) return;
        revealEmptyChrome();
    }, true);
}

function revealEmptyChrome(){
    chromeRevealed = true;
    startupHintDismissed = true;
    S().canvasEmptyHint?.classList.remove('open');
    syncEmptyChrome();
    return true;
}

function resetForNewCanvas(){
    chromeRevealed = false;
    startupHintShown = false;
    startupHintDismissed = false;
    emptyTextWasEmpty = false;
    S().canvasEmptyHint?.classList.remove('open');
    syncEmptyChrome();
}

function playEmptyText(){
    const hint = S().canvasEmptyHint;
    const text = hint?.querySelector?.('[data-empty-split-text]');
    if(!text) return;
    hint.classList.remove('split-text-playing', 'split-text-complete');
    text.textContent = text.dataset.emptySplitText || text.textContent || '';
    hint.classList.add('split-text-complete');
}

function updateCanvasEmptyHint(){
    const menuEl = document.getElementById('portLinkPickMenu');
    const pickMenuOpen = Boolean(window.SmartCanvasPortLinkMenu?.isOpen?.())
        || Boolean(menuEl?.classList?.contains('open'))
        || Boolean(S().shell?.classList?.contains('port-link-menu-open'));
    const empty = S().getNodes().length === 0;
    const eligible = empty && !pickMenuOpen;
    if(startupHintShown && !eligible) startupHintDismissed = true;
    const show = eligible && !startupHintDismissed;
    if(show) startupHintShown = true;
    const becameEmpty = empty && !emptyTextWasEmpty;
    emptyTextWasEmpty = empty;
    S().canvasEmptyHint?.classList.toggle('open', show);
    if(show && becameEmpty) playEmptyText();
    syncEmptyChrome();
}

    const api = Object.freeze({
        registerDeps,
        updateCanvasEmptyHint,
        syncEmptyChrome,
        revealEmptyChrome,
        resetForNewCanvas,
        updateEmptyChromeEdgePeek
    });
    if(global.SmartCanvasCore) global.SmartCanvasCore.register('canvasHint', api);
    global.SmartCanvasCanvasHint = api;
})(window);
